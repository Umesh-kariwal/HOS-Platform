import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(AuthGuard('jwt'))
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

  @UseGuards(AuthGuard('jwt'))
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
