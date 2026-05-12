/**
 * Fleets Gateway
 * WebSocket Gateway para comunicação real-time com frontend
 * Notifica clientes quando o estado das frotas muda
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TenantFleetService, RobotStateChangedEvent, FleetStateChangedEvent } from './tenant-fleet.service';
import { RmfRobotState, RmfFleetState } from '../mqtt/vda5050.adapter';

/**
 * Interface para o payload JWT extraído do Socket.io auth
 */
interface JwtPayload {
  sub: string;
  tenantId: string;
  username: string;
  [key: string]: unknown;
}

/**
 * Metadados de um cliente Socket.io conectado
 */
interface ClientMetadata {
  userId: string;
  tenantId: string;
  username: string;
}

@WebSocketGateway({
  namespace: '/socket.io',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class FleetsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(FleetsGateway.name);

  /**
   * Map de socket ID → metadata do cliente
   */
  private clientMetadata = new Map<string, ClientMetadata>();

  constructor(
    private tenantFleetService: TenantFleetService,
    private jwtService: JwtService,
  ) {}

  /**
   * Inicializa o gateway
   * Se inscreve em eventos de mudança de estado emitidos por TenantFleetService
   */
  async afterInit(): Promise<void> {
    this.logger.log('Fleets Gateway initialized');

    // Se inscrever em eventos de mudança de estado de robô
    const fleetEventEmitter = this.tenantFleetService.getEventEmitter();

    fleetEventEmitter.on(
      'robot:state:changed',
      (event: RobotStateChangedEvent) => {
        this.handleRobotStateChanged(event);
      },
    );

    // Se inscrever em eventos de mudança de estado de frota
    fleetEventEmitter.on(
      'fleet:state:changed',
      (event: FleetStateChangedEvent) => {
        this.handleFleetStateChanged(event);
      },
    );

    this.logger.log('Subscribed to TenantFleetService events');
  }

  /**
   * Chamado quando um cliente se conecta
   * Autentica usando JWT do handshake
   *
   * @param socket Socket.io socket do cliente
   */
  async handleConnection(socket: Socket): Promise<void> {
    try {
      // Extrair token JWT do handshake
      const token = socket.handshake.auth.token as string | undefined;

      if (!token) {
        this.logger.warn('Connection attempt without token');
        socket.disconnect(true);
        return;
      }

      // Decodificar e validar JWT
      const payload = await this.validateToken(token);

      // Armazenar metadata do cliente
      const metadata: ClientMetadata = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        username: payload.username,
      };

      this.clientMetadata.set(socket.id, metadata);

      this.logger.log(
        `Client ${socket.id} connected: ${payload.username} (tenant: ${payload.tenantId})`,
      );
    } catch (error) {
      this.logger.warn(
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      socket.disconnect(true);
    }
  }

  /**
   * Chamado quando um cliente se desconecta
   *
   * @param socket Socket.io socket do cliente
   */
  handleDisconnect(socket: Socket): void {
    const metadata = this.clientMetadata.get(socket.id);

    if (metadata) {
      this.logger.log(
        `Client ${socket.id} disconnected: ${metadata.username} (tenant: ${metadata.tenantId})`,
      );
      this.clientMetadata.delete(socket.id);
    }
  }

  /**
   * @SubscribeMessage('subscribe_fleet_state')
   * Mensagem para se inscrever em atualizações de estado de frota
   * Coloca o socket em uma room específica do tenant
   *
   * @param socket Socket do cliente
   * @param payload { fleet_name: string }
   * @returns { status: 'ok' } ou { error: string }
   */
  @SubscribeMessage('subscribe_fleet_state')
  handleSubscribeFleetState(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { fleet_name: string },
  ): { status: string; error?: string } {
    try {
      const metadata = this.clientMetadata.get(socket.id);

      if (!metadata) {
        return { status: 'error', error: 'Not authenticated' };
      }

      // Validar que o cliente está tentando se inscrever em sua própria frota
      if (payload.fleet_name !== metadata.tenantId) {
        this.logger.warn(
          `Client ${socket.id} (tenant ${metadata.tenantId}) tried to subscribe to fleet ${payload.fleet_name}`,
        );
        return {
          status: 'error',
          error: 'Fleet does not belong to this tenant',
        };
      }

      // Room name: {tenantId}:fleet:{fleetName}
      const roomName = `${metadata.tenantId}:fleet:${payload.fleet_name}`;
      socket.join(roomName);

      this.logger.debug(
        `Client ${socket.id} subscribed to room: ${roomName}`,
      );

      // Enviar estado atual imediatamente
      const currentState = this.tenantFleetService.getFleetState(
        metadata.tenantId,
      );
      socket.emit('fleet_state', currentState);

      return { status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Error handling subscribe_fleet_state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        status: 'error',
        error: 'Internal server error',
      };
    }
  }

  /**
   * @SubscribeMessage('unsubscribe_fleet_state')
   * Mensagem para se desinscrever de atualizações de estado de frota
   *
   * @param socket Socket do cliente
   * @param payload { fleet_name: string }
   * @returns { status: 'ok' }
   */
  @SubscribeMessage('unsubscribe_fleet_state')
  handleUnsubscribeFleetState(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { fleet_name: string },
  ): { status: string } {
    try {
      const metadata = this.clientMetadata.get(socket.id);

      if (!metadata) {
        return { status: 'error' };
      }

      const roomName = `${metadata.tenantId}:fleet:${payload.fleet_name}`;
      socket.leave(roomName);

      this.logger.debug(
        `Client ${socket.id} unsubscribed from room: ${roomName}`,
      );

      return { status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Error handling unsubscribe_fleet_state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { status: 'error' };
    }
  }

  /**
   * @SubscribeMessage('subscribe_robot_state')
   * Se inscrever em atualizações de um robô específico
   *
   * @param socket Socket do cliente
   * @param payload { fleet_name: string, robot_name: string }
   * @returns { status: 'ok' } ou { error: string }
   */
  @SubscribeMessage('subscribe_robot_state')
  handleSubscribeRobotState(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { fleet_name: string; robot_name: string },
  ): { status: string; error?: string } {
    try {
      const metadata = this.clientMetadata.get(socket.id);

      if (!metadata) {
        return { status: 'error', error: 'Not authenticated' };
      }

      if (payload.fleet_name !== metadata.tenantId) {
        return {
          status: 'error',
          error: 'Fleet does not belong to this tenant',
        };
      }

      const roomName = `${metadata.tenantId}:robot:${payload.robot_name}`;
      socket.join(roomName);

      this.logger.debug(
        `Client ${socket.id} subscribed to room: ${roomName}`,
      );

      // Enviar estado atual do robô
      try {
        const robotState = this.tenantFleetService.getRobotState(
          metadata.tenantId,
          payload.robot_name,
        );
        socket.emit('robot_state', robotState);
      } catch (error) {
        // Robô pode não existir ainda, não é erro crítico
        this.logger.debug(
          `Robot ${payload.robot_name} not found yet in fleet ${metadata.tenantId}`,
        );
      }

      return { status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Error handling subscribe_robot_state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { status: 'error', error: 'Internal server error' };
    }
  }

  /**
   * Handler interno para mudança de estado de robô
   * Broadcast para room correspondente
   *
   * @param event Evento de mudança de estado
   */
  private handleRobotStateChanged(event: RobotStateChangedEvent): void {
    try {
      const roomName = `${event.tenantId}:robot:${event.robotName}`;

      // Broadcast para todos os clientes da room específica do robô
      this.server.to(roomName).emit('robot_state', event.newState);

      // Também notificar room da frota inteira
      const fleetRoomName = `${event.tenantId}:fleet:${event.tenantId}`;
      this.server.to(fleetRoomName).emit('robot_state_update', {
        robot_name: event.robotName,
        state: event.newState,
      });
    } catch (error) {
      this.logger.error(
        `Error broadcasting robot state change: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handler interno para mudança de estado de frota
   * Broadcast para room da frota
   *
   * @param event Evento de mudança de estado de frota
   */
  private handleFleetStateChanged(event: FleetStateChangedEvent): void {
    try {
      const roomName = `${event.tenantId}:fleet:${event.tenantId}`;

      // Broadcast para todos os clientes da room da frota
      this.server.to(roomName).emit('fleet_state', event.fleetState);
    } catch (error) {
      this.logger.error(
        `Error broadcasting fleet state change: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Valida token JWT extraído do Socket.io handshake
   * Pré-requisito: JwtService deve estar configurado com a chave secreta
   *
   * @param token JWT token
   * @returns Payload decodificado
   * @throws BadRequestException se inválido
   */
  private async validateToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      // Validar campos obrigatórios
      if (!payload.tenantId || !payload.sub) {
        throw new BadRequestException(
          'Token missing required claims (tenantId, sub)',
        );
      }

      return payload as JwtPayload;
    } catch (error) {
      throw new BadRequestException(
        `Invalid token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
