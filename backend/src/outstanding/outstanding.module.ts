import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OutstandingController } from './outstanding.controller';
import { OutstandingService } from './outstanding.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OutstandingController],
  providers: [OutstandingService],
})
export class OutstandingModule {}
