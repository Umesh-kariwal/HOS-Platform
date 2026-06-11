import { Controller, Get, Post, Body, Param, UseGuards, Request, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getBookings(@Request() req: any) {
    const branchId = req.user.branchId;
    return this.prisma.booking.findMany({
      where: { branchId },
      include: {
        guest: true,
        room: true,
      },
      orderBy: {
        checkInDate: 'asc',
      },
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createBooking(
    @Request() req: any,
    @Body() body: {
      guestFirstName: string;
      guestLastName: string;
      guestEmail: string;
      checkInDate: string;
      checkOutDate: string;
      roomId?: string;
    },
  ) {
    const branchId = req.user.branchId;
    const tenantId = req.user.tenantId;

    const checkIn = new Date(body.checkInDate);
    const checkOut = new Date(body.checkOutDate);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    if (checkIn >= checkOut) {
      throw new BadRequestException('checkInDate must be before checkOutDate');
    }

    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // 1. Find or create guest by email
      let guest = await tx.guest.findFirst({
        where: { email: body.guestEmail },
      });

      if (!guest) {
        guest = await tx.guest.create({
          data: {
            tenantId,
            firstName: body.guestFirstName,
            lastName: body.guestLastName,
            email: body.guestEmail,
          },
        });
      }

      let roomTypeId: string | null = null;

      // 2. If roomId is provided, perform overbooking check and lock the room
      if (body.roomId) {
        // A. Lock room row to prevent concurrent assignment
        const rooms = await tx.$queryRawUnsafe(
          `SELECT id, "room_type_id" FROM rooms WHERE id = $1::uuid FOR UPDATE`,
          body.roomId
        );

        if (!rooms || rooms.length === 0) {
          throw new BadRequestException('Assigned room not found');
        }
        roomTypeId = rooms[0].room_type_id;

        // B. Check for overlapping bookings
        const overlapping = await tx.booking.findFirst({
          where: {
            roomId: body.roomId,
            status: { in: ['reserved', 'checked_in'] },
            checkInDate: { lt: checkOut },
            checkOutDate: { gt: checkIn },
          },
        });

        if (overlapping) {
          throw new ConflictException('Room is already booked for these dates');
        }
      }

      // 3. Create the Booking record
      const booking = await tx.booking.create({
        data: {
          tenantId,
          branchId,
          guestId: guest.id,
          roomId: body.roomId || null,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          status: 'reserved',
        },
        include: {
          guest: true,
          room: true,
        },
      });

      // 4. Update Inventory Snapshots if room type is resolved
      if (roomTypeId) {
        await this.updateInventorySnapshots(
          tx,
          tenantId,
          branchId,
          roomTypeId,
          checkIn,
          checkOut
        );
      }

      return booking;
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/check-in')
  async checkIn(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { roomId: string },
  ) {
    const tenantId = req.user.tenantId;

    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new UnauthorizedException('Booking not found');
    }

    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // 1. Lock the room row and check if it exists
      const rooms = await tx.$queryRawUnsafe(
        `SELECT id, "room_type_id" FROM rooms WHERE id = $1::uuid FOR UPDATE`,
        body.roomId
      );

      if (!rooms || rooms.length === 0) {
        throw new BadRequestException('Room not found');
      }
      const roomTypeId = rooms[0].room_type_id;

      // 2. Check for overlapping bookings (excluding this booking)
      const overlapping = await tx.booking.findFirst({
        where: {
          roomId: body.roomId,
          id: { not: id },
          status: { in: ['reserved', 'checked_in'] },
          checkInDate: { lt: booking.checkOutDate },
          checkOutDate: { gt: booking.checkInDate },
        },
      });

      if (overlapping) {
        throw new ConflictException('Room is already booked for these dates');
      }

      // Track old room type if roomId changed to recalculate inventory
      let oldRoomTypeId: string | null = null;
      if (booking.roomId && booking.roomId !== body.roomId) {
        const oldRoom = await tx.room.findUnique({
          where: { id: booking.roomId },
        });
        if (oldRoom) {
          oldRoomTypeId = oldRoom.roomTypeId;
        }
      }

      // 3. Update room status to occupied
      await tx.room.update({
        where: { id: body.roomId },
        data: {
          occupancyStatus: 'occupied',
        },
      });

      // 4. Update booking status and assign room
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          roomId: body.roomId,
          status: 'checked_in',
        },
        include: {
          guest: true,
          room: true,
        },
      });

      // 5. Update Inventory Snapshots for the new room type
      await this.updateInventorySnapshots(
        tx,
        tenantId,
        booking.branchId,
        roomTypeId,
        booking.checkInDate,
        booking.checkOutDate
      );

      // 6. Update old room type snapshots if it was different
      if (oldRoomTypeId && oldRoomTypeId !== roomTypeId) {
        await this.updateInventorySnapshots(
          tx,
          tenantId,
          booking.branchId,
          oldRoomTypeId,
          booking.checkInDate,
          booking.checkOutDate
        );
      }

      return updatedBooking;
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/check-out')
  async checkOut(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;

    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { room: true },
    });

    if (!booking) {
      throw new UnauthorizedException('Booking not found');
    }

    if (!booking.roomId || !booking.room) {
      throw new UnauthorizedException('Booking does not have an assigned room');
    }

    const roomTypeId = booking.room.roomTypeId;

    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // A. Update room status to vacant and dirty
      await tx.room.update({
        where: { id: booking.roomId },
        data: {
          occupancyStatus: 'vacant',
          physicalStatus: 'dirty',
        },
      });

      // B. Update booking status to checked_out
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: 'checked_out',
        },
        include: {
          guest: true,
          room: true,
        },
      });

      // C. Update Inventory Snapshots
      await this.updateInventorySnapshots(
        tx,
        tenantId,
        booking.branchId,
        roomTypeId,
        booking.checkInDate,
        booking.checkOutDate
      );

      return updatedBooking;
    });
  }

  private async updateInventorySnapshots(
    tx: any,
    tenantId: string,
    branchId: string,
    roomTypeId: string,
    startDate: Date,
    endDate: Date
  ) {
    const current = new Date(startDate);
    const end = new Date(endDate);

    const totalPhysical = await tx.room.count({
      where: {
        branchId,
        roomTypeId,
      },
    });

    while (current < end) {
      const snapshotDate = new Date(current);

      const soldQty = await tx.booking.count({
        where: {
          branchId,
          status: { in: ['reserved', 'checked_in'] },
          room: { roomTypeId },
          checkInDate: { lte: snapshotDate },
          checkOutDate: { gt: snapshotDate },
        },
      });

      const availableQty = totalPhysical - soldQty;

      // Fetch existing snapshot record first to satisfy multi-tenant query rewriter constraints
      const existing = await tx.inventorySnapshot.findFirst({
        where: {
          roomTypeId,
          snapshotDate,
        },
      });

      if (existing) {
        await tx.inventorySnapshot.update({
          where: { id: existing.id },
          data: {
            totalPhysical,
            soldQty,
            availableQty,
          },
        });
      } else {
        await tx.inventorySnapshot.create({
          data: {
            tenantId,
            roomTypeId,
            snapshotDate,
            totalPhysical,
            soldQty,
            availableQty,
          },
        });
      }

      current.setDate(current.getDate() + 1);
    }
  }
}
