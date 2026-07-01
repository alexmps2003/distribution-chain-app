import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AgingController } from './aging.controller';
import { AgingService } from './aging.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [AgingController],
  providers: [AgingService],
})
export class AgingModule {}
