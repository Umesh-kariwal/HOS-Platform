import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RoomsController],
})
export class RoomsModule {}
