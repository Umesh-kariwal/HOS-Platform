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

    const dateStr = currentBusDate.toISOString().split('T')[0];

    return this.prisma.runInTenantContext(tenantId, async (tx: any) => {
      // 1. ROOM CHARGE AUTOPOSTER: Post daily room charges to all active folios
      // Find all bookings currently in-house (checked_in) for the current business date night
      const activeBookings = await tx.booking.findMany({
        where: {
          branchId,
          status: 'checked_in',
          checkInDate: { lte: currentBusDate },
          checkOutDate: { gt: currentBusDate },
        },
        include: {
          room: {
            include: { roomType: true },
          },
        },
      });

      console.log(`[Night Audit] Found ${activeBookings.length} in-house bookings to autopost room charges.`);

      for (const booking of activeBookings) {
        if (booking.room && booking.room.roomType) {
          const roomRate = Number(booking.room.roomType.rackRate);
          const idempotencyKey = `room_charge_${booking.id}_${dateStr}`;

          // Find or create primary guest folio for this booking
          let folio = await tx.folio.findFirst({
            where: {
              bookingId: booking.id,
              payerType: 'guest',
            },
          });

          if (!folio) {
            folio = await tx.folio.create({
              data: {
                tenantId,
                bookingId: booking.id,
                payerType: 'guest',
                payerGuestId: booking.guestId,
                status: 'open',
              },
            });
          }

          // Check if room charge was already posted to prevent double charging
          const existingCharge = await tx.ledgerEntry.findFirst({
            where: { idempotencyKey },
          });

          if (!existingCharge) {
            await tx.ledgerEntry.create({
              data: {
                tenantId,
                folioId: folio.id,
                type: 'room_charge',
                amount: roomRate,
                description: `Room Charge - Night of ${dateStr} (Room ${booking.room.roomNumber})`,
                idempotencyKey,
              },
            });
            console.log(`[Night Audit] Auto-posted room charge of $${roomRate} to Folio ${folio.id} for Booking ${booking.id}`);
          }
        }
      }

      // 2. Advance the business date
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

      // 3. Create audit checkpoint
      const checkpoint = await tx.nightAuditCheckpoint.create({
        data: {
          tenantId,
          branchId,
          checkpointName: `Day Rollover: ${dateStr} -> ${nextBusDate.toISOString().split('T')[0]}`,
          completedAt: new Date(),
        },
      });

      // 4. Publish transactional outbox event
      await tx.outbox.create({
        data: {
          tenantId,
          aggregateType: 'PropertyDate',
          aggregateId: propDate.id,
          eventType: 'BusinessDateRolled',
          payload: {
            previousDate: dateStr,
            newDate: nextBusDate.toISOString().split('T')[0],
            autopostedCount: activeBookings.length,
          },
        },
      });

      return {
        success: true,
        previousDate: dateStr,
        newDate: nextBusDate.toISOString().split('T')[0],
        checkpoint,
        autopostedChargesCount: activeBookings.length,
      };
    });
  }
}
