import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ChequesController } from './cheques.controller';
import { ChequesService } from './cheques.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ChequesController],
  providers: [ChequesService],
})
export class ChequesModule {}
