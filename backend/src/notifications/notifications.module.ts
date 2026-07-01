import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleSmsProvider } from './console-sms.provider';
import { NotificationsService } from './notifications.service';
import { NotifyLkSmsProvider } from './notify-lk-sms.provider';
import { SMS_PROVIDER } from './sms-provider.interface';
import { SmsTemplateService } from './sms-template.service';

@Module({
  imports: [ConfigModule],
  providers: [
    ConsoleSmsProvider,
    NotifyLkSmsProvider,
    NotificationsService,
    SmsTemplateService,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService, ConsoleSmsProvider, NotifyLkSmsProvider],
      useFactory: (
        configService: ConfigService,
        consoleSmsProvider: ConsoleSmsProvider,
        notifyLkSmsProvider: NotifyLkSmsProvider,
      ) => {
        const provider =
          configService.get<string>('SMS_PROVIDER')?.toLowerCase() ?? 'console';

        if (provider === 'console') {
          return consoleSmsProvider;
        }

        if (provider === 'notifylk') {
          return notifyLkSmsProvider;
        }

        throw new Error(`Unsupported SMS_PROVIDER: ${provider}`);
      },
    },
  ],
  exports: [NotificationsService, SmsTemplateService],
})
export class NotificationsModule {}
