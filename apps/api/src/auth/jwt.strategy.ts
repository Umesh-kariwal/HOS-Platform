import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback_secret',
    });
  }

  async validate(payload: any) {
    if (!payload.employeeId || !payload.tenantId) {
      throw new UnauthorizedException('Invalid JWT token payload');
    }

    // 1. Verify tenant existence and active status in global catalog
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: payload.tenantId },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant does not exist');
    }

    if (tenant.status !== 'active') {
      throw new UnauthorizedException('Tenant account is not active');
    }

    // 2. Verify employee existence, active status, and tenant mapping in tenant database
    const employee = await this.prisma.runInTenantContext(payload.tenantId, async (tx) => {
      return tx.employee.findUnique({
        where: { id: payload.employeeId },
      });
    });

    if (!employee) {
      throw new UnauthorizedException('Employee does not exist or has been deleted');
    }

    if (!employee.isActive) {
      throw new UnauthorizedException('Employee user account is deactivated');
    }

    if (employee.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Security Breach: Employee tenant context mismatch');
    }

    return { 
      employeeId: payload.employeeId, 
      tenantId: payload.tenantId, 
      role: payload.role,
      branchId: payload.branchId
    };
  }
}
