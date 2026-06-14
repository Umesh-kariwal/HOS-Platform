import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createLocation(tenantId: string, branchId: string, name: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      return tx.inventoryLocation.create({
        data: {
          tenantId,
          branchId,
          name,
          isActive: true,
        },
      });
    });
  }

  async listLocations(tenantId: string, branchId: string) {
    return this.prisma.inventoryLocation.findMany({
      where: {
        tenantId,
        branchId,
      },
      include: {
        stockLevels: {
          include: {
            item: true,
          },
        },
      },
    });
  }

  async createItem(
    tenantId: string,
    body: {
      sku: string;
      name: string;
      category: string;
      safetyStockThreshold?: number;
    },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // Check if SKU already exists
      const existing = await tx.item.findUnique({
        where: { sku: body.sku },
      });
      if (existing) {
        throw new BadRequestException(`Item with SKU ${body.sku} already exists`);
      }

      return tx.item.create({
        data: {
          tenantId,
          sku: body.sku,
          name: body.name,
          category: body.category,
          safetyStockThreshold: body.safetyStockThreshold || 10,
        },
      });
    });
  }

  async listItems(tenantId: string) {
    return this.prisma.item.findMany({
      where: { tenantId },
    });
  }

  async adjustStock(
    tenantId: string,
    branchId: string,
    body: {
      inventoryLocationId: string;
      itemId: string;
      quantity: number;
    },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // Verify location
      const loc = await tx.inventoryLocation.findFirst({
        where: { id: body.inventoryLocationId, branchId, tenantId },
      });
      if (!loc) {
        throw new NotFoundException('Inventory location not found');
      }

      // Verify item
      const item = await tx.item.findFirst({
        where: { id: body.itemId, tenantId },
      });
      if (!item) {
        throw new NotFoundException('Item not found');
      }

      return tx.stockLevel.upsert({
        where: {
          uq_location_item: {
            tenantId,
            inventoryLocationId: body.inventoryLocationId,
            itemId: body.itemId,
          },
        },
        create: {
          tenantId,
          inventoryLocationId: body.inventoryLocationId,
          itemId: body.itemId,
          quantity: body.quantity,
        },
        update: {
          quantity: body.quantity,
        },
        include: {
          item: true,
          inventoryLocation: true,
        },
      });
    });
  }

  async consumeMinibar(
    tenantId: string,
    branchId: string,
    body: {
      roomNumber: string;
      sku: string;
      quantity: number;
      unitPrice: number;
    },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // 1. Find the room
      const room = await tx.room.findFirst({
        where: { tenantId, branchId, roomNumber: body.roomNumber },
      });
      if (!room) {
        throw new NotFoundException(`Room ${body.roomNumber} not found`);
      }

      // 2. Find active checked-in booking
      const booking = await tx.booking.findFirst({
        where: {
          tenantId,
          branchId,
          roomId: room.id,
          status: 'checked_in',
        },
      });
      if (!booking) {
        throw new BadRequestException(`No active checked-in booking found for Room ${body.roomNumber}`);
      }

      // 3. Find primary open folio for booking
      let folio = await tx.folio.findFirst({
        where: {
          tenantId,
          bookingId: booking.id,
          status: 'open',
          payerType: 'guest',
        },
      });
      if (!folio) {
        folio = await tx.folio.findFirst({
          where: {
            tenantId,
            bookingId: booking.id,
            status: 'open',
          },
        });
      }
      if (!folio) {
        throw new BadRequestException(`No open folio found for booking ${booking.id}`);
      }

      // 4. Find the catalog item
      const item = await tx.item.findUnique({
        where: { sku: body.sku },
      });
      if (!item) {
        throw new NotFoundException(`Item with SKU ${body.sku} not found in catalog`);
      }

      // 5. Get or create minibar location for the room
      let location = await tx.inventoryLocation.findFirst({
        where: {
          tenantId,
          branchId,
          name: `Room ${room.roomNumber} Minibar`,
        },
      });
      if (!location) {
        location = await tx.inventoryLocation.create({
          data: {
            tenantId,
            branchId,
            name: `Room ${room.roomNumber} Minibar`,
            isActive: true,
          },
        });
      }

      // 6. Deduct item stock level
      const stock = await tx.stockLevel.findUnique({
        where: {
          uq_location_item: {
            tenantId,
            inventoryLocationId: location.id,
            itemId: item.id,
          },
        },
      });

      const currentQty = stock ? stock.quantity : 0;
      const newQty = Math.max(0, currentQty - body.quantity);

      await tx.stockLevel.upsert({
        where: {
          uq_location_item: {
            tenantId,
            inventoryLocationId: location.id,
            itemId: item.id,
          },
        },
        create: {
          tenantId,
          inventoryLocationId: location.id,
          itemId: item.id,
          quantity: newQty,
        },
        update: {
          quantity: newQty,
        },
      });

      // 7. Post minibar charge to guest folio (respecting routing rules)
      const rules = await tx.billingRoutingRule.findMany({
        where: { bookingId: booking.id },
      });

      const matchingRule = rules.find((r: any) => r.chargeCategory === 'minibar');

      let targetFolioId = folio.id;
      let sourceFolioId = null;

      if (matchingRule) {
        targetFolioId = matchingRule.targetFolioId;
        sourceFolioId = folio.id;
      }

      const totalChargeAmount = body.unitPrice * body.quantity;
      const chargeEntry = await tx.ledgerEntry.create({
        data: {
          tenantId,
          folioId: targetFolioId,
          sourceFolioId,
          type: 'minibar',
          amount: totalChargeAmount,
          description: `${item.name} x ${body.quantity}`,
          idempotencyKey: `minibar-${booking.id}-${item.id}-${Date.now()}`,
        },
      });

      return {
        success: true,
        bookingId: booking.id,
        folioId: targetFolioId,
        chargeEntry,
        deductedQuantity: body.quantity,
        remainingStock: newQty,
      };
    });
  }
}
