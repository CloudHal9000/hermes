# rmf-gateway — CLAUDE.md

## O que é este projeto

Backend NestJS que substitui o api-server Python do web-RMF.
Serve o frontend web-RMF sem modificações, com arquitetura
multi-tenant, VDA 5050 v2.0 sobre MQTT e Prisma + PostgreSQL.

## Stack

- **Framework**: NestJS (Node.js 20+, TypeScript strict mode)
- **ORM**: Prisma + PostgreSQL 16
- **Protocolo robôs**: VDA 5050 v2.0 sobre MQTT (broker EMQX)
- **Real-time**: Socket.io (@nestjs/websockets)
- **Auth**: JWT com RBAC (@nestjs/jwt, @nestjs/passport)
- **Dev DB**: PostgreSQL 16 via Docker (docker-compose.dev.yml, porta 5434)

## Arquitetura
Mutley (ROS 2 / Nav2)
↓
fleet_adapter + RobotCommandHandle (Open-RMF)
↓
MQTT Broker → /{tenantId}/v2/{manufacturer}/{serialNumber}/state
↓
MqttService (src/mqtt/mqtt.service.ts)
↓
VDA5050Adapter (src/mqtt/vda5050.adapter.ts)
→ AGVState → RmfFleetState
↓
TenantFleetService (src/fleet/tenant-fleet.service.ts)
→ Map<tenantId, Map<serialNumber, RmfRobotState>>
↓
FleetsGateway (Socket.io) + FleetsController (REST)
↓
web-RMF frontend (React, intacto)

## Estrutura de módulos
src/
├── mqtt/
│   ├── mqtt.module.ts
│   ├── mqtt.service.ts
│   ├── vda5050.types.ts
│   └── vda5050.adapter.ts
├── fleet/
│   ├── fleet.module.ts
│   ├── tenant-fleet.service.ts
│   ├── fleets.controller.ts
│   └── fleets.gateway.ts
├── auth/guards/jwt-auth.guard.ts
├── common/decorators/tenant-id.decorator.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── app.module.ts
└── main.ts

## Multi-tenancy

- Todos os 42 models Prisma têm `tenantId: String`
- MQTT topics: `/{tenantId}/v2/+/+/state`
- Socket.io rooms: `{tenantId}:fleet:{fleetName}`, `{tenantId}:robot:{robotName}`
- JWT claim obrigatória: `tenantId`
- Decorator `@TenantId()` injeta tenantId em controllers e gateways

## VDA 5050 → RMF mapeamento

| VDA 5050 | RMF |
|---|---|
| AGVState.position.x/y/theta | RmfRobotState.location.x/y/yaw |
| AGVState.batteryState.batteryCharge | RmfRobotState.battery_percent |
| AGVState.operatingMode AUTOMATIC + driving | mode = 0 |
| AGVState.paused | mode = 1 |
| AGVState.operatingMode MANUAL | mode = 3 |
| AGVState.errors (errorLevel ERROR) | mode = 4 |
| AGVState.lastNodeId | location.waypoint_name |
| AGVState.position.mapId | location.level_name |

## Variáveis de ambiente (.env.local)
DATABASE_URL=postgresql://rmf:rmf_dev_pass@localhost:5434/rmf_gateway_dev
MQTT_URL=mqtt://localhost:1883
JWT_SECRET=dev-secret-change-in-production
CORS_ORIGIN=http://localhost:3000

## Comandos úteis

```bash
# Dev
npm run start:dev

# Build
npm run build

# PostgreSQL local
docker compose -f docker-compose.dev.yml up -d

# Prisma
npx prisma migrate dev --name <nome>
npx prisma studio
```

## Decisões arquiteturais

1. **Sem rosbridge**: NestJS fala MQTT direto, não ROS 2
2. **fleet_adapter preservado**: continua on-premise no cliente
3. **rmf-core preservado**: scheduler, traffic management, mutex groups
4. **Frontend web-RMF intacto**: 254 componentes React sem modificação
5. **Prisma > Tortoise-ORM**: type safety, migrations declarativas, multi-tenant
6. **EMQX em produção**: ACLs por tenant, autenticação por certificado
7. **Porta 5434**: PostgreSQL dev isolado do garimpai_postgres (5433)

## Robô atual em desenvolvimento

**Mutley** — AGV com ROS 2 Jazzy + Nav2 + VDA 5050 v2.0 + RobotCommandHandle

## Repositório

https://git.cloudhal9000.dev/max/rmf-gateway
