import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsProvider } from './sms-provider.interface';

@Injectable()
export class NotifyLkSmsProvider implements SmsProvider {
  private readonly apiKey: string | null;
  private readonly baseUrl: string | null;
  private readonly senderId: string | null;
  private readonly userId: string | null;

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('NOTIFY_LK_API_KEY') ?? null;
    this.baseUrl = configService.get<string>('NOTIFY_LK_BASE_URL') ?? null;
    this.senderId =
      configService.get<string>('NOTIFY_LK_SENDER_ID') ??
      configService.get<string>('SMS_SENDER_ID') ??
      null;
    this.userId = configService.get<string>('NOTIFY_LK_USER_ID') ?? null;
  }

  sendSms(to: string, message: string): void {
    void to;
    void message;

    if (!this.isConfigured()) {
      throw new Error('Not implemented');
    }

    throw new Error('Not implemented');
  }

  private isConfigured() {
    return Boolean(this.apiKey && this.baseUrl && this.senderId && this.userId);
  }
}
