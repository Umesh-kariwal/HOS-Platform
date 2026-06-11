import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>('permissions', context.getHandler());
    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Injected by JwtStrategy

    if (!user || !user.role || !user.tenantId) {
      return false;
    }

    // Resolve role permissions from DB, strictly isolated by tenant_id
    const permissions = await this.prisma.runInTenantContext(user.tenantId, async (tx) => {
      return tx.rolePermission.findMany({
        where: {
          roleId: user.role,
          tenantId: user.tenantId,
        },
        select: {
          resource: true,
          action: true,
        },
      });
    });

    const userPermissions = permissions.map((p: any) => `${p.resource}.${p.action}`);
    const hasPermission = requiredPermissions.every(p => userPermissions.includes(p));

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}
