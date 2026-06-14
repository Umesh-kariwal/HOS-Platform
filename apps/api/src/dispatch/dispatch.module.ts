import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { DispatchGateway } from './dispatch.gateway';

@Module({
  controllers: [DispatchController],
  providers: [DispatchService, PrismaService, DispatchGateway],
  exports: [DispatchService, DispatchGateway],
})
export class DispatchModule {}
