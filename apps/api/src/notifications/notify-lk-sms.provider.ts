import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsProvider } from './sms-provider.interface';

type NotifyLkResponse = {
  data?: unknown;
  status?: unknown;
};

@Injectable()
export class NotifyLkSmsProvider implements SmsProvider {
  private readonly apiKey: string | null;
  private readonly endpoint = 'https://app.notify.lk/api/v1/send';
  private readonly senderId: string | null;
  private readonly userId: string | null;

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('NOTIFY_LK_API_KEY') ?? null;
    this.senderId =
      configService.get<string>('NOTIFY_LK_SENDER_ID') ?? 'NotifyDEMO';
    this.userId = configService.get<string>('NOTIFY_LK_USER_ID') ?? null;
  }

  async sendSms(to: string, message: string): Promise<void> {
    const normalizedPhoneNumber = this.normalizePhoneNumber(to);
    const { apiKey, senderId, userId } = this.getConfig();

    const params = new URLSearchParams({
      api_key: apiKey,
      message,
      sender_id: senderId,
      to: normalizedPhoneNumber,
      user_id: userId,
    });

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const responseBody = (await response
      .json()
      .catch(() => null)) as NotifyLkResponse | null;

    if (!response.ok) {
      throw new Error(`Notify.lk SMS request failed with ${response.status}`);
    }

    if (responseBody?.status !== 'success') {
      throw new Error('Notify.lk SMS request did not return success');
    }
  }

  private getConfig() {
    const apiKey = this.apiKey;
    const senderId = this.senderId;
    const userId = this.userId;
    const missingConfig: string[] = [];

    if (!userId) {
      missingConfig.push('NOTIFY_LK_USER_ID');
    }

    if (!apiKey) {
      missingConfig.push('NOTIFY_LK_API_KEY');
    }

    if (!senderId) {
      missingConfig.push('NOTIFY_LK_SENDER_ID');
    }

    if (!apiKey || !senderId || !userId) {
      throw new Error(
        `Notify.lk SMS configuration is missing: ${missingConfig.join(', ')}`,
      );
    }

    return {
      apiKey,
      senderId,
      userId,
    };
  }

  private normalizePhoneNumber(phoneNumber: string) {
    const digits = phoneNumber.replace(/\D/g, '');
    let normalizedNumber = digits;

    if (digits.startsWith('0')) {
      normalizedNumber = `94${digits.slice(1)}`;
    } else if (digits.startsWith('94')) {
      normalizedNumber = digits;
    } else if (digits.length === 9) {
      normalizedNumber = `94${digits}`;
    }

    if (!/^94\d{9}$/.test(normalizedNumber)) {
      throw new Error(
        'Invalid Sri Lankan phone number. Expected format like 9471XXXXXXX.',
      );
    }

    return normalizedNumber;
  }
}
