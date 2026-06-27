import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AgingController } from './aging.controller';
import { AgingService } from './aging.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AgingController],
  providers: [AgingService],
})
export class AgingModule {}
