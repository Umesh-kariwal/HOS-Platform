import { Module } from '@nestjs/common';
import { GuestsController } from './guests.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GuestsController],
})
export class GuestsModule {}
