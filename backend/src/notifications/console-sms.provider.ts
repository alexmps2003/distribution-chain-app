import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsProvider } from './sms-provider.interface';

type SmsPayload = {
  message: string;
  provider: string;
  senderId: string | null;
  to: string;
};

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  sendSms(to: string, message: string): void {
    const payload: SmsPayload = {
      message,
      provider: 'console',
      senderId: this.configService.get<string>('SMS_SENDER_ID') ?? null,
      to,
    };

    this.logger.log(`SMS payload: ${JSON.stringify(payload)}`);
  }
}
