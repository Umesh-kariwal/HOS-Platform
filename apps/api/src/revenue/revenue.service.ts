import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RevenueService {
  constructor(private readonly prisma: PrismaService) {}

  async createRule(
    tenantId: string,
    branchId: string,
    body: {
      roomTypeId: string;
      ruleType: string;
      triggerValue: number;
      adjustmentPercent: number;
    },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const roomType = await tx.roomType.findFirst({
        where: { id: body.roomTypeId, branchId },
      });
      if (!roomType) {
        throw new NotFoundException('Room type not found');
      }

      return tx.revenuePricingRule.create({
        data: {
          tenantId,
          branchId,
          roomTypeId: body.roomTypeId,
          ruleType: body.ruleType,
          triggerValue: body.triggerValue,
          adjustmentPercent: body.adjustmentPercent,
          isActive: true,
        },
        include: {
          roomType: true,
        },
      });
    });
  }

  async getRules(tenantId: string, branchId: string) {
    return this.prisma.revenuePricingRule.findMany({
      where: { tenantId, branchId },
      include: { roomType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteRule(tenantId: string, branchId: string, id: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const rule = await tx.revenuePricingRule.findFirst({
        where: { id, branchId },
      });
      if (!rule) {
        throw new NotFoundException('Pricing rule not found');
      }
      await tx.revenuePricingRule.delete({ where: { id } });
      return { success: true };
    });
  }

  async calculateDynamicRate(
    tenantId: string,
    branchId: string,
    roomTypeId: string,
    dateStr: string,
    leadTimeDays: number,
  ): Promise<number> {
    const targetDate = new Date(dateStr);
    
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, tenantId, branchId },
    });
    if (!roomType) {
      throw new NotFoundException('Room type not found');
    }
    const baseRate = Number(roomType.rackRate);

    const totalRoomsCount = await this.prisma.room.count({
      where: { roomTypeId, tenantId, branchId },
    });
    if (totalRoomsCount === 0) {
      return baseRate;
    }

    const activeBookingsCount = await this.prisma.booking.count({
      where: {
        tenantId,
        branchId,
        status: { in: ['reserved', 'checked_in'] },
        room: { roomTypeId },
        checkInDate: { lte: targetDate },
        checkOutDate: { gt: targetDate },
      },
    });

    const occupancyRate = activeBookingsCount / totalRoomsCount;

    const rules = await this.prisma.revenuePricingRule.findMany({
      where: {
        roomTypeId,
        tenantId,
        branchId,
        isActive: true,
      },
    });

    let adjustedRate = baseRate;

    for (const rule of rules) {
      const trigger = Number(rule.triggerValue);
      const adjustment = Number(rule.adjustmentPercent);
      let isTriggered = false;

      if (rule.ruleType === 'occupancy_gte' && occupancyRate >= trigger) {
        isTriggered = true;
      } else if (rule.ruleType === 'occupancy_lte' && occupancyRate <= trigger) {
        isTriggered = true;
      } else if (rule.ruleType === 'lead_time_lte' && leadTimeDays <= trigger) {
        isTriggered = true;
      }

      if (isTriggered) {
        adjustedRate = adjustedRate * (1 + adjustment);
      }
    }

    return Math.max(0, Number(adjustedRate.toFixed(2)));
  }
}
