import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { createCorsOptions } from './config/cors.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.enableCors(createCorsOptions());

  const port = Number(process.env.API_PORT ?? 3000);
  const host = process.env.API_HOST ?? '0.0.0.0';

  await app.listen(port, host);
}

void bootstrap();
