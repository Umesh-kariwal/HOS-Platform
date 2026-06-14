import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    tenantId: string;
    actorId?: string;
    action: string;
    entityName: string;
    entityId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: data.tenantId,
        actorId: data.actorId || null,
        action: data.action,
        entityName: data.entityName,
        entityId: data.entityId,
        oldValues: data.oldValues || null,
        newValues: data.newValues || null,
        ipAddress: data.ipAddress,
      },
    });
  }

  async findAll(tenantId: string, query: { entityName?: string; actorId?: string }) {
    const whereClause: any = { tenantId };
    if (query.entityName) {
      whereClause.entityName = query.entityName;
    }
    if (query.actorId) {
      whereClause.actorId = query.actorId;
    }

    return this.prisma.auditLog.findMany({
      where: whereClause,
      include: {
        actor: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
