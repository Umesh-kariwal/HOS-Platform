import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('properties')
@UseGuards(AuthGuard('jwt'))
export class PropertiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getProperties(@Request() req: any) {
    const tenantId = req.user.tenantId;

    return this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: {
        name: 'asc',
      },
    });
  }

  @Post()
  async createProperty(
    @Request() req: any,
    @Body() body: {
      name: string;
      timezone?: string;
      currency?: string;
    },
  ) {
    const tenantId = req.user.tenantId;

    return this.prisma.branch.create({
      data: {
        tenantId,
        name: body.name,
        timezone: body.timezone || 'UTC',
        currency: body.currency || 'USD',
      },
    });
  }
}
