import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StatementsController],
  providers: [StatementsService],
})
export class StatementsModule {}
