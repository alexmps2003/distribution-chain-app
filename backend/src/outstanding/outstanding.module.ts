import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OutstandingController } from './outstanding.controller';
import { OutstandingService } from './outstanding.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [OutstandingController],
  providers: [OutstandingService],
})
export class OutstandingModule {}
