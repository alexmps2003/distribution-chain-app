import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { SmsTemplateService } from './sms-template.service';

@Module({
  imports: [ConfigModule],
  providers: [NotificationsService, SmsTemplateService],
  exports: [NotificationsService, SmsTemplateService],
})
export class NotificationsModule {}
