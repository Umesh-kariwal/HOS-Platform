import { Controller, Get, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'))
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getAuditLogs(
    @Request() req: any,
    @Query('entityName') entityName?: string,
    @Query('actorId') actorId?: string,
  ) {
    const tenantId = req.user.tenantId;

    // Resolve user's role name
    const userRole = await this.prisma.runInTenantContext(tenantId, async (tx) => {
      return tx.role.findUnique({
        where: { id: req.user.role },
      });
    });

    if (!userRole || userRole.name.toLowerCase() !== 'manager') {
      throw new ForbiddenException('Only managers can access system audit logs.');
    }

    return this.auditService.findAll(tenantId, { entityName, actorId });
  }
}
