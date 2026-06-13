import { Controller, Get, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'))
export class InventoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('availability')
  async getAvailability(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    if (start >= end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const branchId = req.user.branchId;

    // 1. Fetch Room Types
    const roomTypes = await this.prisma.roomType.findMany({
      where: {
        branchId,
        ...(roomTypeId ? { id: roomTypeId } : {}),
      },
    });

    // 2. Fetch Rooms
    const rooms = await this.prisma.room.findMany({
      where: {
        branchId,
        ...(roomTypeId ? { roomTypeId } : {}),
      },
    });

    // 3. Fetch active bookings overlapping with the range
    const bookings = await this.prisma.booking.findMany({
      where: {
        branchId,
        status: { in: ['reserved', 'checked_in'] },
        checkInDate: { lt: end },
        checkOutDate: { gt: start },
        roomId: { not: null },
      },
      include: {
        room: true,
      },
    });

    // 4. Generate daily snapshots for each date in [start, end)
    const resultRoomTypes = [];
    for (const rt of roomTypes) {
      const rtRooms = rooms.filter((r: any) => r.roomTypeId === rt.id && r.physicalStatus !== 'maintenance');
      const totalPhysical = rtRooms.length;

      const days = [];
      const current = new Date(start);
      while (current < end) {
        const currentDate = new Date(current);
        
        // Count bookings for this room type on this date
        const activeBookings = bookings.filter((b: any) => {
          return (
            b.room?.roomTypeId === rt.id &&
            b.checkInDate <= currentDate &&
            b.checkOutDate > currentDate
          );
        });

        const soldQty = activeBookings.length;
        const availableQty = totalPhysical - soldQty;

        days.push({
          date: currentDate.toISOString().split('T')[0],
          totalPhysical,
          soldQty,
          availableQty,
        });

        current.setDate(current.getDate() + 1);
      }

      resultRoomTypes.push({
        roomTypeId: rt.id,
        code: rt.code,
        name: rt.name,
        totalRooms: totalPhysical,
        days,
      });
    }

    // 5. Generate list of available rooms for the entire range
    const availableRooms = rooms.filter((r: any) => {
      const hasBooking = bookings.some((b: any) => {
        return (
          b.roomId === r.id &&
          b.checkInDate < end &&
          b.checkOutDate > start
        );
      });
      return !hasBooking && r.physicalStatus !== 'maintenance';
    });

    return {
      startDate,
      endDate,
      roomTypes: resultRoomTypes,
      availableRooms,
    };
  }
}
