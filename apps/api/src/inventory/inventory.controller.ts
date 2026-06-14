import { Controller, Get, Post, Body, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { RevenueService } from '../revenue/revenue.service';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'))
export class InventoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revenueService: RevenueService,
    private readonly inventoryService: InventoryService,
  ) {}

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
      const today = new Date();
      today.setHours(0, 0, 0, 0);

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

        // Calculate lead time days
        const diffTime = currentDate.getTime() - today.getTime();
        const leadTimeDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        const dynamicRate = await this.revenueService.calculateDynamicRate(
          req.user.tenantId,
          branchId,
          rt.id,
          currentDate.toISOString().split('T')[0],
          leadTimeDays,
        );

        days.push({
          date: currentDate.toISOString().split('T')[0],
          totalPhysical,
          soldQty,
          availableQty,
          baseRate: Number(rt.rackRate),
          dynamicRate,
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

  @Get('locations')
  async listLocations(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    return this.inventoryService.listLocations(tenantId, branchId);
  }

  @Post('locations')
  async createLocation(@Request() req: any, @Body() body: { name: string }) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    if (!body.name || body.name.trim().length === 0) {
      throw new BadRequestException('Location name is required');
    }
    return this.inventoryService.createLocation(tenantId, branchId, body.name);
  }

  @Get('items')
  async listItems(@Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.inventoryService.listItems(tenantId);
  }

  @Post('items')
  async createItem(
    @Request() req: any,
    @Body()
    body: {
      sku: string;
      name: string;
      category: string;
      safetyStockThreshold?: number;
    },
  ) {
    const tenantId = req.user.tenantId;
    if (!body.sku || !body.name || !body.category) {
      throw new BadRequestException('sku, name, and category are required');
    }
    return this.inventoryService.createItem(tenantId, body);
  }

  @Post('stock')
  async adjustStock(
    @Request() req: any,
    @Body()
    body: {
      inventoryLocationId: string;
      itemId: string;
      quantity: number;
    },
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    if (!body.inventoryLocationId || !body.itemId || body.quantity === undefined) {
      throw new BadRequestException('inventoryLocationId, itemId, and quantity are required');
    }
    return this.inventoryService.adjustStock(tenantId, branchId, body);
  }

  @Post('minibar/consume')
  async consumeMinibar(
    @Request() req: any,
    @Body()
    body: {
      roomNumber: string;
      sku: string;
      quantity: number;
      unitPrice: number;
    },
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    if (!body.roomNumber || !body.sku || !body.quantity || body.unitPrice === undefined) {
      throw new BadRequestException('roomNumber, sku, quantity, and unitPrice are required');
    }
    return this.inventoryService.consumeMinibar(tenantId, branchId, body);
  }
}
