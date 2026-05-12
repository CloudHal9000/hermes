/**
 * MQTT Service
 * Gerencia conexão ao broker EMQX e distribui mensagens VDA 5050 por tenant
 * Implementa multi-tenancy via topic namespacing
 */

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import { EventEmitter2 } from 'eventemitter2';
import {
  AGVState,
  ConnectionState,
  VDA5050Message,
} from './vda5050.types';

/**
 * Evento emitido quando um AGV publica seu estado
 */
export interface AgvStateEvent {
  tenantId: string;
  manufacturer: string;
  serialNumber: string;
  state: AGVState;
}

/**
 * Evento emitido quando a conexão de um AGV muda
 */
export interface AgvConnectionEvent {
  tenantId: string;
  manufacturer: string;
  serialNumber: string;
  state: ConnectionState;
}

/**
 * Subscrição a um tenant no MQTT
 */
interface TenantSubscription {
  tenantId: string;
  subscribed: boolean;
  agvCount: number; // Número de AGVs reportados deste tenant
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient | null = null;
  private tenantSubscriptions = new Map<string, TenantSubscription>();

  /**
   * EventEmitter2 é thread-safe e suporta wildcards
   * Emite eventos para TenantFleetService via DI
   */
  private eventEmitter: EventEmitter2;

  constructor(private configService: ConfigService) {
    this.eventEmitter = new EventEmitter2();
  }

  /**
   * Inicializa conexão ao broker MQTT na inicialização do módulo
   */
  async onModuleInit(): Promise<void> {
    const brokerUrl = this.configService.get<string>(
      'MQTT_URL',
      'mqtt://localhost:1883',
    );
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');

    const options: mqtt.IClientOptions = {
      // Reconexão automática
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,

      // Auth
      ...(username && { username }),
      ...(password && { password }),

      // Keep-alive
      keepalive: 60,

      // Modo clean start para maior confiabilidade
      clean: true,

      // Client ID único por instância
      clientId: `rmf-gateway-${Date.now()}`,
    };

    try {
      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', () => {
        this.logger.log(`Connected to MQTT broker: ${brokerUrl}`);
      });

      this.client.on('error', (error: Error) => {
        this.logger.error(`MQTT error: ${error.message}`);
      });

      this.client.on('message', (topic: string, payload: Buffer) => {
        this.handleMessage(topic, payload);
      });

      this.client.on('disconnect', () => {
        this.logger.warn('Disconnected from MQTT broker');
      });

      // Aguarda conexão inicial
      try {
        await this.waitForConnection(10000);
      } catch (error) {
        this.logger.warn(
          'MQTT broker unavailable at startup, will retry automatically',
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize MQTT client: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Aguarda conexão ao broker com timeout
   */
  private waitForConnection(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client?.connected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`MQTT connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.client?.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Desconecta do broker na destruição do módulo
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      return new Promise((resolve) => {
        this.client!.end(false, () => {
          this.logger.log('Disconnected from MQTT broker');
          resolve();
        });
      });
    }
  }

  /**
   * Subscreve nos tópicos de um tenant específico
   * Tópicos:
   * - /{tenantId}/v2/+/+/state → AGVState
   * - /{tenantId}/v2/+/+/connection → ConnectionState
   * - /{tenantId}/v2/+/+/action → OrderAction
   *
   * @param tenantId ID do tenant
   */
  async subscribeTenant(tenantId: string): Promise<void> {
    if (!this.client || !this.client.connected) {
      throw new Error('MQTT client not connected');
    }

    // Verificar se já está subscrito
    if (this.tenantSubscriptions.has(tenantId)) {
      this.logger.debug(`Tenant ${tenantId} already subscribed`);
      return;
    }

    try {
      // Subscrever em todos os tópicos do tenant
      const topics = [
        `${tenantId}/v2/+/+/state`,
        `${tenantId}/v2/+/+/connection`,
        `${tenantId}/v2/+/+/action`,
      ];

      this.client.subscribe(topics, { qos: 1 }, (error) => {
        if (error) {
          this.logger.error(`Failed to subscribe to tenant ${tenantId}: ${error}`);
          return;
        }
        this.logger.log(`Subscribed to tenant ${tenantId}: ${topics.join(', ')}`);
      });

      // Registrar subscription
      this.tenantSubscriptions.set(tenantId, {
        tenantId,
        subscribed: true,
        agvCount: 0,
      });
    } catch (error) {
      this.logger.error(
        `Error subscribing to tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Desinscreve de um tenant
   */
  async unsubscribeTenant(tenantId: string): Promise<void> {
    if (!this.client || !this.client.connected) {
      return;
    }

    try {
      const topics = [
        `${tenantId}/v2/+/+/state`,
        `${tenantId}/v2/+/+/connection`,
        `${tenantId}/v2/+/+/action`,
      ];

      this.client.unsubscribe(topics, (error) => {
        if (error) {
          this.logger.error(`Failed to unsubscribe from tenant ${tenantId}: ${error}`);
          return;
        }
        this.logger.log(`Unsubscribed from tenant ${tenantId}`);
      });

      this.tenantSubscriptions.delete(tenantId);
    } catch (error) {
      this.logger.error(
        `Error unsubscribing from tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Publica uma ordem para um AGV específico
   * Tópico: /{tenantId}/v2/{manufacturer}/{serialNumber}/order
   *
   * @param tenantId ID do tenant
   * @param manufacturer Fabricante do AGV
   * @param serialNumber Número de série do AGV
   * @param order Ordem VDA 5050
   */
  async publishOrder(
    tenantId: string,
    manufacturer: string,
    serialNumber: string,
    order: Record<string, unknown>, // VDA5050Order
  ): Promise<void> {
    if (!this.client || !this.client.connected) {
      throw new Error('MQTT client not connected');
    }

    const topic = `${tenantId}/v2/${manufacturer}/${serialNumber}/order`;
    const payload = JSON.stringify(order);

    return new Promise((resolve, reject) => {
      this.client!.publish(topic, payload, { qos: 1 }, (error) => {
        if (error) {
          this.logger.error(`Failed to publish order to ${topic}: ${error}`);
          reject(error);
          return;
        }
        this.logger.debug(`Published order to ${topic}`);
        resolve();
      });
    });
  }

  /**
   * Processa mensagens recebidas do broker
   * Extrai tenantId, manufacturer, serialNumber do topic
   * Parse JSON e emite eventos tipados
   *
   * @param topic Tópico MQTT
   * @param payload Payload em bytes
   */
  private handleMessage(topic: string, payload: Buffer): void {
    try {
      // Parse do topic: tenantId/v2/{manufacturer}/{serialNumber}/{messageType}
      const parts = topic.split('/');
      if (parts.length !== 5) {
        this.logger.warn(`Invalid topic format: ${topic}`);
        return;
      }

      const [tenantId, version, manufacturer, serialNumber, messageType] = parts;

      if (version !== 'v2') {
        this.logger.warn(`Unsupported VDA 5050 version: ${version}`);
        return;
      }

      // Parse JSON
      let data: unknown;
      try {
        data = JSON.parse(payload.toString('utf-8'));
      } catch (error) {
        this.logger.warn(`Failed to parse JSON from ${topic}`);
        return;
      }

      // Distribuir para handlers específicos
      switch (messageType) {
        case 'state':
          this.eventEmitter.emit('agv:state', {
            tenantId,
            manufacturer,
            serialNumber,
            state: data as AGVState,
          } as AgvStateEvent);
          break;

        case 'connection':
          this.eventEmitter.emit('agv:connection', {
            tenantId,
            manufacturer,
            serialNumber,
            state: data as ConnectionState,
          } as AgvConnectionEvent);
          break;

        case 'action':
          // OrderAction - confirma recebimento
          this.eventEmitter.emit('agv:action', {
            tenantId,
            manufacturer,
            serialNumber,
            action: data,
          });
          break;

        default:
          this.logger.debug(`Unknown message type: ${messageType}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling MQTT message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Retorna o EventEmitter interno para subscribers
   * Usado por TenantFleetService para se inscrever em eventos
   */
  getEventEmitter(): EventEmitter2 {
    return this.eventEmitter;
  }

  /**
   * Retorna informações sobre tenants subscrito
   */
  getTenantSubscriptions(): TenantSubscription[] {
    return Array.from(this.tenantSubscriptions.values());
  }

  /**
   * Verifica se um tenant está subscrito
   */
  isTenantSubscribed(tenantId: string): boolean {
    return this.tenantSubscriptions.has(tenantId);
  }
}
