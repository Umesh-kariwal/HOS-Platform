import { Module } from '@nestjs/common';
import { NightAuditController } from './night-audit.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RevenueModule } from '../revenue/revenue.module';

@Module({
  imports: [PrismaModule, RevenueModule],
  controllers: [NightAuditController],
})
export class NightAuditModule {}
