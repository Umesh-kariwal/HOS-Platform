import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('night-audit')
export class NightAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('status')
  async getStatus(@Request() req: any) {
    const branchId = req.user.branchId;
    const tenantId = req.user.tenantId;

    // 1. Fetch current business date or initialize it
    let propDate = await this.prisma.propertyDate.findUnique({
      where: {
        tenantId_branchId: {
          tenantId,
          branchId,
        },
      },
    });

    if (!propDate) {
      propDate = await this.prisma.propertyDate.create({
        data: {
          tenantId,
          branchId,
          businessDate: new Date('2026-06-11'),
          status: 'open',
        },
      });
    }

    const busDate = propDate.businessDate;
    const nextDay = new Date(busDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // 2. Fetch occupancy and room status
    const rooms = await this.prisma.room.findMany({
      where: { branchId },
    });
    const totalRoomsCount = rooms.length;
    const occupiedRoomsCount = rooms.filter((r: any) => r.occupancyStatus === 'occupied').length;
    const occupancyRate = totalRoomsCount > 0 ? Math.round((occupiedRoomsCount / totalRoomsCount) * 100) : 0;

    // 3. Fetch pending arrivals (reserved bookings with check-in <= businessDate)
    const pendingArrivals = await this.prisma.booking.count({
      where: {
        branchId,
        status: 'reserved',
        checkInDate: {
          lte: busDate,
        },
      },
    });

    // 4. Fetch pending departures (checked_in bookings with check-out <= businessDate)
    const pendingDepartures = await this.prisma.booking.count({
      where: {
        branchId,
        status: 'checked_in',
        checkOutDate: {
          lte: busDate,
        },
      },
    });

    // 5. Fetch checkpoints
    const checkpoints = await this.prisma.nightAuditCheckpoint.findMany({
      where: { branchId },
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    return {
      businessDate: busDate.toISOString().split('T')[0],
      status: propDate.status,
      totalRoomsCount,
      occupiedRoomsCount,
      occupancyRate,
      pendingArrivals,
      pendingDepartures,
      checkpoints,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('roll-date')
  async rollDate(@Request() req: any) {
    const branchId = req.user.branchId;
    const tenantId = req.user.tenantId;

    // Fetch existing date or create
    let propDate = await this.prisma.propertyDate.findUnique({
      where: {
        tenantId_branchId: {
          tenantId,
          branchId,
        },
      },
    });

    if (!propDate) {
      propDate = await this.prisma.propertyDate.create({
        data: {
          tenantId,
          branchId,
          businessDate: new Date('2026-06-11'),
          status: 'open',
        },
      });
    }

    const currentBusDate = new Date(propDate.businessDate);
    const nextBusDate = new Date(currentBusDate);
    nextBusDate.setDate(nextBusDate.getDate() + 1);

    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // 1. Advance the date
      await tx.propertyDate.update({
        where: {
          tenantId_branchId: {
            tenantId,
            branchId,
          },
        },
        data: {
          businessDate: nextBusDate,
          status: 'open',
        },
      });

      // 2. Create audit checkpoint
      const checkpoint = await tx.nightAuditCheckpoint.create({
        data: {
          tenantId,
          branchId,
          checkpointName: `Day Rollover: ${currentBusDate.toISOString().split('T')[0]} -> ${nextBusDate.toISOString().split('T')[0]}`,
          completedAt: new Date(),
        },
      });

      return {
        success: true,
        previousDate: currentBusDate.toISOString().split('T')[0],
        newDate: nextBusDate.toISOString().split('T')[0],
        checkpoint,
      };
    });
  }
}
