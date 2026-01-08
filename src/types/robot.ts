/**
 * Módulo de Tipos para Robôs
 * Define a estrutura e validações para dados de robôs no sistema Freebotics
 */

/**
 * Enumeração de status possíveis para um robô
 */
export enum RobotStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error'
}

/**
 * Interface que define a estrutura de um robô no sistema
 */
export interface Robot {
  id: number;           // Identificador único do robô
  name: string;         // Nome do robô
  ip: string;           // Endereço IP do robô
  online: boolean;      // Estado de conexão
  battery_level?: number; // Nível de bateria
  mode?: string;        // Modo operacional atual
  hasError?: boolean;   // Indica se o robô tem algum erro
}

/**
 * Função para validar endereço IP
 * 
 * @param ip - Endereço IP a ser validado
 * @returns Booleano indicando se o IP é válido
 */
export function validateIP(ip: string): boolean {
  // Regex para validar IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // Validação de formato
  if (!ipv4Regex.test(ip)) return false;
  
  // Validação de faixa de valores
  const octets = ip.split('.').map(Number);
  return octets.every(octet => octet >= 0 && octet <= 255);
}

/**
 * Função para sanitizar e validar dados de robô
 * 
 * @param robot - Dados parciais do robô
 * @returns Robô sanitizado ou lançará erro se inválido
 */
export function sanitizeRobot(robot: Partial<Robot>): Robot {
  // Validações básicas
  if (!robot.id) {
    throw new Error('ID do robô é obrigatório');
  }

  if (!robot.name) {
    throw new Error('Nome do robô é obrigatório');
  }

  if (!robot.ip || !validateIP(robot.ip)) {
    throw new Error('Endereço IP inválido');
  }

  // Sanitização
  return {
    id: robot.id,
    name: robot.name.trim(),
    ip: robot.ip,
    online: robot.online ?? false,
    battery_level: robot.battery_level && robot.battery_level >= 0 && robot.battery_level <= 100 
      ? robot.battery_level 
      : undefined,
    mode: robot.mode,
    hasError: robot.hasError ?? false
  };
}

/**
 * Gerenciador de robôs para operações de manipulação de dados
 */
export class RobotManager {
  private robots: Robot[] = [];

  /**
   * Adiciona ou atualiza um robô
   * 
   * @param robot - Dados do robô a serem adicionados
   * @returns O robô adicionado
   */
  addRobot(robot: Partial<Robot>): Robot {
    const sanitizedRobot = sanitizeRobot(robot);
    
    // Encontra índice do robô existente
    const existingIndex = this.robots.findIndex(r => r.id === sanitizedRobot.id);
    
    if (existingIndex !== -1) {
      // Atualiza robô existente
      this.robots[existingIndex] = sanitizedRobot;
    } else {
      // Adiciona novo robô
      this.robots.push(sanitizedRobot);
    }

    return sanitizedRobot;
  }

  /**
   * Obtém todos os robôs
   * 
   * @returns Lista de robôs
   */
  getAllRobots(): Robot[] {
    return [...this.robots];
  }

  /**
   * Obtém um robô específico por ID
   * 
   * @param id - ID do robô
   * @returns Robô encontrado ou undefined
   */
  getRobotById(id: number): Robot | undefined {
    return this.robots.find(robot => robot.id === id);
  }
}
