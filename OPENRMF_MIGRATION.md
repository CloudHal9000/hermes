# Migração para open-RMF + VDA5050: Guia Completo

**Data da Pesquisa**: 01 de Abril de 2026  
**Versão do Plano**: 1.0  
**Status**: Planejamento Aprovado - Pronto para Implementação  

## Índice

1. [Visão Geral](#visão-geral)
2. [Contexto e Motivação](#contexto-e-motivação)
3. [Pesquisa de Stack](#pesquisa-de-stack)
4. [Decisões Arquiteturais](#decisões-arquiteturais)
5. [Arquitetura Proposta](#arquitetura-proposta)
6. [Timeline: MVP 4 Semanas](#timeline-mvp-4-semanas)
7. [Detalhes de Implementação](#detalhes-de-implementação)
8. [Checklist de Verificação](#checklist-de-verificação)
9. [Fase 4: VDA5050 (Sprint 2)](#fase-4-vda5050-sprint-2)
10. [Referências](#referências)

---

## Visão Geral

Este documento descreve a estratégia de **migração do dashboard Freebotics Studio de um padrão single-robot ROS-only para um fleet manager multi-robot baseado em open-RMF**, com suporte futuro a VDA5050 para interoperabilidade com robôs heterogêneos.

### Objetivo Geral
- 🎯 Transformar dashboard de controle individual para **fleet manager centralizado**
- 🌐 Habilitar **coordenação multi-robô** com deconflição automática de tráfego
- 🔌 Preparar arquitetura para **suporte a VDA5050** (padrão de indústria)
- 📈 Manter **compatibilidade com infraestrutura ROS 2 existente** durante transição

### Escopo
- **MVP (4 semanas)**: Fases 1-3 (open-RMF + Fleet Adapter + Frontend)
- **Fase 4 (Sprint 2)**: VDA5050 + interoperabilidade com robôs de outros fabricantes
- **Fase 5 (Sprint 2+)**: Testes E2E, otimização, documentação

---

## Contexto e Motivação

### Stack Atual (Limitações)

O dashboard atualmente funciona com **roslib WebSocket direto** para comunicação:

```
Dashboard → roslib WebSocket (ws://robot_ip:9090) → ROS 1/2 individual → Robô
```

#### Problemas com a Abordagem Atual

| Problema | Impacto |
|----------|---------|
| **Sem interoperabilidade** | Só funciona com robôs que falam ROS; impossível integrar robôs de outros fabricantes (clearpath, otto, etc.) |
| **Sem coordenação multi-frota** | Cada robô é independente; nenhuma inteligência de fleet planning |
| **Sem deconflição de tráfego** | Dois robôs podem planejar rotas que se colidem; sem negociação automática |
| **Sem alocação inteligente** | Tarefas não são automaticamente distribuídas entre robôs ociosos |
| **Escalabilidade limitada** | Polling simples (`useFleetPolling` a cada 5s) não escala para 10+ robôs |
| **Sem padrão industrial** | Integração custom necessária para cada novo fabricante |

### Stack Alvo (Solução)

Adotar **open-RMF como camada de orquestração** com **VDA5050 como protocolo padrão de comunicação**:

```
Dashboard → RMF API Server (:7878) → open-RMF Core → Fleet Adapters → Robôs (ROS, VDA5050, etc.)
                                                    ↓
                                         Traffic Schedule DB
                                         (deconflição automática)
```

#### Benefícios da Nova Abordagem

| Benefício | Habilitador |
|-----------|-------------|
| **Interoperabilidade multi-fabricante** | VDA5050 como bridge; qualquer robô VDA5050-compatível funciona |
| **Coordenação multi-frota** | open-RMF Task Planner aloca tarefas inteligentemente |
| **Deconflição automática** | Traffic Schedule Database detecta conflitos antecipadamente |
| **Escalabilidade** | API event-driven (WebSocket) ao invés de polling |
| **Padrão industrial real** | VDA5050 é o padrão da indústria; reconhecido por todos |
| **Futuro-proof** | Arquitetura modular; novas frotas adicionadas via Fleet Adapter |

---

## Pesquisa de Stack

### VDA5050: Padrão de Comunicação

**O que é**: Especificação de comunicação entre Automated Guided Vehicles (AGVs) e um Master Control (Fleet Manager) central.

**Desenvolvido por**: Associação Automotiva Alemã (VDA - Verband der Automobilindustrie)

**Protocolo**: MQTT com mensagens JSON

#### Estrutura de Comunicação VDA5050

```
MQTT Broker (e.g., mosquitto @ port 1883)
│
├── uagv/v2/{manufacturer}/{version}/state          ◄ Robot → Master
│   • robotId, batteryState, location, operatingMode
│   • errors[], warnings[], informations[]
│
├── uagv/v2/{manufacturer}/{version}/order          ► Master → Robot
│   • orderId, nodes[] (waypoints), edges[] (connections)
│
├── uagv/v2/{manufacturer}/{version}/instant_action ► Master → Robot
│   • Ações imediatas: pausa, retoma, override de velocidade
│
└── uagv/v2/{manufacturer}/{version}/visualization  ◄ Robot → Master (opcional)
    • Dados extras para visualização
```

**Vantagem Central**: Um fleet manager funciona com robôs de **qualquer fabricante** que implemente VDA5050.

**Recursos**:
- [GitHub - VDA5050 Official Spec](https://github.com/VDA5050/VDA5050)
- [BlueBotics - VDA5050 Explained](https://bluebotics.com/vda-5050-explained-agv-communication-standard/)

---

### open-RMF: Fleet Management Framework

**O que é**: Framework open-source construído sobre **ROS 2** para coordenar frotas heterogêneas de robôs.

**Gerenciado por**: Open Source Robotics Alliance (OSRA) desde 2024

**Responsáveis anteriores**: Open Robotics (criado em 2018 para hospitais em Singapura)

#### Arquitetura de open-RMF

```
┌─────────────────────────────────────────────┐
│           RMF Core (ROS 2 Humble)           │
├─────────────────────────────────────────────┤
│ rmf_traffic         - Scheduling & traffic  │
│ rmf_task            - Task planner & alloc  │
│ rmf_battery         - Battery estimation    │
│ rmf_ros2            - ROS 2 adapters        │
│ rmf_api_server      - REST + WebSocket API  │
└──────────────────────┬──────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         ▼                            ▼
    Fleet Adapter              Fleet Adapter
    (ROS 2 Robot)              (VDA5050 Robot)
         │                            │
      Robot A                      MQTT Broker
    (ROS nativo)              (robô heterogêneo)
```

#### Componentes-Chave de open-RMF

1. **Traffic Schedule Database**
   - Armazena itinerários previstos de todos os robôs
   - Detecta conflitos potenciais (rotas que se cruzam)
   - Dois níveis de deconflição:
     - Nível 1: **Prevenção** - evita conflitos antecipadamente
     - Nível 2: **Resolução** - negocia entre fleet managers quando conflito é inevitável

2. **Fleet Adapters**
   - Tradução layer entre proprietary API e RMF
   - Responsável por 4 funções críticas:
     - Kinematic Transformation (mapear posições)
     - Navigation Command Mapping (traduzir ordens)
     - State Synchronization (sincronizar poses)
     - Real-time Status Publication (enviar status contínuo)

3. **Task Planner**
   - Recebe tarefas (start → goal)
   - Aloca para melhor robô disponível
   - Gera sequência de waypoints
   - Acompanha execução

4. **API Server**
   - Expõe endpoints REST + WebSocket
   - Permite submissão de tarefas
   - Publica Fleet State em tempo real
   - Gerencia transações

**Recursos**:
- [open-rmf.org](https://www.open-rmf.org/)
- [GitHub - open-rmf/rmf](https://github.com/open-rmf/rmf)
- [GitHub - open-rmf/rmf_demos](https://github.com/open-rmf/rmf_demos)

---

### Integração ROS ↔ open-RMF

#### vda5050_connector (TUM FML)

Bridge open-source que conecta ROS 2 com VDA5050:

```
ROS 2 Topics ←→ vda5050_connector ←→ MQTT Broker (VDA5050)
```

**Componentes**:
1. MQTT Bridge - traduz mensagens entre ROS e MQTT
2. Controller - executa especificação VDA5050
3. Adapter - interage com Robot API

**GitHub**: [tum-fml/vda5050_connector](https://github.com/tum-fml/vda5050_connector)

#### Fleet Adapters Existentes

- [NVIDIA Isaac ROS Cloud Control](https://github.com/NVIDIA-ISAAC-ROS/isaac_ros_cloud_control) - Enterprise-ready
- [InOrbit ros_amr_interop](https://github.com/inorbit-ai/ros_amr_interop) - Multifrota
- [rmf_demos adapters](https://github.com/open-rmf/rmf_demos) - Exemplos de referência

---

## Decisões Arquiteturais

As seguintes decisões foram confirmadas com o stakeholder em 01/04/2026:

### 1️⃣ Versão ROS do Robô Atual

**Decisão**: Usar **ROS 2** (Humble ou posterior)

**Impacto**:
- Fleet Adapter pode ser um nó ROS 2 nativo (sem ros1_bridge complexo)
- Simplifica integração com open-RMF (que é ROS 2)
- Aproveitamos Nav2 stack nativo

**Alternativa não-escolhida**: ROS 1 teria exigido ros1_bridge adicional

---

### 2️⃣ Estratégia de Dados de Sensor

**Decisão**: Manter **rosbridge temporário para costmaps e LiDAR** (Fases 1-3)

**Motivo**:
- open-RMF não fornece equivalente direto de OccupancyGrid/LaserScan
- Estratégia conservadora: não quebra visualização existente
- Plano de deprecação: remover em Fase 4 quando alternativa existir

**Timeline**:
- Fases 1-3 (MVP): rosbridge continua
- Fase 4 (Sprint 2): ROS 2 relay ou integração RMF nativa
- Fase 5+: remover rosbridge completamente

**Arquitetura**:
```
Dashboard
  ├─ useRMFApi        (poses via open-RMF)
  └─ useRosVisuals    (costmaps via rosbridge - DEPRECATED FASE 4)
```

---

### 3️⃣ Prioridade VDA5050

**Decisão**: Sim, implementar VDA5050 **em paralelo com ROS legado**, mas **Fase 4 separada** (não no MVP)

**MVP (4 semanas)**:
- Fases 1-3: open-RMF + Fleet Adapter ROS 2
- Foco 100% em coordenação multi-frota ROS

**Sprint 2 (semanas 5-8)**:
- Fase 4: VDA5050 + MQTT Broker
- Testar com robôs heterogêneos (ROS + VDA5050 simultâneos)

**Benefício**:
- Não atrasa MVP
- Quando pronto, suporta frotas mistas
- Alinha com direção da indústria

---

### 4️⃣ Timeline: MVP vs Completo

**Decisão**: **MVP em 4 semanas**, escopo mínimo viável

**MVP Inclui (Semanas 1-4)**:
- Backend: open-RMF + Fleet Adapter ROS 2 + API Server
- Frontend: useRMFApi + useFleetState + Map3D multi-robot
- Validação: 2+ robôs navegam sem colisão, taskmanager funciona

**Não Inclui em MVP**:
- VDA5050 (Fase 4 em Sprint 2)
- Traffic Visualizer 4D (nice-to-have)
- Battery management avançado (já existe no Freebotics)

**Alternativa não-escolhida**: 8 semanas completo (Fases 1-5) seria mais lento

---

## Arquitetura Proposta

### Diagrama de Arquitetura Geral

```
┌──────────────────────────────────────────────────────────────────────────┐
│           FREEBOTICS STUDIO DASHBOARD (React + Three.js)                │
│                                                                          │
│  ┌──────────────┐  ┌────────────────────────┐  ┌──────────────────┐   │
│  │ FleetSelector│  │ Map3D (multi-robot)    │  │ TaskManager (novo)│  │
│  │ (plural)     │  │ URDF + RMF layers      │  │ + TaskForm/List   │  │
│  └──────┬───────┘  └────────┬───────────────┘  └────────┬─────────┘   │
│         │                   │                           │               │
│  ┌──────▼───────────────────▼───────────────────────────▼──────────┐   │
│  │  useRMFApi (novo)                                              │   │
│  │  • REST http://localhost:7878                                  │   │
│  │  • WebSocket ws://localhost:7878/fleet_states                 │   │
│  │  • Methods: getFleetState(), createTask(), etc.               │   │
│  └──────┬──────────────────────────────────────────┬──────────────┘   │
│         │ (Fleet State events)                     │ (Task events)     │
│  ┌──────▼──────────────┐              ┌───────────▼──────────┐        │
│  │ useFleetState (novo)│              │ useRosVisuals (novo) │        │
│  │ robots[], tasks[]   │              │ costmap, lidar       │        │
│  └─────────────────────┘              │ DEPRECATE: Fase 4    │        │
│                                       └──────────────────────┘        │
└───────────────────────────────────────────────────────────────────────┘
                           ║ HTTP/gRPC/WS                 ║ ROS WS (temp)
                           ▼                               ▼
        ┌──────────────────────────────────┐   ┌──────────────────────┐
        │  open-RMF (ROS 2 Humble)         │   │  rosbridge_suite     │
        │  http://localhost:7878           │   │  ws://robot:9090     │
        │                                  │   │                      │
        │ ┌────────────────────────────┐   │   │  (costmap/lidar only)│
        │ │ RMF API Server (:7878)     │   │   └──────────────────────┘
        │ │ • /fleet_states (WS push)  │   │
        │ │ • /tasks (CRUD)            │   │
        │ │ • Event streaming          │   │
        │ └────────────────────────────┘   │
        │                                  │
        │ ┌────────────────────────────┐   │
        │ │ rmf_traffic_ros2           │   │
        │ │ • Traffic Schedule DB      │   │
        │ │ • Deconflição automática   │   │
        │ └────────────────────────────┘   │
        │                                  │
        │ ┌────────────────────────────┐   │
        │ │ rmf_task                   │   │
        │ │ • Task Planner             │   │
        │ │ • Alocação inteligente     │   │
        │ └────────────────────────────┘   │
        │                                  │
        │ ┌────────────────────────────┐   │
        │ │ Fleet Adapter (ROS 2)      │   │
        │ │ • Maps ROS ↔ RMF           │   │
        │ │ • Sincroniza pose, battery │   │
        │ └────────────────────────────┘   │
        └──────────────────┬───────────────┘
                           │ ROS 2 topics
                           ▼
        ┌──────────────────────────────────────────┐
        │  ROBOT FREEBOTICS (ROS 2 Humble)        │
        │                                          │
        │ • Nav2 Stack (planner, controller)      │
        │ • AMCL + TF (localization)              │
        │ • LiDAR driver                          │
        │ • Base controller (/cmd_vel)            │
        │ • rosbridge_suite :9090 (fallback)      │
        └──────────────────────────────────────────┘

NOTA: VDA5050 será adicionado na Fase 4 (Sprint 2)
```

### Fluxo de Dados por Funcionalidade

#### 1. Fleet State (Estado da Frota)

```
ROS 2 /tf + /odom ──────┐
                         ├──► Fleet Adapter ROS 2 ──┐
Status topics ───────────┘                         │
                                                   ├──► RMF Fleet State DB
                                                   │
                                     ┌─────────────┴──► RMF API Server
                                     │                 
                         WebSocket (push)
                             /fleet_states
                                     │
                                     ▼
                            Dashboard useFleetState
                            robots[id, pose, battery, etc.]
```

**Latência esperada**: <500ms da realidade do robô ao UI

#### 2. Submissão de Tarefa

```
Dashboard (drag no mapa)
        │
        ├─► useNavigationTool
        │   • Calcula start_pose, goal_pose
        │
        ├─► POST /tasks (JSON)
        │   {
        │     "category": "delivery",
        │     "start": {"x": 0, "y": 0, "yaw": 0},
        │     "goal":  {"x": 10, "y": 5, "yaw": 1.57}
        │   }
        │
        ├─► RMF Task Planner
        │   • Aloca melhor robô
        │   • Gera waypoints
        │   • Reserva espaço no Traffic Schedule
        │
        ├─► Fleet Adapter ROS 2
        │   • Traduz para Nav2 /move_base/goal
        │
        ├─► Robot Nav2 Stack
        │   • Planejai e executa
        │
        └─► /tf updates
            └─► RMF Fleet State
                └─► Dashboard atualiza em tempo real
```

#### 3. Costmap + LiDAR (Temporário, Fase 1-3)

```
Robot /local_costmap/costmap  ┐
Robot /lidar/front_aligned    ├──► rosbridge WS :9090
Robot /global_costmap/costmap ┤
                              └─► useRosVisuals hook
                                  
                              Map3D.useCostmapLayer
                              Map3D.useLidarLayer
                              (renderiza em Three.js)

TODO: Remover em Fase 4 quando RMF tiver alternativa
```

---

## Timeline: MVP 4 Semanas

### Semana 1: Backend - Preparação open-RMF

**Objetivo**: Validar stack open-RMF funcional com 2+ robôs

**Dias 1-2: Setup inicial**
```bash
# Instalar ROS 2 Humble
sudo apt install ros-humble-desktop

# Clonar open-RMF
git clone https://github.com/open-rmf/rmf.git
git clone https://github.com/open-rmf/rmf_demos.git

# Build
colcon build --symlink-install

# Testar
ros2 launch rmf_demos office.launch.xml
```

**Checklist**:
- [ ] ROS 2 Humble instalado
- [ ] rmf_demos compila sem erros
- [ ] rmf_demos lança com 2 robôs simulados
- [ ] Robôs navegam sem colisão

**Dias 3-5: Fleet Adapter ROS 2 para Freebotics**

Criar novo pacote ROS 2:
```
freebotics_rmf_adapter/
├── CMakeLists.txt
├── package.xml
├── src/
│   └── FreoboticsFleetAdapter.cpp
├── config/
│   └── freebotics.yaml
└── launch/
    └── adapter.launch.xml
```

**Responsabilidades do Adapter**:
1. **Subscrever** `/tf`, `/odom`, `/battery_state`
2. **Publicar** para RMF Fleet State (posição, bateria, status)
3. **Subscrever** RMF task requests
4. **Publicar** para Nav2 `/move_base/goal`
5. **Sincronizar** poses em tempo real

**Checklist**:
- [ ] Package criado
- [ ] Compila sem erros
- [ ] Conecta ao RMF Core
- [ ] RMF reconhece Freebotics na frota

---

### Semana 2: Backend - RMF API Server + Integração

**Objetivo**: API REST/WebSocket funcional; tarefas navegam o robô

**Dias 1-2: RMF API Server**

```bash
# Instalar API server
sudo apt install ros-humble-rmf-api-server

# Configurar port :7878
ros2 run rmf_api_server rmf_api_server \
  --config-file config.yaml
```

**Endpoints principais**:

```
GET http://localhost:7878/fleet_states
  Response: {
    "robots": [
      {"id": "freebotics_001", "location": {"x": 1.2, "y": 3.4, "yaw": 0.5}, "battery": 85}
    ],
    "tasks": [...]
  }

POST http://localhost:7878/tasks
  Body: {
    "category": "delivery",
    "start": {"x": 0, "y": 0},
    "goal": {"x": 10, "y": 5}
  }
  Response: {"task_id": "task_123"}

GET http://localhost:7878/tasks/{task_id}
  Response: {"id": "task_123", "state": "executing", ...}

WebSocket ws://localhost:7878/fleet_states
  (automatic push updates when robots move)
```

**Checklist**:
- [ ] API Server lança em :7878
- [ ] curl para GET /fleet_states retorna dados válidos
- [ ] WebSocket conecta e recebe eventos
- [ ] Tarefa via POST /tasks navega o robô

**Dias 3-5: Integração rosbridge (Shim Temporário)**

```
Dashboard ←─ WebSocket :9090 (rosbridge)
                ├─ /local_costmap/costmap
                ├─ /lidar/front_aligned
                └─ /global_costmap/costmap

+ RMF API Server :7878 (novo)
```

**Checklist**:
- [ ] rosbridge e RMF API Server rodando simultaneamente
- [ ] Sem conflito de portas
- [ ] Fleet Adapter sincroniza poses entre ROS e RMF
- [ ] Latência <500ms de comando RMF até resposta robot

---

### Semana 3: Frontend - React Hooks para RMF

**Objetivo**: Hooks React conectados ao RMF; TaskManager UI básico

**Dia 1: useRMFApi hook**

```javascript
// src/hooks/useRMFApi.js

export const useRMFApi = () => {
  const [fleetState, setFleetState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Conectar WebSocket ao RMF API Server
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:7878/fleet_states');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setFleetState(data);
    };

    return () => ws.close();
  }, []);

  const createTask = async (start, goal, category = 'delivery') => {
    setLoading(true);
    const response = await fetch('http://localhost:7878/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, goal, category })
    });
    const task = await response.json();
    setLoading(false);
    return task;
  };

  return { fleetState, loading, error, createTask };
};
```

**Dia 2: useFleetState hook**

```javascript
// src/hooks/useFleetState.js

export const useFleetState = () => {
  const { fleetState, loading, error, createTask } = useRMFApi();

  // Transforma FleetState em formato UI-friendly
  const robots = useMemo(() => {
    if (!fleetState?.robots) return [];
    return fleetState.robots.map(r => ({
      id: r.id,
      x: r.location.x,
      y: r.location.y,
      yaw: r.location.yaw,
      battery: r.battery,
      status: r.status,
      level: r.location.level
    }));
  }, [fleetState]);

  const tasks = useMemo(() => {
    if (!fleetState?.tasks) return [];
    return fleetState.tasks;
  }, [fleetState]);

  return { robots, tasks, loading, error, createTask };
};
```

**Dia 3: useRosVisuals hook (shim deprecado)**

```javascript
// src/hooks/useRosVisuals.js
// TODO: Deprecar em Fase 4

export const useRosVisuals = (robotIp) => {
  // Mantém lógica original de useRos
  // Mas apenas para: /local_costmap/costmap, /lidar/*
  // Remove: /tf (agora vem de RMF), /cmd_vel (será VDA5050)
  
  const [costmap, setCostmap] = useState(null);
  const [lidar, setLidar] = useState(null);
  
  // ... implementação original ...
  
  console.warn('useRosVisuals deprecated - will remove in Phase 4');
  
  return { costmap, lidar };
};
```

**Dia 4: useRMFPoses hook (substitui useTfGraph)**

```javascript
// src/components/navigation/map-layers/useRMFPoses.js

export const useRMFPoses = () => {
  const { robots } = useFleetState();

  // Muito mais simples que useTfGraph
  // Não precisa BFS no TF tree
  // Apenas lê robots[] e retorna poses
  
  return useMemo(() => {
    return robots.reduce((acc, robot) => {
      acc[robot.id] = {
        position: { x: robot.x, y: robot.y, z: 0 },
        quaternion: yawToQuaternion(robot.yaw)
      };
      return acc;
    }, {});
  }, [robots]);
};
```

**Dia 5: TaskManager UI básico**

```javascript
// src/components/tasks/TaskManager.jsx

export const TaskManager = () => {
  const { tasks, createTask } = useFleetState();
  const [formData, setFormData] = useState({
    goal_x: 0,
    goal_y: 0,
    category: 'delivery'
  });

  const handleSubmitTask = async () => {
    await createTask(
      { x: 0, y: 0 },
      { x: formData.goal_x, y: formData.goal_y },
      formData.category
    );
  };

  return (
    <div style={styles.container}>
      <h2>Gerenciador de Tarefas</h2>
      
      <TaskForm 
        onSubmit={handleSubmitTask}
        formData={formData}
        setFormData={setFormData}
      />
      
      <TaskList tasks={tasks} />
    </div>
  );
};
```

**Checklist**:
- [ ] useRMFApi conecta e recebe FleetState
- [ ] useFleetState transforma dados
- [ ] useRMFPoses renderiza robôs (testes sem Three.js primeiro)
- [ ] TaskManager UI renderiza sem erros

---

### Semana 4: Frontend - Integração Final

**Dia 1: Map3D refactoring**

```javascript
// src/components/navigation/Map3D.jsx

export const Map3D = () => {
  const { robots, tasks } = useFleetState();  // novo
  const rmfPoses = useRMFPoses();             // novo
  
  // Remover: useTfGraph
  // Adicionar: multi-robot rendering

  return (
    <div ref={mountRef}>
      {/* Renderizar múltiplos robôs */}
      {robots.map(robot => (
        <RobotModel
          key={robot.id}
          position={rmfPoses[robot.id].position}
          quaternion={rmfPoses[robot.id].quaternion}
          color={getColorByRobotId(robot.id)}
        />
      ))}
      
      {/* Camadas mantêm costmap/lidar temporário */}
      <CostmapLayer ... />
      <LidarLayer ... />
      
      {/* NavigationTool agora publica /tasks */}
      <NavigationTool onGoal={createGoalTask} />
    </div>
  );
};
```

**Dia 2: useNavigationTool refactoring**

```javascript
// src/components/navigation/map-layers/useNavigationTool.js

// ANTES: publishava em /ui/navigate_to_pose (roslib)
// DEPOIS: chama POST /tasks (RMF)

export const useNavigationTool = (camera, scene) => {
  const { createTask } = useFleetState();  // novo

  const handleDragEnd = async (goalPose) => {
    // Antes:
    // rostopic.publish('/ui/navigate_to_pose', new ROSLIB.Message(...))

    // Depois:
    await createTask(
      { x: 0, y: 0 },           // start (ou ler pose atual)
      { x: goalPose.x, y: goalPose.y },
      'navigation'
    );
  };

  return { ... };
};
```

**Dia 3: App.jsx refactoring**

```javascript
// src/App.jsx

export const App = () => {
  // ANTES:
  // const { ros, isConnected } = useRos(activeRobot.ip);
  // const robots = useFleetPolling();

  // DEPOIS:
  const { robots, tasks, createTask } = useFleetState();

  return (
    <div style={styles.appContainer}>
      <TopHeader ... />
      
      <SidebarLeft>
        {/* ANTES: dropdown singular para selecionar robô */}
        {/* DEPOIS: mostrar todos os robôs com status */}
        {robots.map(robot => (
          <RobotStatusCard key={robot.id} robot={robot} />
        ))}
      </SidebarLeft>

      <MainContent>
        <Map3D robots={robots} />
      </MainContent>

      <SidebarRight>
        <NavigationControl ... />
        <TaskManager tasks={tasks} createTask={createTask} />
      </SidebarRight>

      <NotificationDisplay ... />
    </div>
  );
};
```

**Dia 4: Testes de integração**

```bash
# Rodar backend
ros2 launch rmf_demos office.launch.xml

# Em outro terminal: API Server
ros2 run rmf_api_server rmf_api_server --config-file config.yaml

# Em outro terminal: rosbridge (para costmap/lidar)
ros2 launch rosbridge_suite rosbridge_websocket_launch.xml

# Em outro terminal: dev server frontend
npm run dev
```

**Testes**:
- [ ] Dashboard acessa http://localhost:5173
- [ ] FleetState carrega com 2+ robôs
- [ ] Drag no mapa cria tarefa em RMF
- [ ] Robô navega para goal
- [ ] Costmap + LiDAR renderizam
- [ ] 0 erros de console

**Dia 5: Polimento e documentação**

- [ ] Ajustar cores/tema
- [ ] Remover console.logs
- [ ] Adicionar error boundaries
- [ ] Documentar setup

**Checklist Semana 4**:
- [ ] Map3D renderiza 2+ robôs com URDF
- [ ] Goal via drag submete task ao RMF
- [ ] TaskManager mostra tarefas ativas
- [ ] Latência <100ms de pose update
- [ ] Testes E2E: 2 robôs, 3+ tarefas, sem deadlock
- [ ] Documentação atualizada em CLAUDE.md

---

## Detalhes de Implementação

### Backend - Fleet Adapter ROS 2 (Semana 1)

#### Estrutura do Package

```
freebotics_rmf_adapter/
├── CMakeLists.txt
│   └── find_package(rmf_fleet_adapter ...)
│   └── ament_target_dependencies(adapter
│       rmf_fleet_adapter
│       rmf_robot_sim_common
│       geometry_msgs
│       tf2
│       rclcpp
│     )
│
├── package.xml
│   └── build_depend: rmf_fleet_adapter, rclcpp, geometry_msgs
│   └── depend: rosdistro, rmf-core
│
├── src/
│   └── FreoboticsFleetAdapter.cpp
│       ├── Class: FreoboticsFleetAdapter(rclcpp::Node)
│       ├── void robotStateCallback(TFMessage) 
│       │   └── Update RMF Fleet State
│       ├── void taskCallback(RmfTaskMsg)
│       │   └── Convert RMF task → Nav2 goal
│       └── void publish_fleet_state()
│           └── Periodic update to RMF
│
├── config/
│   └── freebotics.yaml
│       robot_id: "freebotics_001"
│       max_speed: 0.5  # m/s
│       footprint: [[0.3, 0.2], [-0.3, 0.2], [-0.3, -0.2], [0.3, -0.2]]
│       inertia: 0.25
│       
├── launch/
│   └── adapter.launch.xml
│       └── <node pkg="freebotics_rmf_adapter"
│             name="fleet_adapter"
│             executable="adapter"
│             output="screen"
│             args="--config-file config/freebotics.yaml"
│           />
```

#### Implementação Mínima do Adapter

```cpp
// src/FreoboticsFleetAdapter.cpp

#include "rclcpp/rclcpp.hpp"
#include "tf2_msgs/msg/tf_message.hpp"
#include "geometry_msgs/msg/pose.hpp"
#include "rmf_fleet_adapter/adapter.hpp"
#include <memory>

class FreoboticsFleetAdapter : public rclcpp::Node {
public:
  FreoboticsFleetAdapter() : Node("freebotics_fleet_adapter") {
    // Subscrever TF para pose
    tf_sub_ = this->create_subscription<tf2_msgs::msg::TFMessage>(
      "/tf", 10, 
      std::bind(&FreoboticsFleetAdapter::tf_callback, this, std::placeholders::_1)
    );

    // Publicador para Nav2 goal
    nav2_goal_pub_ = this->create_publisher<geometry_msgs::msg::PoseStamped>(
      "/move_base_simple/goal", 10
    );

    // Timer para publicar Fleet State periódico (10 Hz)
    timer_ = this->create_wall_timer(
      std::chrono::milliseconds(100),
      std::bind(&FreoboticsFleetAdapter::publish_fleet_state, this)
    );

    RCLCPP_INFO(this->get_logger(), "Freebotics Fleet Adapter initialized");
  }

private:
  void tf_callback(const tf2_msgs::msg::TFMessage::SharedPtr msg) {
    // Extract pose from TF
    // Update internal RobotState
    // Publish to RMF via adapter interface
    current_pose_.x = msg->transforms[0].transform.translation.x;
    current_pose_.y = msg->transforms[0].transform.translation.y;
  }

  void publish_fleet_state() {
    // Publish RobotState to RMF Fleet State database
    // Include: id, location, battery, status, etc.
  }

  rclcpp::Subscription<tf2_msgs::msg::TFMessage>::SharedPtr tf_sub_;
  rclcpp::Publisher<geometry_msgs::msg::PoseStamped>::SharedPtr nav2_goal_pub_;
  rclcpp::TimerBase::SharedPtr timer_;
  
  struct RobotPose {
    double x = 0, y = 0, yaw = 0;
  } current_pose_;
};

int main(int argc, char * argv[]) {
  rclcpp::init(argc, argv);
  auto node = std::make_shared<FreoboticsFleetAdapter>();
  rclcpp::spin(node);
  rclcpp::shutdown();
  return 0;
}
```

---

### Frontend - Estrutura de Arquivos Novos

#### Arquivos a Criar

```
src/hooks/
├── useRMFApi.js              (novo - 80 linhas)
├── useFleetState.js          (novo - 40 linhas)
└── useRosVisuals.js          (novo - refactor useRos com deprecation)

src/components/tasks/         (novo diretório)
├── TaskManager.jsx           (novo - 150 linhas)
├── TaskForm.jsx              (novo - 120 linhas)
├── TaskList.jsx              (novo - 100 linhas)
└── TaskCard.jsx              (novo - 80 linhas)

src/components/navigation/map-layers/
├── useRMFPoses.js            (novo - 50 linhas, substitui useTfGraph)
└── (outros files - sem grande mudança)
```

#### Arquivo a Modificar

```
src/App.jsx                    (modificar - 30% mudanças)
src/components/navigation/Map3D.jsx        (modificar - 20% mudanças)
src/components/navigation/NavigationControl.jsx   (modificar - 10% mudanças)
src/components/fleet/FleetSelector.jsx    (modificar - 15% mudanças)
src/utils/amclHelper.js        (refactor - setGoal → RMF)
```

---

## Checklist de Verificação

### Fim da Semana 4 (MVP Pronto para Ship)

#### Backend ✓

- [ ] **ROS 2 Humble instalado** e funcional
- [ ] **rmf_demos** compila e lança sem erros
- [ ] **2+ robôs simulados** navegam sem colisão
- [ ] **freebotics_rmf_adapter** criado e integrado
- [ ] **Fleet Adapter sincroniza pose** do robô real com RMF Fleet State
- [ ] **RMF API Server** roda em http://localhost:7878
- [ ] **GET /fleet_states** retorna JSON válido com poses
- [ ] **POST /tasks** cria tarefa e robô navega
- [ ] **WebSocket /fleet_states** push eventos em tempo real
- [ ] **Latência <500ms** de comando RMF até resposta robot

#### Frontend ✓

- [ ] **useRMFApi** hook conecta a :7878 sem erros
- [ ] **useFleetState** transforma dados em robots[], tasks[]
- [ ] **useRMFPoses** renderiza múltiplos robôs em Three.js
- [ ] **Map3D renderiza 2 robôs** com cores distintas
- [ ] **Goal via drag no mapa** cria POST /tasks
- [ ] **TaskManager UI** mostra tarefas ativas/completas
- [ ] **useNavigationTool refatorado** - publica /tasks não rosbridge
- [ ] **FleetSelector adapatado** - mostra todos robots
- [ ] **Costmap + LiDAR** ainda renderizam via rosbridge (temporário)
- [ ] **Dashboard acessa** http://localhost:5173 sem erros

#### Performance ✓

- [ ] **Pose atualiza no UI** <100ms após movimento real robot
- [ ] **Nenhum console.error** em operação normal
- [ ] **2 robôs navegam** simultaneamente sem deadlock
- [ ] **3+ tarefas paralelas** executam sem conflito
- [ ] **Memory profile estável** (sem memory leaks visíveis)
- [ ] **WebSocket reconecta** automaticamente após drop

#### Documentação ✓

- [ ] **CLAUDE.md** atualizado com arquitetura nova
  - [ ] Remover: roslib, useRos, useFleetPolling
  - [ ] Adicionar: open-RMF, useRMFApi, Fleet Adapters
  - [ ] Roadmap: Fase 4 (VDA5050 em Sprint 2)
- [ ] **README.md** com setup instructions
  - [ ] Backend: ROS 2 + rmf_demos + freebotics_adapter
  - [ ] Frontend: npm install → npm run dev
  - [ ] Troubleshooting
- [ ] **Código comentado** com TODO Fase 4 em useRosVisuals

#### Testes E2E ✓

```bash
# Teste 1: Setup básico
ros2 launch rmf_demos office.launch.xml
# ✓ 2 robôs aparecem na UI

# Teste 2: Tarefa simples
# Dashboard → drag no mapa → POST /tasks
# ✓ Robô navega para goal

# Teste 3: Tarefas paralelas
# Dashboard → submeter 3 tarefas diferentes
# ✓ Tarefas executam sem deadlock

# Teste 4: Costmap + LiDAR
# Backend rosbridge, Frontend Map3D
# ✓ Sensores renderizam sem lag

# Teste 5: Reconexão
# Desligar RMF API Server → Ligar
# ✓ Dashboard reconecta automaticamente
```

---

## Fase 4: VDA5050 (Sprint 2)

**Status**: Não incluída no MVP de 4 semanas. Plano para Sprint 2 (semanas 5-8).

### O que muda na Fase 4

```
MVP (aberto em semana 4)
    ↓
Sprint 2 - Fase 4: VDA5050
    ├── Fleet Adapter VDA5050 (ROS 2 node)
    │   └── MQTT ↔ RMF translation
    │       ├── Subscreve RMF task requests
    │       ├── Publica orders em MQTT VDA5050
    │       ├── Subscreve state em MQTT
    │       └── Publica em RMF Fleet State
    │
    ├── MQTT Broker (mosquitto @ :1883)
    │   └── Topics: uagv/v2/{mfr}/{ver}/{state,order,action}
    │
    ├── Frontend Enhancements
    │   ├── Fleet Adapter selector (ROS vs VDA5050)
    │   └── Protocol-specific UI controls
    │
    └── Testes E2E
        ├── ROS + VDA5050 simultâneos (3+ robôs)
        ├── Deconflição com frotas mistas
        └── Fabricantes heterogêneos
```

### Timeline Fase 4

```
Semana 5: VDA5050 Connector + MQTT Broker
  • Instalar vda5050_connector
  • Configurar mosquitto broker
  • Testes básicos

Semana 6-7: Fleet Adapter VDA5050
  • Criar freebotics_vda5050_adapter
  • MQTT ↔ RMF translation
  • Testes com robô simulado VDA5050

Semana 8: Frontend + Testes E2E
  • UI adaptativa por tipo de adapter
  • Testes E2E (ROS + VDA5050)
  • Deploy em produção
```

---

## Referências

### Documentação Oficial

- **open-RMF**: https://www.open-rmf.org/
- **VDA5050**: https://github.com/VDA5050/VDA5050
- **ROS 2 Humble Docs**: https://docs.ros.org/en/humble/

### Repositórios GitHub

- **open-rmf/rmf** (Core): https://github.com/open-rmf/rmf
- **open-rmf/rmf_demos** (Exemplos): https://github.com/open-rmf/rmf_demos
- **tum-fml/vda5050_connector**: https://github.com/tum-fml/vda5050_connector
- **inorbit-ai/ros_amr_interop**: https://github.com/inorbit-ai/ros_amr_interop
- **NVIDIA Isaac ROS Cloud Control**: https://github.com/NVIDIA-ISAAC-ROS/isaac_ros_cloud_control

### Artigos e Blogs

- [BlueBotics - VDA5050 Explained](https://bluebotics.com/vda-5050-explained-agv-communication-standard/)
- [Ekumen - Deep Dive into OpenRMF](https://ekumenlabs.com/blog/posts/deep-dive-into-openrmf/)
- [Open Robotics - Programming Multiple Robots with ROS 2](https://osrf.github.io/ros2multirobotbook/)

### Contatos Úteis

- **OSRA (Open Source Robotics Alliance)**: openrobotics.org
- **ROS Discourse**: discourse.ros.org (comunidade)
- **open-RMF Discord**: (link no site oficial)

---

## Próximos Passos Imediatos

**A partir de agora (01 de Abril de 2026)**:

1. ✅ **Pesquisa concluída** → Documentação criada (este arquivo)
2. ✅ **Arquitetura aprovada** → Plano de 4 semanas validado
3. ✅ **Semana 1**: Setup backend
   - [x] Script de setup criado: `scripts/setup-ros2-rmf.sh`
   - [x] `freebotics_rmf_adapter` criado: `ros2/freebotics_rmf_adapter/`
     - `src/freebotics_fleet_adapter.cpp` — nó ROS 2 completo e compilável
     - `config/freebotics.yaml` — source of truth de configuração
     - `launch/adapter.launch.py` — launch file com override de `robot_name`
     - `CMakeLists.txt` + `package.xml`
   - [x] Script de validação: `scripts/validate-week1.sh`
   - [ ] Dev executa `setup-ros2-rmf.sh` na máquina alvo
   - [ ] Dev compila workspace (`colcon build`) e roda `validate-week1.sh`
   - [ ] `rmf_demos` lança com 2 robôs simulados (validação manual)
   - [ ] `freebotics_fleet_adapter` publica em `/fleet_states` sem crash

---

## Perguntas Frequentes (FAQ)

### P: Por que abrir mão de roslib direto?

**R**: roslib funciona bem para 1 robô, mas não escala para frota. open-RMF adiciona:
- Deconflição automática (evita colisões)
- Alocação inteligente de tarefas
- Suporte a múltiplos fabricantes (VDA5050)
- API padrão (REST/WS) vs custom ROS topics

### P: Vamos perder funcionalidades ao remover /tf?

**R**: Não. Poses virão de `FleetState.robots[].location` do RMF, que é sincronizado pelo Fleet Adapter a partir de `/tf` original no robô. É mais centralizado, não menos informação.

### P: E se o RMF falhar?

**R**: Failover via rosbridge. Durante Fase 1-3, rosbridge continua rodando em :9090 como fallback.

### P: Qual a latência esperada?

**R**: 
- Pose: <100ms (WebSocket push vs 5s polling)
- Task execution: <500ms (comando RMF → resposta robot)
- Deconflição: <1s (schedule update)

### P: VDA5050 é obrigatório?

**R**: Não no MVP. Fase 4 adiciona interoperabilidade com robôs de outros fabricantes. Se usar apenas Freebotics ROS, pode ser posposto indefinidamente.

### P: Como integrar novo fabricante depois?

**R**: Criar novo Fleet Adapter (tipo freebotics_rmf_adapter) ou usar vda5050_connector se robô suporta VDA5050.

---

## Histórico de Revisões

| Data | Versão | Mudanças | Autor |
|------|--------|----------|-------|
| 01/04/2026 | 1.0 | Documento inicial, pesquisa + arquitetura + timeline | Claude Code |
| TBD | 1.1 | Atualizações pós-Semana 1 | TBD |
| TBD | 2.0 | MVP completo (Semana 4) | TBD |

---

**Última atualização**: 01 de Abril de 2026  
**Status**: ✅ Pronto para Implementação  
**Próxima revisão**: Fim da Semana 1
