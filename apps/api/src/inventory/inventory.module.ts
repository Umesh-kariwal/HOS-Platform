import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RevenueModule } from '../revenue/revenue.module';

@Module({
  imports: [PrismaModule, RevenueModule],
  controllers: [InventoryController],
})
export class InventoryModule {}
