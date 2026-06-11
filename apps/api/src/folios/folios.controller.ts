import { Controller, Get, Post, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Controller('folios')
@UseGuards(AuthGuard('jwt'))
export class FoliosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async getFolioById(@Param('id') id: string) {
    const folio = await this.prisma.folio.findUnique({
      where: { id },
      include: {
        ledgerEntries: true,
        billingRoutingRules: true,
        payerGuest: true,
      },
    });

    if (!folio) {
      throw new BadRequestException('Folio not found');
    }

    const ledgerEntries = folio.ledgerEntries || [];
    let totalCharges = 0;
    let totalPayments = 0;

    ledgerEntries.forEach((entry: any) => {
      const amt = Number(entry.amount);
      if (entry.type === 'payment') {
        totalPayments += amt;
      } else {
        totalCharges += amt;
      }
    });

    const balance = totalCharges - totalPayments;

    return {
      ...folio,
      totalCharges,
      totalPayments,
      balance,
    };
  }

  @Post(':id/charges')
  async postCharge(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: {
      amount: number;
      description: string;
      category: string; // e.g. food_and_beverage, room_charge
      idempotencyKey?: string;
    },
  ) {
    const tenantId = req.user.tenantId;
    const idempotency = body.idempotencyKey || uuidv4();

    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    if (!body.description) {
      throw new BadRequestException('Description is required');
    }
    if (!body.category) {
      throw new BadRequestException('Category is required');
    }

    // 1. Fetch origin folio
    const originFolio = await this.prisma.folio.findUnique({
      where: { id },
    });

    if (!originFolio) {
      throw new BadRequestException('Folio not found');
    }

    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // 2. Fetch routing rules for this booking
      const rules = await tx.billingRoutingRule.findMany({
        where: { bookingId: originFolio.bookingId },
      });

      // 3. Find if any rule matches the category
      const matchingRule = rules.find((r: any) => r.chargeCategory === body.category);

      let targetFolioId = id;
      let sourceFolioId = null;

      if (matchingRule) {
        targetFolioId = matchingRule.targetFolioId;
        sourceFolioId = id; // Track origin folio as source
      }

      // 4. Create Ledger Entry for charge
      return tx.ledgerEntry.create({
        data: {
          tenantId,
          folioId: targetFolioId,
          sourceFolioId,
          type: body.category, // Use category as type (e.g. food_and_beverage)
          amount: body.amount,
          description: body.description,
          idempotencyKey: idempotency,
        },
      });
    });
  }

  @Post(':id/payments')
  async postPayment(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: {
      amount: number;
      description?: string;
      idempotencyKey?: string;
    },
  ) {
    const tenantId = req.user.tenantId;
    const idempotency = body.idempotencyKey || uuidv4();

    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const folio = await this.prisma.folio.findUnique({
      where: { id },
    });

    if (!folio) {
      throw new BadRequestException('Folio not found');
    }

    // Enqueue payment asynchronously to simulate Async Payment Queue
    setTimeout(async () => {
      try {
        await this.prisma.runInTenantContext(tenantId, async (tx) => {
          await tx.ledgerEntry.create({
            data: {
              tenantId,
              folioId: id,
              type: 'payment',
              amount: body.amount,
              description: body.description || 'Credit Card Payment (Settled)',
              idempotencyKey: idempotency,
            },
          });
        });
        console.log(`[Payment Queue] Settled payment of $${body.amount} for Folio ${id}`);
      } catch (err: any) {
        console.error(`[Payment Queue] Failed to settle payment for Folio ${id}:`, err.message);
      }
    }, 1000);

    return {
      status: 'processing',
      message: 'Payment processing enqueued asynchronously',
      idempotencyKey: idempotency,
    };
  }

  @Post(':id/route')
  async createRoutingRule(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: {
      chargeCategory: string;
      splitType: string;
      value: number;
      targetFolioId: string;
    },
  ) {
    const tenantId = req.user.tenantId;

    if (!body.chargeCategory || !body.splitType || !body.value || !body.targetFolioId) {
      throw new BadRequestException('All routing fields are required');
    }

    const folio = await this.prisma.folio.findUnique({
      where: { id },
    });

    if (!folio) {
      throw new BadRequestException('Folio not found');
    }

    const targetFolio = await this.prisma.folio.findUnique({
      where: { id: body.targetFolioId },
    });

    if (!targetFolio) {
      throw new BadRequestException('Target folio not found');
    }

    return this.prisma.billingRoutingRule.create({
      data: {
        tenantId,
        bookingId: folio.bookingId,
        chargeCategory: body.chargeCategory,
        splitType: body.splitType,
        value: body.value,
        targetFolioId: body.targetFolioId,
      },
    });
  }
}
