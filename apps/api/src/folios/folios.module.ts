import { Module } from '@nestjs/common';
import { FoliosController } from './folios.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FoliosController],
})
export class FoliosModule {}
