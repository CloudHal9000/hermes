/**
 * Main Application Entry Point
 * Inicializa a aplicação NestJS com Socket.io
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Configurar CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Prefixo global de rotas
  app.setGlobalPrefix('api');

  // Configurar Socket.io
  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);

  logger.log(`🚀 Application running on port ${port}`);
  logger.log(`📡 MQTT Broker: ${process.env.MQTT_URL || 'mqtt://localhost:1883'}`);
  logger.log(`🔐 JWT Secret configured: ${!!process.env.JWT_SECRET}`);
  logger.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
}

bootstrap().catch((error) => {
  logger.error(`Failed to bootstrap application: ${error}`, error.stack);
  process.exit(1);
});
