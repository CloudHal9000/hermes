# Hermes — CLAUDE.md

## O que é este projeto

Hermes é um Fleet Management System (FMS) para AGVs industriais.
Produto único composto por dashboard React e backend NestJS,
com suporte nativo a VDA 5050 v2.0 sobre MQTT e multi-tenancy.

## Estrutura do Monorepo
hermes/
├── packages/
│   ├── dashboard/          ← React + Vite (frontend)
│   └── gateway/            ← NestJS + Prisma (backend)
├── docker/                 ← Open-RMF api-server (legado/referência)
├── ros2/                   ← Fleet adapter ROS 2 (freebotics_rmf_adapter)
├── docs/
├── docker-compose.dev.yml  ← PostgreSQL (5435) + EMQX (1884)
└── pnpm-workspace.yaml

## Stack

### Dashboard (packages/dashboard/)
- React 18.3 + Vite
- Three.js + URDF loader (visualização 3D)
- roslib (legado — deprecar progressivamente)
- react-router-dom, nipplejs, react-gauge-component

### Gateway (packages/gateway/)
- NestJS (Node.js 20+, TypeScript strict mode)
- Prisma + PostgreSQL 16
- VDA 5050 v2.0 sobre MQTT (broker EMQX)
- Socket.io (@nestjs/websockets)
- JWT com RBAC (@nestjs/jwt, @nestjs/passport)

## Arquitetura
Mutley (ROS 2 / Nav2)
↓
freebotics_rmf_adapter (ros2/) + RobotCommandHandle
↓
MQTT Broker (EMQX) → /{tenantId}/v2/{manufacturer}/{serialNumber}/state
↓
Gateway NestJS (packages/gateway/)
├── MqttService         → subscribe por tenant
├── VDA5050Adapter      → AGVState → RmfFleetState
├── TenantFleetService  → estado em memória por tenant
├── FleetsController    → REST /api/fleets
└── FleetsGateway       → Socket.io rooms por tenant
↓
Dashboard React (packages/dashboard/)
├── useFleetState       → consome Socket.io do gateway
├── Map3D               → Three.js, visualização 3D
└── useRosVisuals       → legado roslib (deprecar Fase 4)

## Multi-tenancy

- Todos os 42 models Prisma têm tenantId
- MQTT topics: /{tenantId}/v2/+/+/state
- Socket.io rooms: {tenantId}:fleet:{name}, {tenantId}:robot:{name}
- JWT claim obrigatória: tenantId

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

## Comandos

```bash
# Infra
docker compose -f docker-compose.dev.yml up -d

# Gateway
cd packages/gateway
npm install
npx prisma migrate deploy
npm run start:dev

# Dashboard
cd packages/dashboard
npm install
npm run dev

# Tudo junto (raiz)
pnpm dev:all
```

## Variáveis de ambiente

### packages/gateway/.env
DATABASE_URL=postgresql://rmf:rmf_dev_pass@localhost:5435/hermes_dev
MQTT_URL=mqtt://localhost:1884
JWT_SECRET=hermes-dev-secret
CORS_ORIGIN=http://localhost:5173

## Portas

| Serviço | Porta |
|---|---|
| Dashboard (Vite dev) | 5173 |
| Gateway (NestJS) | 3000 |
| PostgreSQL (Docker) | 5435 |
| EMQX MQTT | 1884 |
| EMQX Dashboard | 18083 |

## Robô atual em desenvolvimento

**Mutley** — AGV com ROS 2 Jazzy + Nav2 + VDA 5050 v2.0 + RobotCommandHandle

## Status de migração roslib → gateway

| Hook | Status |
|---|---|
| useRos | Legado — manter pra rosbridge/visualização |
| useFleetPolling | Substituir por useFleetState (Socket.io) |
| useTfGraph | Substituir por poses do gateway |
| useRMFApi | Criar — consome REST + Socket.io do gateway |
| useFleetState | Criar — estado de frota em tempo real |

## Repositório

https://github.com/CloudHal9000/hermes
