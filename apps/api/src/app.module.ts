import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { CustomersModule } from './customers/customers.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { ChequesModule } from './cheques/cheques.module';
import { OutstandingModule } from './outstanding/outstanding.module';
import { StatementsModule } from './statements/statements.module';
import { AgingModule } from './aging/aging.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './search/search.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    DatabaseModule,
    CustomersModule,
    InvoicesModule,
    PaymentsModule,
    ChequesModule,
    OutstandingModule,
    StatementsModule,
    AgingModule,
    DashboardModule,
    SearchModule,
    AuthModule,
    NotificationsModule,
  ],
})
export class AppModule {}
