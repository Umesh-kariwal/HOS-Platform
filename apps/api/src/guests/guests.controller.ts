import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('guests')
@UseGuards(AuthGuard('jwt'))
export class GuestsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getGuests(
    @Request() req: any,
    @Query('search') search?: string,
  ) {
    const tenantId = req.user.tenantId;

    const whereClause: any = { tenantId };

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.guest.findMany({
      where: whereClause,
      orderBy: {
        lastName: 'asc',
      },
    });
  }

  @Get(':id')
  async getGuestById(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;

    const guest = await this.prisma.guest.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!guest) {
      throw new NotFoundException('Guest not found');
    }

    return guest;
  }

  @Post()
  async createGuest(
    @Request() req: any,
    @Body() body: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      profileMetadata?: any;
    },
  ) {
    const tenantId = req.user.tenantId;

    return this.prisma.guest.create({
      data: {
        tenantId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        profileMetadata: body.profileMetadata,
      },
    });
  }

  @Put(':id')
  async updateGuest(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      profileMetadata?: any;
    },
  ) {
    const tenantId = req.user.tenantId;

    // Verify ownership first via findFirst
    const guest = await this.prisma.guest.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!guest) {
      throw new NotFoundException('Guest not found');
    }

    return this.prisma.guest.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        profileMetadata: body.profileMetadata,
      },
    });
  }
}
