# Hermes

Dashboard React para controle e monitoramento de frotas de robôs via open-RMF.
Visualização 3D de mapas, costmaps, posição dos robôs e controle de navegação Nav2.

---

## Requisitos

### Frontend

- Node.js 18+
- npm 9+

### Backend (infraestrutura externa)

O Hermes é um **dashboard** — não gerencia a instalação de ROS 2.
Os seguintes serviços devem estar rodando e acessíveis na rede:

| Serviço | Porta | Como provisionar |
|---|---|---|
| RMF API Server | 7878 | [Ver infrastructure-requirements.md](docs/infrastructure-requirements.md) |
| rosbridge_suite | 9090 | [Ver infrastructure-requirements.md](docs/infrastructure-requirements.md) |
| freebotics_rmf_adapter | — | `colcon build` + `ros2 launch ros2/launch/hermes_backend.launch.py` |

**ROS 2 em Docker?** Funciona — ver [implicações Docker](docs/infrastructure-requirements.md#docker).

### Verificar pré-requisitos

```bash
bash scripts/setup-ros2-rmf.sh
```

---

## Instalação do frontend

```bash
# Clonar e instalar dependências
git clone https://github.com/MaximilianCF/hermes.git
cd hermes
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com a URL do RMF API Server e o token JWT
# Ver: docs/infrastructure-requirements.md#jwt

# Iniciar servidor de desenvolvimento
npm run dev
# → http://localhost:5173
```

---

## Configuração

Copiar `.env.example` para `.env.local` e preencher:

```bash
# URL do RMF API Server (8000 = Docker dev; 7878 = ROS 2 nativo)
VITE_RMF_API_URL=http://localhost:8000
VITE_RMF_WS_URL=ws://localhost:8000

# JWT Bearer token para autenticação com o RMF API Server
# Ver: docs/infrastructure-requirements.md#jwt para gerar
VITE_RMF_TOKEN=your-jwt-token-here

# IP do robô real (para conexão rosbridge direta — legado)
VITE_ROBOT_IP=192.168.1.100
```

---

## Scripts disponíveis

```bash
npm run dev           # Servidor de desenvolvimento (Vite HMR)
npm run build         # Build de produção
npm run preview       # Preview do build de produção
npm run lint          # ESLint
npm run test          # Vitest em modo watch
npm run test:run      # Vitest (execução única, para CI)
npm run test:coverage # Relatório de cobertura
```

---

## Arquitetura

```
Frontend (React + Three.js + Zustand)
    ├── HTTP/WS → RMF API Server :7878  (fleet state, tasks)
    └── WS      → rosbridge :9090       (costmaps, LiDAR)

Backend (ROS 2)
    ├── freebotics_rmf_adapter  (robot ↔ RMF)
    ├── rmf_traffic_schedule    (deconflição)
    ├── rmf_api_server          (REST/WS API)
    └── rosbridge_websocket     (sensor bridge)
```

Para detalhes da migração para open-RMF: [OPENRMF_MIGRATION.md](OPENRMF_MIGRATION.md)

---

## Documentação

| Documento | Descrição |
|---|---|
| [docs/infrastructure-requirements.md](docs/infrastructure-requirements.md) | Requisitos de infraestrutura, Docker, geração de JWT |
| [docs/auth-spec.md](docs/auth-spec.md) | Modelo de ameaça e especificação de autenticação |
| [docs/performance-benchmark-report.md](docs/performance-benchmark-report.md) | Benchmark Three.js multi-robô |
| [docs/adr/001-typescript-zustand-testing.md](docs/adr/001-typescript-zustand-testing.md) | ADR: TypeScript, Zustand, Vitest |
| [docs/troubleshooting-backend.md](docs/troubleshooting-backend.md) | Troubleshooting do backend ROS 2 |
| [OPENRMF_MIGRATION.md](OPENRMF_MIGRATION.md) | Plano de migração para open-RMF (4 semanas) |

---

## Testes

```bash
npm run test:run
# ✓ src/store/__tests__/fleetStore.test.ts  (7 testes)
# ✓ src/types/__tests__/guards.test.ts      (10 testes)
```

---

## Licença

Privado — NeedTech / Freebotics
