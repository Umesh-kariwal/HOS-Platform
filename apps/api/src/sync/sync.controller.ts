import { Controller, Get, Post, Body, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('sync')
@UseGuards(AuthGuard('jwt'))
export class SyncController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('push')
  async push(
    @Request() req: any,
    @Body() body: {
      deviceId: string;
      operations: Array<{
        id: string;
        action: string;
        payload: any;
      }>;
    },
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;

    if (!body.deviceId || !body.operations || !Array.isArray(body.operations)) {
      throw new BadRequestException('Invalid push sync format');
    }

    const results: any[] = [];

    await this.prisma.runInTenantContext(tenantId, async (tx) => {
      for (const op of body.operations) {
        try {
          // Record sync operation in DB
          const record = await tx.offlineSyncRecord.create({
            data: {
              tenantId,
              branchId,
              deviceId: body.deviceId,
              action: op.action,
              payload: op.payload,
              status: 'processed',
            },
          });

          // Mock process the operation by publishing an outbox event
          await tx.outbox.create({
            data: {
              tenantId,
              aggregateType: 'OfflineSyncRecord',
              aggregateId: record.id,
              eventType: `OfflineActionProcessed:${op.action}`,
              payload: { action: op.action, payload: op.payload },
            },
          });

          results.push({ id: op.id, status: 'success', recordId: record.id });
        } catch (err: any) {
          results.push({ id: op.id, status: 'failed', error: err.message });
        }
      }
    });

    return {
      deviceId: body.deviceId,
      processedCount: results.length,
      results,
    };
  }

  @Get('pull')
  async pull(
    @Request() req: any,
    @Query('since') since?: string,
  ) {
    const tenantId = req.user.tenantId;
    const sinceDate = since ? new Date(since) : new Date(0);

    if (isNaN(sinceDate.getTime())) {
      throw new BadRequestException('Invalid since date format');
    }

    // Query outbox events for this tenant since the given date
    const events = await this.prisma.outbox.findMany({
      where: {
        tenantId,
        createdAt: { gt: sinceDate },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      pullTimestamp: new Date().toISOString(),
      events,
    };
  }
}
