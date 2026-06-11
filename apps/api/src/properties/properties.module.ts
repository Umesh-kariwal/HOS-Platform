import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PropertiesController],
})
export class PropertiesModule {}
