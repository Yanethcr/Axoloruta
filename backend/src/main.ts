import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Variables de entorno desde backend/.env (por ejemplo OCM_API_KEY)
try {
  process.loadEnvFile('.env');
} catch {
  /* sin .env: se usan las variables del sistema */
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: new URL(process.env.APP_URL ?? 'http://localhost:3000').origin });
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
