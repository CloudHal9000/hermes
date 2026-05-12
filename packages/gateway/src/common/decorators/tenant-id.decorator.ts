/**
 * @TenantId() Decorator
 * Extrai o tenant ID do JWT decodificado
 * Usa o payload do JWT que foi adicionado pelo Guard de autenticação
 */

import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Payload JWT esperado
 * Deveria ser adicionado por um JwtAuthGuard
 */
interface JwtPayload {
  sub: string;
  tenantId: string;
  username: string;
  [key: string]: unknown;
}

/**
 * Decorator para extrair tenantId do JWT
 * Uso: @TenantId() tenantId: string
 *
 * Pré-requisito: Deve haver um JwtAuthGuard que adiciona user ao request
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();

    // O JwtAuthGuard deveria ter adicionado user ao request
    const user = (request as any).user as JwtPayload | undefined;

    if (!user) {
      throw new BadRequestException(
        'No user found in request. Ensure JwtAuthGuard is applied.',
      );
    }

    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new BadRequestException(
        'No tenantId found in JWT payload. Ensure token contains tenantId claim.',
      );
    }

    return tenantId;
  },
);
