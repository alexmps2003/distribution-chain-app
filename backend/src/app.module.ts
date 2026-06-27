import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { CustomersModule } from './customers/customers.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { ChequesModule } from './cheques/cheques.module';
import { OutstandingModule } from './outstanding/outstanding.module';

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
  ],
})
export class AppModule {}
