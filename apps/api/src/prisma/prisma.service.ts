import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@hos/database';
import { tenantContextStore } from '../tenant/tenant-context.store';
import { AsyncLocalStorage } from 'async_hooks';

export const transactionClientStore = new AsyncLocalStorage<any>();

function flattenWhere(where: any): any {
  if (!where || typeof where !== 'object') return where;
  
  if (Array.isArray(where)) {
    return where.map(item => flattenWhere(item));
  }
  
  const flattened = { ...where };
  for (const key of Object.keys(flattened)) {
    const value = flattened[key];
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if (key.includes('_')) {
        // It's a composite key (like tenantId_branchId), flatten its fields
        delete flattened[key];
        Object.assign(flattened, flattenWhere(value));
      } else {
        flattened[key] = flattenWhere(value);
      }
    }
  }
  return flattened;
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;
  public readonly client: any;

  constructor() {
    this.prisma = new PrismaClient();
    const prismaServiceInstance = this; // Capture class instance context
    this.client = this.prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const context = tenantContextStore.getStore();
            const tenantId = context?.tenantId;
            const tx = transactionClientStore.getStore();
            const clientToUse = tx || prismaServiceInstance.prisma;
            
            // List of models that do NOT have tenantId column (global catalog)
            const globalModels = ['Tenant', 'BranchRoute'];

            if (tenantId && !globalModels.includes(model)) {
              const anyArgs = args as any;

              // 1. Map findUnique and findUniqueOrThrow to findFirst/findFirstOrThrow
              // to bypass Prisma strict unique field argument validation.
              if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
                const mappedOperation = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
                const flatWhere = flattenWhere(anyArgs.where);
                anyArgs.where = {
                  AND: [
                    flatWhere || {},
                    { tenantId }
                  ]
                };
                return (clientToUse as any)[model][mappedOperation](anyArgs);
              }

              // 2. Pre-flight Tenant Scoping Check for single-row writes (update/delete)
              if (operation === 'update' || operation === 'delete') {
                const flatWhere = flattenWhere(anyArgs.where);
                const record = await (clientToUse as any)[model].findFirst({
                  where: {
                    AND: [
                      flatWhere || {},
                      { tenantId }
                    ]
                  }
                });
                if (!record) {
                  throw new Error(`Record not found or access denied for model ${model} under active tenant context.`);
                }
                // Allow write operation to proceed on verified row
                return query(args);
              }

              // 3. Handle Create/CreateMany versus standard filters (findMany, updateMany, etc.)
              const isCreate = ['create', 'createMany'].includes(operation);
              
              if (!isCreate) {
                anyArgs.where = flattenWhere(anyArgs.where);
                const existingWhere = anyArgs.where;
                if (existingWhere) {
                  anyArgs.where = {
                    AND: [
                      existingWhere,
                      { tenantId }
                    ]
                  };
                } else {
                  anyArgs.where = { tenantId };
                }
              } else {
                if (anyArgs.data) {
                  if (Array.isArray(anyArgs.data)) {
                    anyArgs.data.forEach((item: any) => {
                      item.tenantId = tenantId;
                    });
                  } else {
                    anyArgs.data.tenantId = tenantId;
                  }
                }
              }
            }
            return query(args);
          },
        },
      },
    });
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  // Model getters delegate queries directly to the tenant-scoped client
  get tenant() { return this.client.tenant; }
  get branchRoute() { return this.client.branchRoute; }
  get branch() { return this.client.branch; }
  get role() { return this.client.role; }
  get rolePermission() { return this.client.rolePermission; }
  get employee() { return this.client.employee; }
  get floor() { return this.client.floor; }
  get roomType() { return this.client.roomType; }
  get room() { return this.client.room; }
  get inventorySnapshot() { return this.client.inventorySnapshot; }
  get guest() { return this.client.guest; }
  get booking() { return this.client.booking; }
  get folio() { return this.client.folio; }
  get billingRoutingRule() { return this.client.billingRoutingRule; }
  get ledgerEntry() { return this.client.ledgerEntry; }
  get propertyDate() { return this.client.propertyDate; }
  get nightAuditCheckpoint() { return this.client.nightAuditCheckpoint; }
  get inventoryLocation() { return this.client.inventoryLocation; }
  get item() { return this.client.item; }
  get stockLevel() { return this.client.stockLevel; }
  get parkingSlot() { return this.client.parkingSlot; }
  get valetTicket() { return this.client.valetTicket; }
  get visitorRecord() { return this.client.visitorRecord; }
  get lostAndFoundItem() { return this.client.lostAndFoundItem; }
  get incidentLog() { return this.client.incidentLog; }
  get offlineSyncRecord() { return this.client.offlineSyncRecord; }
  get auditLog() { return this.client.auditLog; }
  get outbox() { return this.client.outbox; }

  // Transaction wrapping helper to enforce PostgreSQL RLS
  async runInTenantContext<T>(tenantId: string, fn: (tx: any) => Promise<T>): Promise<T> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new Error(`Security Exception: Invalid tenant ID format for RLS context propagation: ${tenantId}`);
    }

    return this.client.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      return tenantContextStore.run({ tenantId }, () => {
        return transactionClientStore.run(tx, () => {
          return fn(tx);
        });
      });
    });
  }
}
