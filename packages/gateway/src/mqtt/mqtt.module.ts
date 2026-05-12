/**
 * MQTT Module
 * Módulo global NestJS que exporta MqttService
 * Gerencia conexão ao broker EMQX e distribui mensagens VDA 5050
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MqttService } from './mqtt.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
