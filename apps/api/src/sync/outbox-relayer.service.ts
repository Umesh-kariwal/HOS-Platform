import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OutboxRelayerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private intervalId?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    console.log('[Outbox Relayer] Started background worker (polling every 1000ms)...');
    this.intervalId = setInterval(async () => {
      await this.processOutbox();
    }, 1000);
  }

  onApplicationShutdown() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private async processOutbox() {
    try {
      // Fetch all active tenants from global catalog
      const tenants = await this.prisma.client.tenant.findMany();
      
      for (const tenant of tenants) {
        await this.prisma.runInTenantContext(tenant.id, async (tx: any) => {
          const unprocessed = await tx.outbox.findMany({
            where: { processed: false },
            take: 10,
          });

          if (unprocessed.length > 0) {
            console.log(`[Outbox Relayer] Processing ${unprocessed.length} events for Tenant ${tenant.name}...`);
            for (const event of unprocessed) {
              console.log(`   [Publishing Event] ${event.eventType} on ${event.aggregateType} ID ${event.aggregateId}`);
              await tx.outbox.update({
                where: { id: event.id },
                data: { processed: true },
              });
            }
          }
        });
      }
    } catch (err: any) {
      // Suppress logs during database bootstrap
    }
  }
}
