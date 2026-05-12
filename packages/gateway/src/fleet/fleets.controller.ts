/**
 * Fleets Controller
 * Endpoints REST para consultar estado de frotas
 * Endpoints: GET /fleets, GET /fleets/:name/state
 */

import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Você precisa criar este guard
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { TenantFleetService } from './tenant-fleet.service';
import { RmfFleetState, RmfRobotState } from '../mqtt/vda5050.adapter';

/**
 * DTO de resposta para GET /fleets
 */
interface FleetsListResponse {
  fleets: Array<{
    fleet_name: string;
    robot_count: number;
    online_robot_count: number;
  }>;
}

/**
 * DTO de resposta para GET /fleets/:name/state
 */
interface FleetStateResponse extends RmfFleetState {}

@Controller('fleets')
@UseGuards(JwtAuthGuard)
export class FleetsController {
  private readonly logger = new Logger(FleetsController.name);

  constructor(private tenantFleetService: TenantFleetService) {}

  /**
   * GET /fleets
   * Retorna lista de frotas do tenant autenticado
   * Cada tenant tem uma frota com múltiplos robôs
   *
   * @param tenantId Extraído do JWT via @TenantId()
   * @returns Lista de frotas
   */
  @Get()
  async getFleets(@TenantId() tenantId: string): Promise<FleetsListResponse> {
    try {
      // Em uma arquitetura real, um tenant poderia ter múltiplas frotas
      // Por enquanto, retornamos uma frota por tenant
      const fleetState = this.tenantFleetService.getFleetState(tenantId);

      return {
        fleets: [
          {
            fleet_name: tenantId,
            robot_count: fleetState.robots.length,
            online_robot_count: this.tenantFleetService.getOnlineRobotCount(
              tenantId,
            ),
          },
        ],
      };
    } catch (error) {
      this.logger.error(
        `Error getting fleets for tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * GET /fleets/:name/state
   * Retorna estado consolidado de uma frota específica
   * Tópico compatível com web-RMF: /fleets/{name}/state
   *
   * @param tenantId ID do tenant (extraído de JWT)
   * @param name Nome da frota (neste modelo, é o tenantId)
   * @returns Estado completo da frota com todos os robôs
   * @throws NotFoundException se tenant não encontrado
   */
  @Get(':name/state')
  async getFleetState(
    @TenantId() tenantId: string,
    @Param('name') name: string,
  ): Promise<FleetStateResponse> {
    try {
      // Validar que o tenant está tentando acessar sua própria frota
      if (name !== tenantId) {
        throw new BadRequestException(
          `Fleet ${name} does not belong to tenant ${tenantId}`,
        );
      }

      const fleetState = this.tenantFleetService.getFleetState(tenantId);

      if (!fleetState || fleetState.robots.length === 0) {
        // Retornar frota vazia ao invés de erro 404
        // Frontend deve lidar com frota vazia gracefully
        this.logger.debug(`Fleet ${name} has no robots or is empty`);
      }

      return fleetState;
    } catch (error) {
      this.logger.error(
        `Error getting fleet state for ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * GET /fleets/:name/robots/:robotName/state
   * Retorna estado de um robô específico
   * Formato compatível com web-RMF
   *
   * @param tenantId ID do tenant
   * @param name Nome da frota
   * @param robotName Nome do robô
   * @returns Estado do robô
   */
  @Get(':name/robots/:robotName/state')
  async getRobotState(
    @TenantId() tenantId: string,
    @Param('name') name: string,
    @Param('robotName') robotName: string,
  ): Promise<RmfRobotState> {
    try {
      // Validar que o tenant está tentando acessar sua própria frota
      if (name !== tenantId) {
        throw new BadRequestException(
          `Fleet ${name} does not belong to tenant ${tenantId}`,
        );
      }

      return this.tenantFleetService.getRobotState(tenantId, robotName);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error getting robot state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * GET /fleets/:name/robots
   * Retorna lista de robôs de uma frota
   *
   * @param tenantId ID do tenant
   * @param name Nome da frota
   * @returns Array de nomes de robôs
   */
  @Get(':name/robots')
  async listRobots(
    @TenantId() tenantId: string,
    @Param('name') name: string,
  ): Promise<{ robots: string[] }> {
    try {
      // Validar que o tenant está tentando acessar sua própria frota
      if (name !== tenantId) {
        throw new BadRequestException(
          `Fleet ${name} does not belong to tenant ${tenantId}`,
        );
      }

      const robots = this.tenantFleetService.getRobotNames(tenantId);

      return { robots };
    } catch (error) {
      this.logger.error(
        `Error listing robots: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
