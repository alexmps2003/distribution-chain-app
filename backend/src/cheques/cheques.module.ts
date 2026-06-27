import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ChequesController } from './cheques.controller';
import { ChequesService } from './cheques.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ChequesController],
  providers: [ChequesService],
})
export class ChequesModule {}
