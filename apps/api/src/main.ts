import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (
        origin === 'http://localhost:3000' ||
        origin === 'http://localhost:3001' ||
        origin === 'https://distribution-chain-app.vercel.app' ||
        /https:\/\/.*\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
  });

  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);

  console.log(`API running on http://localhost:${port}/api`);
}

void bootstrap();
