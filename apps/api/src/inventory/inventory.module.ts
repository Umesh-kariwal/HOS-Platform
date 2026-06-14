import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RevenueModule } from '../revenue/revenue.module';

@Module({
  imports: [PrismaModule, RevenueModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
