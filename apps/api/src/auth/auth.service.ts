import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { email: dto.email },
      include: {
        role: true,
      },
    });

    if (!employee) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    if (!employee.isActive) {
      throw new UnauthorizedException('Employee user account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, employee.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    const payload = {
      employeeId: employee.id,
      tenantId: employee.tenantId,
      role: employee.roleId,
      branchId: employee.branchId,
    };

    return {
      token: this.jwtService.sign(payload),
      expires_in: 3600,
      employee: {
        id: employee.id,
        email: employee.email,
        role: employee.role?.name || 'employee',
      },
    };
  }
}
