/**
 * VDA 5050 v2.0 Type Definitions
 * Interfaces TypeScript para o protocolo VDA 5050 sobre MQTT
 * Ref: https://github.com/VDA5050/VDA5050_protocol
 */

/**
 * Identificador único de um AGV no contexto de um fabricante
 */
export interface AGVIdentifier {
  manufacturer: string;
  serialNumber: string;
}

/**
 * Posição do AGV no espaço
 */
export interface AGVPosition {
  /** Coordenada X em metros */
  x: number;
  /** Coordenada Y em metros */
  y: number;
  /** Ângulo de orientação em radianos [0, 2π] */
  theta: number;
  /** Identificador do mapa */
  mapId: string;
  /** Descrição do mapa (opcional) */
  mapDescription?: string;
  /** Se a posição foi inicializada */
  positionInitialized: boolean;
  /** Score de localização [0-1], onde 1.0 é certeza total */
  localizationScore: number;
  /** Desvio esperado da posição em metros */
  deviationRange: number;
}

/**
 * Estado da bateria do AGV
 */
export interface BatteryState {
  /** Porcentagem de carga [0-100] */
  batteryCharge: number;
  /** Voltagem em volts */
  batteryVoltage: number;
  /** Saúde da bateria [0-100], onde 100 é novo */
  batteryHealth: number;
  /** Se está carregando */
  charging: boolean;
  /** Alcance estimado em metros com carga atual */
  reach: number;
}

/**
 * Segurança do AGV
 */
export interface SafetyState {
  /** Se o AGV está em modo seguro (sem movimento) */
  eStop: boolean;
  /** Se há proteção contra colisão ativa */
  protectiveStop: boolean;
  /** Modo operacional restrito */
  emergencyStopButtonPressed: boolean;
}

/**
 * Erro ou aviso do AGV
 */
export interface AGVError {
  /** Código único do erro */
  errorCode: string;
  /** Descrição legível do erro */
  errorDescription: string;
  /** Nível: ERROR, WARNING, INFO */
  errorLevel: 'ERROR' | 'WARNING' | 'INFO';
  /** Ação recomendada */
  errorType: string;
}

/**
 * Informação adicional do AGV
 */
export interface AGVInformation {
  /** Código único da informação */
  infoCode: string;
  /** Descrição legível */
  infoDescription: string;
  /** Nível: INFO, DEBUG */
  infoType: string;
}

/**
 * Estado de um nó visitado (posição de um ponto de interesse)
 */
export interface NodeState {
  /** ID único do nó no grafo */
  nodeId: string;
  /** Número de sequência do nó no caminho */
  sequenceId: number;
  /** Se o nó foi visitado */
  released: boolean;
}

/**
 * Estado de uma aresta visitada (movimento entre nós)
 */
export interface EdgeState {
  /** ID único da aresta no grafo */
  edgeId: string;
  /** Número de sequência da aresta */
  sequenceId: number;
  /** Se a aresta foi percorrida */
  released: boolean;
}

/**
 * Carga transportada pelo AGV
 */
export interface Load {
  /** ID único da carga */
  loadId: string;
  /** Tipo da carga */
  loadType: string;
  /** Peso em kg */
  weight?: number;
}

/**
 * Estado completo do AGV (VDA 5050 AGVState)
 * Este é o tópico `/{tenantId}/v2/{manufacturer}/{serialNumber}/state`
 */
export interface AGVState {
  /** ID do fabricante */
  headerId: {
    manufacturer: string;
    serialNumber: string;
  };
  /** Timestamp ISO 8601 (ex: "2026-05-12T10:29:34.123Z") */
  timestamp: string;
  /** Versão da mensagem VDA 5050 */
  version: string;

  // Estado da ordem
  /** ID da ordem em execução (se houver) */
  orderId: string;
  /** Número de update da ordem */
  orderUpdateId: number;
  /** Zona restrita (se houver) */
  zoneSetId?: string;

  // Progresso no caminho
  /** ID do último nó visitado */
  lastNodeId: string;
  /** Sequência do último nó */
  lastNodeSequenceId: number;
  /** Estados de todos os nós da rota */
  nodeStates: NodeState[];
  /** Estados de todas as arestas da rota */
  edgeStates: EdgeState[];

  // Localização e movimento
  /** Posição no espaço */
  position: AGVPosition;
  /** Velocidade linear em m/s */
  velocity: {
    vx: number;
    vy: number;
    omega: number; // velocidade angular em rad/s
  };
  /** Cargas transportadas */
  loads: Load[];

  // Estados de operação
  /** Se está se movendo */
  driving: boolean;
  /** Se está pausado */
  paused: boolean;
  /** Modo operacional: AUTOMATIC, MANUAL, SERVICE, UNDEFINED */
  operatingMode: 'AUTOMATIC' | 'MANUAL' | 'SERVICE' | 'UNDEFINED';
  /** Se está solicitando base de recarga */
  newBaseRequest: boolean;

  // Saúde do AGV
  /** Estado da bateria */
  batteryState: BatteryState;
  /** Distância percorrida desde o último nó em metros */
  distanceSinceLastNode: number;
  /** Erros do AGV */
  errors: AGVError[];
  /** Informações do AGV */
  informations: AGVInformation[];
  /** Estado de segurança */
  safetyState: SafetyState;
}

/**
 * Estado de conexão do AGV (tópico `/{tenantId}/v2/{manufacturer}/{serialNumber}/connection`)
 */
export interface ConnectionState {
  headerId: {
    manufacturer: string;
    serialNumber: string;
  };
  timestamp: string;
  version: string;
  /** Estado da conexão: ONLINE, OFFLINE, CONNECTIONBROKEN */
  connectionState: 'ONLINE' | 'OFFLINE' | 'CONNECTIONBROKEN';
  /** Timestamp do último heartbeat */
  lastHeartbeat: number;
}

/**
 * Posição de um nó na ordem
 */
export interface OrderNodePosition {
  /** Coordenada X */
  x: number;
  /** Coordenada Y */
  y: number;
  /** Ângulo theta */
  theta?: number;
  /** ID do mapa */
  mapId: string;
  /** Descrição do mapa */
  mapDescription?: string;
  /** Ações customizadas */
  allowDeviations?: boolean;
}

/**
 * Ação a executar em um nó
 */
export interface Action {
  /** ID único da ação */
  actionId: string;
  /** Tipo da ação: STOP, START_CHARGE, DOCK, UNDOCK, etc. */
  actionType: string;
  /** Parâmetros específicos da ação */
  actionParameters?: Record<string, unknown>;
  /** Se a ação é bloqueante */
  blocking: boolean;
}

/**
 * Nó em uma ordem VDA 5050
 */
export interface OrderNode {
  /** ID único do nó */
  nodeId: string;
  /** Número de sequência */
  sequenceId: number;
  /** Posição do nó */
  nodePosition: OrderNodePosition;
  /** Ações a executar no nó */
  actions: Action[];
  /** Tempo máximo de espera em ms */
  maxWaitTime?: number;
}

/**
 * Ação em uma aresta
 */
export interface EdgeAction {
  /** ID único da ação */
  actionId: string;
  /** Tipo de ação */
  actionType: string;
  /** Parâmetros */
  actionParameters?: Record<string, unknown>;
  /** Se é bloqueante */
  blocking: boolean;
  /** Relative to start or end of edge */
  relativePosition?: number;
}

/**
 * Aresta em uma ordem VDA 5050
 */
export interface OrderEdge {
  /** ID único da aresta */
  edgeId: string;
  /** Número de sequência */
  sequenceId: number;
  /** ID do nó de origem */
  startNodeId: string;
  /** ID do nó de destino */
  endNodeId: string;
  /** Ações a executar na aresta */
  actions: EdgeAction[];
  /** Máxima velocidade permitida em m/s */
  maxSpeed?: number;
  /** Direção esperada: FORWARD, BACKWARD, ANY */
  direction?: 'FORWARD' | 'BACKWARD' | 'ANY';
}

/**
 * Ordem VDA 5050 (tópico `/{tenantId}/v2/{manufacturer}/{serialNumber}/order`)
 * Enviada pelo backend para o AGV
 */
export interface VDA5050Order {
  headerId: {
    manufacturer: string;
    serialNumber: string;
  };
  timestamp: string;
  version: string;

  /** ID único da ordem */
  orderId: string;
  /** Versão/update da ordem */
  orderUpdateId: number;
  /** Zona restrita aplicável */
  zoneSetId?: string;

  /** Nós da rota */
  nodes: OrderNode[];
  /** Arestas da rota */
  edges: OrderEdge[];
}

/**
 * Confirmação de recebimento de ordem
 */
export interface OrderAction {
  headerId: {
    manufacturer: string;
    serialNumber: string;
  };
  timestamp: string;
  version: string;

  orderId: string;
  orderUpdateId: number;
  /** O nó até o qual confirma recebimento */
  lastNodeSequenceId: number;
}

/**
 * Pausa de ordem
 */
export interface Pause {
  headerId: {
    manufacturer: string;
    serialNumber: string;
  };
  timestamp: string;
  version: string;

  orderId: string;
  orderUpdateId: number;
}

/**
 * Tipo genérico para mensagens MQTT VDA 5050
 */
export type VDA5050Message =
  | AGVState
  | ConnectionState
  | OrderAction
  | Pause;
