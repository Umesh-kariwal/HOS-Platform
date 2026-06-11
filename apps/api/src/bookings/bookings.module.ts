import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BookingsController],
})
export class BookingsModule {}
