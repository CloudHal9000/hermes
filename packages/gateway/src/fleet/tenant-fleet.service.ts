/**
 * Tenant Fleet Service
 * Gerencia o estado das frotas de cada tenant
 * Agrega estados de AGVs e fornece estado consolidado da frota
 * Emite eventos quando há mudanças
 */

import {
  Injectable,
  OnModuleInit,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from 'eventemitter2';
import { MqttService, AgvStateEvent, AgvConnectionEvent } from '../mqtt/mqtt.service';
import { AGVState, ConnectionState } from '../mqtt/vda5050.types';
import {
  VDA5050Adapter,
  RmfRobotState,
  RmfFleetState,
} from '../mqtt/vda5050.adapter';

/**
 * Evento emitido quando o estado de um robô muda
 */
export interface RobotStateChangedEvent {
  tenantId: string;
  robotName: string;
  newState: RmfRobotState;
}

/**
 * Evento emitido quando o estado de uma frota muda
 */
export interface FleetStateChangedEvent {
  tenantId: string;
  fleetState: RmfFleetState;
}

/**
 * Identidade de um AGV no mapa de estado
 */
interface AgvKey {
  manufacturer: string;
  serialNumber: string;
}

/**
 * Índice dos robôs de um tenant
 */
interface TenantFleetIndex {
  robotsByKey: Map<string, RmfRobotState>; // key = "manufacturer:serialNumber"
  robotsById: Map<string, RmfRobotState>; // key = serialNumber
  lastUpdated: number;
}

@Injectable()
export class TenantFleetService implements OnModuleInit {
  private readonly logger = new Logger(TenantFleetService.name);

  /**
   * Map de tenants → seus robôs
   * Structure: tenantId → { robotsByKey, robotsById, lastUpdated }
   */
  private tenantFleets = new Map<string, TenantFleetIndex>();

  /**
   * Map de tenants → AGVs offline
   * Rastreia quais AGVs estão offline para evitar stale data
   */
  private offlineAgvs = new Map<string, Set<string>>();

  /**
   * EventEmitter interno para notificar subscribers de mudanças
   * Complementa o MqttService para eventos de estado consolidado
   */
  private eventEmitter: EventEmitter2;

  constructor(private mqttService: MqttService) {
    this.eventEmitter = new EventEmitter2();
  }

  /**
   * Inicializa subscriptions aos eventos MQTT
   */
  async onModuleInit(): Promise<void> {
    const mqttEventEmitter = this.mqttService.getEventEmitter();

    // Se inscreve em eventos de estado AGV
    mqttEventEmitter.on('agv:state', (event: AgvStateEvent) => {
      this.onAgvState(event.tenantId, event.manufacturer, event.serialNumber, event.state);
    });

    // Se inscreve em eventos de conexão
    mqttEventEmitter.on('agv:connection', (event: AgvConnectionEvent) => {
      this.onAgvConnection(
        event.tenantId,
        event.manufacturer,
        event.serialNumber,
        event.state,
      );
    });

    this.logger.log('TenantFleetService initialized and listening to MQTT events');
  }

  /**
   * Registra um novo tenant para começar a receber atualizações de sua frota
   * Chama MqttService.subscribeTenant internamente
   *
   * @param tenantId ID do tenant
   */
  async registerTenant(tenantId: string): Promise<void> {
    try {
      // Se ainda não foi subscrito, fazer subscribe
      if (!this.mqttService.isTenantSubscribed(tenantId)) {
        await this.mqttService.subscribeTenant(tenantId);
      }

      // Inicializar índice do tenant se não existir
      if (!this.tenantFleets.has(tenantId)) {
        this.tenantFleets.set(tenantId, {
          robotsByKey: new Map(),
          robotsById: new Map(),
          lastUpdated: Date.now(),
        });
        this.offlineAgvs.set(tenantId, new Set());
        this.logger.log(`Registered tenant: ${tenantId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to register tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Desregistra um tenant e para de receber atualizações
   * @param tenantId ID do tenant
   */
  async unregisterTenant(tenantId: string): Promise<void> {
    try {
      await this.mqttService.unsubscribeTenant(tenantId);
      this.tenantFleets.delete(tenantId);
      this.offlineAgvs.delete(tenantId);
      this.logger.log(`Unregistered tenant: ${tenantId}`);
    } catch (error) {
      this.logger.error(
        `Failed to unregister tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Processa atualização de estado de um AGV
   * Atualiza mapa interno e emite eventos
   *
   * @param tenantId ID do tenant
   * @param manufacturer Fabricante do AGV
   * @param serialNumber Número de série do AGV
   * @param agvState Estado VDA 5050 do AGV
   */
  private onAgvState(
    tenantId: string,
    manufacturer: string,
    serialNumber: string,
    agvState: AGVState,
  ): void {
    try {
      // Garantir que tenant está registrado
      if (!this.tenantFleets.has(tenantId)) {
        this.logger.warn(
          `Received state for unregistered tenant ${tenantId}, registering...`,
        );
        // Não fazer async aqui, apenas registrar no mapa
        this.tenantFleets.set(tenantId, {
          robotsByKey: new Map(),
          robotsById: new Map(),
          lastUpdated: Date.now(),
        });
        this.offlineAgvs.set(tenantId, new Set());
      }

      // Converter para RmfRobotState
      const robotState = VDA5050Adapter.toRobotState(
        agvState,
        serialNumber,
        tenantId,
      );

      // Obter índice do tenant
      const fleetIndex = this.tenantFleets.get(tenantId)!;
      const agvKey = `${manufacturer}:${serialNumber}`;

      // Atualizar maps
      fleetIndex.robotsByKey.set(agvKey, robotState);
      fleetIndex.robotsById.set(serialNumber, robotState);
      fleetIndex.lastUpdated = Date.now();

      // Remover de offline se estava offline
      const offlineSet = this.offlineAgvs.get(tenantId)!;
      offlineSet.delete(serialNumber);

      // Emitir evento de mudança de estado
      this.eventEmitter.emit('robot:state:changed', {
        tenantId,
        robotName: serialNumber,
        newState: robotState,
      } as RobotStateChangedEvent);

      // Emitir evento de mudança de frota
      const fleetState = this.getFleetState(tenantId);
      this.eventEmitter.emit('fleet:state:changed', {
        tenantId,
        fleetState,
      } as FleetStateChangedEvent);

      this.logger.debug(
        `Updated AGV state: ${tenantId}/${manufacturer}/${serialNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing AGV state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Processa mudança de conexão de um AGV
   * Marca como offline se desconectado
   *
   * @param tenantId ID do tenant
   * @param manufacturer Fabricante do AGV
   * @param serialNumber Número de série do AGV
   * @param connectionState Estado de conexão
   */
  private onAgvConnection(
    tenantId: string,
    manufacturer: string,
    serialNumber: string,
    connectionState: ConnectionState,
  ): void {
    try {
      const isOnline = connectionState.connectionState === 'ONLINE';

      if (!this.tenantFleets.has(tenantId)) {
        this.tenantFleets.set(tenantId, {
          robotsByKey: new Map(),
          robotsById: new Map(),
          lastUpdated: Date.now(),
        });
        this.offlineAgvs.set(tenantId, new Set());
      }

      const offlineSet = this.offlineAgvs.get(tenantId)!;

      if (!isOnline) {
        offlineSet.add(serialNumber);
        this.logger.warn(
          `AGV ${tenantId}/${manufacturer}/${serialNumber} is OFFLINE (${connectionState.connectionState})`,
        );
      } else {
        offlineSet.delete(serialNumber);
        this.logger.log(
          `AGV ${tenantId}/${manufacturer}/${serialNumber} is ONLINE`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing connection state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Obtém estado consolidado de todos os robôs de um tenant
   * Filtra robôs offline se necessário
   *
   * @param tenantId ID do tenant
   * @param includeOffline Incluir robôs offline (default: false)
   * @returns Estado agregado da frota
   */
  getFleetState(tenantId: string, includeOffline: boolean = false): RmfFleetState {
    const fleetIndex = this.tenantFleets.get(tenantId);

    if (!fleetIndex) {
      // Retornar frota vazia se tenant não registrado
      return {
        fleet_name: tenantId,
        robots: [],
        timestamp: Date.now(),
      };
    }

    let robots = Array.from(fleetIndex.robotsById.values());

    // Filtrar offline se necessário
    if (!includeOffline) {
      const offlineSet = this.offlineAgvs.get(tenantId) || new Set();
      robots = robots.filter((r) => !offlineSet.has(r.name));
    }

    return VDA5050Adapter.toFleetState(tenantId, new Map(
      robots.map((r) => [r.name, r]),
    ));
  }

  /**
   * Obtém estado de um robô específico
   *
   * @param tenantId ID do tenant
   * @param robotName Nome/serialNumber do robô
   * @returns Estado do robô
   * @throws NotFoundException se robô não encontrado
   */
  getRobotState(tenantId: string, robotName: string): RmfRobotState {
    const fleetIndex = this.tenantFleets.get(tenantId);

    if (!fleetIndex) {
      throw new NotFoundException(
        `Tenant ${tenantId} not found`,
      );
    }

    const robot = fleetIndex.robotsById.get(robotName);

    if (!robot) {
      throw new NotFoundException(
        `Robot ${robotName} not found in fleet ${tenantId}`,
      );
    }

    return robot;
  }

  /**
   * Obtém lista de nomes de robôs de um tenant
   *
   * @param tenantId ID do tenant
   * @returns Array de nomes de robôs
   */
  getRobotNames(tenantId: string): string[] {
    const fleetIndex = this.tenantFleets.get(tenantId);

    if (!fleetIndex) {
      return [];
    }

    return Array.from(fleetIndex.robotsById.keys());
  }

  /**
   * Obtém número de robôs online de um tenant
   */
  getOnlineRobotCount(tenantId: string): number {
    const offlineSet = this.offlineAgvs.get(tenantId) || new Set();
    const fleetIndex = this.tenantFleets.get(tenantId);

    if (!fleetIndex) {
      return 0;
    }

    return fleetIndex.robotsById.size - offlineSet.size;
  }

  /**
   * Retorna o EventEmitter interno para subscribers
   * Usado por FleetsGateway para notificar clientes Socket.io
   */
  getEventEmitter(): EventEmitter2 {
    return this.eventEmitter;
  }

  /**
   * Publica uma ordem para um AGV via MQTT
   * Utiliza MqttService.publishOrder internamente
   *
   * @param tenantId ID do tenant
   * @param robotName Nome/serialNumber do robô
   * @param order Ordem VDA 5050
   */
  async publishOrder(
    tenantId: string,
    manufacturer: string,
    robotName: string,
    order: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.mqttService.publishOrder(tenantId, manufacturer, robotName, order);
      this.logger.debug(
        `Published order to ${tenantId}/${manufacturer}/${robotName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish order: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
