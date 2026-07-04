import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChequesController } from './cheques.controller';
import { ChequesService } from './cheques.service';

@Module({
  imports: [AuthModule, DatabaseModule, NotificationsModule],
  controllers: [ChequesController],
  providers: [ChequesService],
})
export class ChequesModule {}
