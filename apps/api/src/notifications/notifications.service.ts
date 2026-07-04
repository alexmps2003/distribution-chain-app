import { Inject, Injectable } from '@nestjs/common';
import { SMS_PROVIDER, type SmsProvider } from './sms-provider.interface';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(SMS_PROVIDER)
    private readonly smsProvider: SmsProvider,
  ) {}

  sendSms(to: string, message: string): Promise<void> {
    return this.smsProvider.sendSms(to, message);
  }
}
