import { Module } from '@nestjs/common';
import { NightAuditController } from './night-audit.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NightAuditController],
})
export class NightAuditModule {}
