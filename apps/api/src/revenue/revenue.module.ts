import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RevenueService } from './revenue.service';
import { RevenueController } from './revenue.controller';

@Module({
  controllers: [RevenueController],
  providers: [RevenueService, PrismaService],
  exports: [RevenueService],
})
export class RevenueModule {}
