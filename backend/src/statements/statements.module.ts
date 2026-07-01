import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [StatementsController],
  providers: [StatementsService],
})
export class StatementsModule {}
