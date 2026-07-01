import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SmsPayload = {
  message: string;
  provider: string;
  senderId: string | null;
  to: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly smsProvider: string;
  private readonly smsSenderId: string | null;

  constructor(private readonly configService: ConfigService) {
    this.smsProvider = this.configService.get<string>('SMS_PROVIDER') ?? 'stub';
    this.smsSenderId = this.configService.get<string>('SMS_SENDER_ID') ?? null;

    // Future provider placeholders:
    // SMS_API_KEY
    // SMS_API_SECRET
    // SMS_BASE_URL
  }

  sendSms(to: string, message: string): void {
    const payload: SmsPayload = {
      message,
      provider: this.smsProvider,
      senderId: this.smsSenderId,
      to,
    };

    this.logger.log(`SMS payload: ${JSON.stringify(payload)}`);
  }
}
