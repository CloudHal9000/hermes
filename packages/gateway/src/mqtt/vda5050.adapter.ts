/**
 * VDA 5050 → RMF Types Adapter
 * Converte estados VDA 5050 para tipos compatíveis com o frontend web-RMF
 * Mantém a interface RmfApi inalterada, permitindo abstração transparente do backend
 */

import { AGVState } from './vda5050.types';

/**
 * Compatível com rmf-models/RmfRobotState
 */
export interface RmfRobotState {
  name: string; // AGV serialNumber
  fleet_name: string; // tenant ID
  mode: number; // 0=AUTOMATIC, 1=PAUSED, 2=IDLE, 3=MANUAL, 4=ERROR
  battery_percent: number; // [0-100]
  location: {
    x: number;
    y: number;
    yaw: number; // theta em radianos
    map_name: string; // mapId
    level_name?: string; // mapId
    waypoint_name?: string; // lastNodeId
  };
  path: string[]; // Array de waypoints (nodeIds futuros)
  is_charging: boolean;
  velocity: {
    linear_x: number;
    linear_y: number;
    angular: number;
  };
  last_heartbeat: number; // Unix timestamp em ms
}

/**
 * Compatível com rmf-models/FleetState
 * Agregação de todos os robôs de um tenant
 */
export interface RmfFleetState {
  fleet_name: string; // tenant ID
  robots: RmfRobotState[];
  timestamp: number; // Unix timestamp em ms
}

/**
 * Classe adaptadora com métodos estáticos para conversão
 */
export class VDA5050Adapter {
  /**
   * Converte AGVState VDA 5050 para RmfRobotState
   * @param agvState Estado do AGV em formato VDA 5050
   * @param serialNumber Número de série do AGV
   * @param tenantId ID do tenant
   * @returns Estado do robô em formato RMF
   */
  static toRobotState(
    agvState: AGVState,
    serialNumber: string,
    tenantId: string,
  ): RmfRobotState {
    // Determina o modo operacional
    const mode = this.getOperatingMode(agvState);

    // Converte posição
    const location = {
      x: agvState.position.x,
      y: agvState.position.y,
      yaw: agvState.position.theta,
      map_name: agvState.position.mapId,
      level_name: agvState.position.mapId, // Em VDA 5050, mapId é o nível
      waypoint_name: agvState.lastNodeId, // Último nó visitado é o waypoint atual
    };

    // Constrói o caminho futuro a partir dos nós não visitados
    const futurePath = agvState.nodeStates
      .filter((node) => !node.released && node.nodeId !== agvState.lastNodeId)
      .sort((a, b) => a.sequenceId - b.sequenceId)
      .map((node) => node.nodeId);

    // Velocidade em m/s
    const velocity = {
      linear_x: agvState.velocity.vx,
      linear_y: agvState.velocity.vy,
      angular: agvState.velocity.omega,
    };

    return {
      name: serialNumber,
      fleet_name: tenantId,
      mode,
      battery_percent: agvState.batteryState.batteryCharge,
      location,
      path: futurePath,
      is_charging: agvState.batteryState.charging,
      velocity,
      last_heartbeat: new Date(agvState.timestamp).getTime(),
    };
  }

  /**
   * Converte múltiplos estados VDA 5050 para RmfFleetState
   * @param tenantId ID do tenant
   * @param robotStates Mapa de (serialNumber → RmfRobotState)
   * @returns Estado agregado da frota
   */
  static toFleetState(
    tenantId: string,
    robotStates: Map<string, RmfRobotState>,
  ): RmfFleetState {
    const robots = Array.from(robotStates.values());
    const timestamp = Math.max(
      ...robots.map((r) => r.last_heartbeat),
      Date.now(),
    );

    return {
      fleet_name: tenantId,
      robots,
      timestamp,
    };
  }

  /**
   * Determina o modo operacional RMF baseado em AGVState VDA 5050
   * Mapeamento:
   * - 0 = AUTOMATIC: AGV em modo automático, sem erros
   * - 1 = PAUSED: AGV pausado mas operacional
   * - 2 = IDLE: AGV aguardando ordem
   * - 3 = MANUAL: Operador manual
   * - 4 = ERROR: Erros críticos ou e-stop ativo
   *
   * @param agvState Estado do AGV
   * @returns Modo RMF [0-4]
   */
  private static getOperatingMode(agvState: AGVState): number {
    // Verificar erros críticos
    const hasErrors = agvState.errors.some((err) => err.errorLevel === 'ERROR');
    if (hasErrors || agvState.safetyState.eStop) {
      return 4; // ERROR mode
    }

    // Verificar proteção contra colisão
    if (agvState.safetyState.protectiveStop) {
      return 4; // ERROR mode
    }

    // Modo manual explícito
    if (agvState.operatingMode === 'MANUAL') {
      return 3; // MANUAL mode
    }

    // Paused
    if (agvState.paused) {
      return 1; // PAUSED mode
    }

    // Automatic
    if (agvState.operatingMode === 'AUTOMATIC' && agvState.driving) {
      return 0; // AUTOMATIC mode
    }

    // Idle/waiting for order
    if (
      agvState.operatingMode === 'AUTOMATIC' &&
      !agvState.driving &&
      !agvState.paused
    ) {
      return 2; // IDLE mode
    }

    // Default: automatic
    return 0;
  }

  /**
   * Verifica se um AGV está saudável (sem erros críticos)
   */
  static isHealthy(agvState: AGVState): boolean {
    const hasErrors = agvState.errors.some((err) => err.errorLevel === 'ERROR');
    const hasProtectiveStop = agvState.safetyState.protectiveStop;
    const hasEStop = agvState.safetyState.eStop;

    return !hasErrors && !hasProtectiveStop && !hasEStop;
  }

  /**
   * Extrai mensagens de erro formatadas para o frontend
   */
  static getErrorMessages(agvState: AGVState): string[] {
    return agvState.errors
      .filter((err) => err.errorLevel === 'ERROR')
      .map((err) => `${err.errorCode}: ${err.errorDescription}`);
  }

  /**
   * Calcula a saúde percentual do AGV baseado em bateria e erros
   */
  static getHealthPercent(agvState: AGVState): number {
    // Base é a carga de bateria
    let health = agvState.batteryState.batteryCharge;

    // Reduz saúde com base em erros
    const errorPenalty = agvState.errors.filter(
      (err) => err.errorLevel === 'ERROR',
    ).length;
    health -= errorPenalty * 10; // -10% por erro

    // Reduz com proteção ativa
    if (agvState.safetyState.protectiveStop) {
      health -= 15;
    }

    // Reduz com e-stop
    if (agvState.safetyState.eStop) {
      health -= 25;
    }

    return Math.max(0, Math.min(100, health));
  }
}
