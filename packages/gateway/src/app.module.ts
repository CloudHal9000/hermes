/**
 * App Module
 * Módulo raiz da aplicação NestJS
 * Integra todos os módulos incluindo MQTT e Fleet
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { MqttModule } from './mqtt/mqtt.module';
import { FleetModule } from './fleet/fleet.module';

@Module({
  imports: [
    // Variáveis de ambiente
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // JWT global para validação de tokens
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),

    // Banco de dados (Prisma)
    PrismaModule,

    // MQTT para VDA 5050
    MqttModule,

    // Fleet management multi-tenant
    FleetModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
