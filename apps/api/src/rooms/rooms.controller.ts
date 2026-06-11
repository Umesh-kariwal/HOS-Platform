import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('rooms')
@UseGuards(AuthGuard('jwt'))
export class RoomsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getRooms(@Request() req: any) {
    const branchId = req.user.branchId;
    return this.prisma.room.findMany({
      where: { branchId },
      include: {
        roomType: true,
        floor: true,
      },
      orderBy: {
        roomNumber: 'asc',
      },
    });
  }

  @Post()
  async createRoom(
    @Request() req: any,
    @Body() body: {
      roomNumber: string;
      roomTypeId: string;
      floorId: string;
    },
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;

    return this.prisma.room.create({
      data: {
        tenantId,
        branchId,
        roomNumber: body.roomNumber,
        roomTypeId: body.roomTypeId,
        floorId: body.floorId,
        physicalStatus: 'clean',
        occupancyStatus: 'vacant',
      },
      include: {
        roomType: true,
        floor: true,
      },
    });
  }

  @Get('types')
  async getRoomTypes(@Request() req: any) {
    const branchId = req.user.branchId;
    return this.prisma.roomType.findMany({
      where: { branchId },
      orderBy: {
        code: 'asc',
      },
    });
  }

  @Post('types')
  async createRoomType(
    @Request() req: any,
    @Body() body: {
      code: string;
      name: string;
      rackRate: number;
      maxOccupancy?: number;
      cleaningDurationMinutes?: number;
    },
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;

    return this.prisma.roomType.create({
      data: {
        tenantId,
        branchId,
        code: body.code,
        name: body.name,
        rackRate: body.rackRate,
        maxOccupancy: body.maxOccupancy || 2,
        cleaningDurationMinutes: body.cleaningDurationMinutes || 30,
      },
    });
  }

  @Get('floors')
  async getFloors(@Request() req: any) {
    const branchId = req.user.branchId;
    return this.prisma.floor.findMany({
      where: { branchId },
      orderBy: {
        floorNumber: 'asc',
      },
    });
  }

  @Post('floors')
  async createFloor(
    @Request() req: any,
    @Body() body: {
      name: string;
      floorNumber: number;
    },
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;

    return this.prisma.floor.create({
      data: {
        tenantId,
        branchId,
        name: body.name,
        floorNumber: body.floorNumber,
      },
    });
  }

  @Post(':id/status')
  async updateRoomStatus(
    @Param('id') id: string,
    @Body() body: { physicalStatus: string },
  ) {
    return this.prisma.room.update({
      where: { id },
      data: {
        physicalStatus: body.physicalStatus,
      },
    });
  }
}
