import { Module } from '@nestjs/common';
import { PeripheralsController } from './peripherals.controller';
import { PeripheralsService } from './peripherals.service';
import { IncidentsGateway } from './incidents.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PeripheralsController],
  providers: [PeripheralsService, IncidentsGateway],
  exports: [PeripheralsService, IncidentsGateway],
})
export class PeripheralsModule {}
