import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/notifications/notifications.service';

const TEST_MESSAGE =
  'Distribio test SMS. If you received this, SMS integration is working.';

async function main() {
  const phoneNumber = process.argv
    .slice(2)
    .find((arg) => arg !== '--')
    ?.trim();

  if (!phoneNumber) {
    throw new Error('Phone number argument is required.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const notificationsService = app.get(NotificationsService);
    await notificationsService.sendSms(phoneNumber, TEST_MESSAGE);
    console.log('Test SMS request completed.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
