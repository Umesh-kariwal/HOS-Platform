import { Controller, Get, Post, Body, Param, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
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

    // 1. Find or create guest by email
    let guest = await this.prisma.guest.findFirst({
      where: { email: body.guestEmail },
    });

    if (!guest) {
      guest = await this.prisma.guest.create({
        data: {
          tenantId,
          firstName: body.guestFirstName,
          lastName: body.guestLastName,
          email: body.guestEmail,
        },
      });
    }

    // 2. Create the Booking record
    return this.prisma.booking.create({
      data: {
        tenantId,
        branchId,
        guestId: guest.id,
        roomId: body.roomId || null,
        checkInDate: new Date(body.checkInDate),
        checkOutDate: new Date(body.checkOutDate),
        status: 'reserved',
      },
      include: {
        guest: true,
        room: true,
      },
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
      // A. Update room status to occupied
      await tx.room.update({
        where: { id: body.roomId },
        data: {
          occupancyStatus: 'occupied',
        },
      });

      // B. Update booking status and assign room
      return tx.booking.update({
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
    });

    if (!booking) {
      throw new UnauthorizedException('Booking not found');
    }

    if (!booking.roomId) {
      throw new UnauthorizedException('Booking does not have an assigned room');
    }

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
      return tx.booking.update({
        where: { id },
        data: {
          status: 'checked_out',
        },
        include: {
          guest: true,
          room: true,
        },
      });
    });
  }
}
