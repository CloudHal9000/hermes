/**
 * Fleet Module
 * Módulo NestJS para gerenciamento de frotas multi-tenant
 * Exporta controller, gateway e service
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantFleetService } from './tenant-fleet.service';
import { FleetsController } from './fleets.controller';
import { FleetsGateway } from './fleets.gateway';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [
    MqttModule,
    // JWT para validação de tokens em Socket.io
    // Configurar com a mesma chave secreta do guard JWT global
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [TenantFleetService, FleetsGateway],
  controllers: [FleetsController],
  exports: [TenantFleetService],
})
export class FleetModule {}
