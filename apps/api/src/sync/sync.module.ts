import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { OutboxRelayerService } from './outbox-relayer.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SyncController],
  providers: [OutboxRelayerService],
})
export class SyncModule {}
