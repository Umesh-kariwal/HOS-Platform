import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantContextMiddleware } from './tenant/tenant-context.middleware';
import { RoomsModule } from './rooms/rooms.module';
import { BookingsModule } from './bookings/bookings.module';
import { NightAuditModule } from './night-audit/night-audit.module';
import { GuestsModule } from './guests/guests.module';
import { PropertiesModule } from './properties/properties.module';
import { InventoryModule } from './inventory/inventory.module';
import { FoliosModule } from './folios/folios.module';
import { SyncModule } from './sync/sync.module';
import { PeripheralsModule } from './peripherals/peripherals.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { RevenueModule } from './revenue/revenue.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RoomsModule,
    BookingsModule,
    NightAuditModule,
    GuestsModule,
    PropertiesModule,
    InventoryModule,
    FoliosModule,
    SyncModule,
    PeripheralsModule,
    MaintenanceModule,
    DispatchModule,
    RevenueModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes('*');
  }
}
