/**
 * JWT Auth Guard
 * Guard global para validar JWT tokens
 * Adiciona user ao request para uso por @TenantId() decorator
 *
 * NOTA: Este é um exemplo básico. Adapte para sua implementação específica.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * Payload JWT esperado
 */
interface JwtPayload {
  sub: string;
  tenantId: string;
  username: string;
  email?: string;
  [key: string]: unknown;
}

/**
 * User adicionado ao request pelo guard
 */
interface RequestUser extends JwtPayload {
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extrair token do header Authorization: Bearer <token>
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Validar e decodificar token
      const payload = await this.jwtService.verifyAsync(token);

      // Validar campos obrigatórios
      if (!payload.tenantId || !payload.sub) {
        throw new UnauthorizedException(
          'Token missing required claims (tenantId, sub)',
        );
      }

      // Adicionar user ao request para uso por @TenantId() e outros decorators
      (request as any).user = payload as RequestUser;

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Token validation failed';
      this.logger.warn(`JWT validation failed: ${message}`);
      throw new UnauthorizedException(`Invalid token: ${message}`);
    }
  }

  /**
   * Extrai token do header Authorization
   * Esperado formato: "Bearer <token>"
   *
   * @param request Express request
   * @returns Token ou undefined
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      return undefined;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return undefined;
    }

    return parts[1];
  }
}
