# Auditoria de Dependências Roslib/Rosbridge - Hermes Dashboard

**Data**: 28 de Abril de 2026  
**Status**: Concluído  
**Objetivo**: Mapar todas as dependências de roslib/rosbridge para planejar migração para open-RMF

---

## Seção A — Inventário por Arquivo

### src/hooks/useRos.js
**Tipo de dependência**: Hook consumidor  
**Recebe ros como**: Retorno do hook  
**Topics subscritos (ROS → Frontend)**: Nenhum (conexão WebSocket apenas)  
**Topics publicados (Frontend → ROS)**: Nenhum  
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-1 Substituir por RMF API** (hook inteiro será substituído por useRMFApi)

### src/utils/SimpleTfGraph.js
**Tipo de dependência**: Utilitário ROS  
**Recebe ros como**: Parâmetro de construtor  
**Topics subscritos (ROS → Frontend)**:
- `/tf` - `tf2_msgs/TFMessage` - Árvore de transforms
- `/tf_static` - `tf2_msgs/TFMessage` - Static transforms  
**Topics publicados (Frontend → ROS)**: Nenhum  
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-3 Deprecar Fase 4** (será substituído por useRMFPoses)

### src/utils/amclHelper.js
**Tipo de dependência**: Utilitário ROS  
**Recebe ros como**: Parâmetro de construtor  
**Topics subscritos (ROS → Frontend)**: Nenhum  
**Topics publicados (Frontend → ROS)**:
- `/initialpose` - `geometry_msgs/msg/PoseWithCovarianceStamped` - Set initial pose
- `/goal_pose` - `geometry_msgs/msg/PoseStamped` - Set goal position
**Services chamados**:
- `/reinitialize_global_localization` - `std_srvs/srv/Empty` - Reinitialize global localization
**Destino na migração**: **CAT-3 Deprecar Fase 4** (será substituído por RMF Task API)

### src/App.jsx
**Tipo de dependência**: Componente UI  
**Recebe ros como**: Prop do hook useRos  
**Topics subscritos (ROS → Frontend)**:
- `/robot/mode_str` - `std_msgs/String` - Robot mode (via initPoseTopic)
- `/initialpose` - `geometry_msgs/msg/PoseWithCovarianceStamped` - Initial pose setup
**Topics publicados (Frontend → ROS)**:
- `/cmd_vel` - `geometry_msgs/Twist` - Stop robot command
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-1 Substituir por RMF API** (will use useRMFApi hook)

### src/components/display/DashboardPanel.jsx
**Tipo de dependência**: Componente UI  
**Recebe ros como**: Prop  
**Topics subscritos (ROS → Frontend)**:
- `/hoverboard_base_controller/odom` - `nav_msgs/Odometry` - Velocity tracking
- `/battery_state` - `sensor_msgs/BatteryState` - Battery percentage
- `/robot/mode_str` - `std_msgs/String` - Robot mode
**Topics publicados (Frontend → ROS)**: Nenhum  
**Services chamados**:
- `/robot/set_mode` - `freebotics_msgs/SetMode` - Change robot mode
**Destino na migração**: **CAT-1 Substituir por RMF API** (battery/mode virão de FleetState)

### src/components/controls/Joystick.jsx
**Tipo de dependência**: Componente UI  
**Recebe ros como**: Prop  
**Topics subscritos (ROS → Frontend)**: Nenhum  
**Topics publicados (Frontend → ROS)**:
- `/hoverboard_base_controller/cmd_vel` - `geometry_msgs/Twist` - Velocity commands
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-1 Substituir por RMF API** (cmd_vel será substituído por RMF task execution)

### src/components/navigation/NavigationControl.jsx
**Tipo de dependência**: Componente UI  
**Recebe ros como**: Prop  
**Topics subscritos (ROS → Frontend)**: Nenhum  
**Topics publicados (Frontend → ROS)**:
- `/initialpose` - `geometry_msgs/msg/PoseWithCovarianceStamped` - Initial pose via initPoseTopicRef
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-1 Substituir por RMF API** (initialpose será enviado via RMF task)

### src/components/navigation/map-layers/useCostmapLayer.js
**Tipo de dependência**: Hook de visualização  
**Recebe ros como**: Parâmetro de hook  
**Topics subscritos (ROS → Frontend)**:
- `/local_costmap/costmap` - `nav_msgs/OccupancyGrid` - Local costmap data
- `/global_costmap/costmap` - `nav_msgs/OccupancyGrid` - Global costmap data
- `/map` - `nav_msgs/OccupancyGrid` - Static map
**Topics publicados (Frontend → ROS)**: Nenhum  
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-2 Manter via rosbridge Fase 1-3** (RMF não fornece costmaps)

### src/components/navigation/map-layers/useLidarLayer.js
**Tipo de dependência**: Hook de visualização  
**Recebe ros como**: Parâmetro de hook  
**Topics subscritos (ROS → Frontend)**:
- `/lidar/front_aligned` - `sensor_msgs/msg/LaserScan` - Front LiDAR data
- `/lidar/rear_aligned` - `sensor_msgs/msg/LaserScan` - Rear LiDAR data
**Topics publicados (Frontend → ROS)**: Nenhum  
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-2 Manter via rosbridge Fase 1-3** (RMF não fornece LiDAR)

### src/components/navigation/map-layers/usePathLayer.js
**Tipo de dependência**: Hook de visualização  
**Recebe ros como**: Parâmetro de hook  
**Topics subscritos (ROS → Frontend)**:
- `/plan` - `nav_msgs/Path` - Navigation path
**Topics publicados (Frontend → ROS)**: Nenhum  
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-2 Manter via rosbridge Fase 1-3** (RMF não fornece path planning visualization)

### src/components/navigation/map-layers/useNavigationTool.js
**Tipo de dependência**: Hook de interação  
**Recebe ros como**: Parâmetro de hook  
**Topics subscritos (ROS → Frontend)**: Nenhum  
**Topics publicados (Frontend → ROS)**:
- `/ui/navigate_to_pose` - `geometry_msgs/msg/PoseStamped` - Goal pose
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-1 Substituir por RMF API** (será substituído por POST /tasks)

### src/components/navigation/map-layers/useRobotModel.js
**Tipo de dependência**: Hook de visualização  
**Recebe ros como**: Parâmetro de hook  
**Topics subscritos (ROS → Frontend)**:
- `/footprint` - `geometry_msgs/PolygonStamped` - Robot footprint
**Topics publicados (Frontend → ROS)**: Nenhum  
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-2 Manter via rosbridge Fase 1-3** (footprint é visual, pode ser migrado depois)

### src/components/navigation/Map3D.jsx
**Tipo de dependência**: Componente principal  
**Recebe ros como**: Prop  
**Topics subscritos (ROS → Frontend)**:
- `/robot/mode_str` - `std_msgs/String` - Robot mode
**Topics publicados (Frontend → ROS)**: Nenhum  
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-1 Substituir por RMF API** (irá consumir useRMFPoses)

### src/hooks/useExternalScript.js
**Tipo de dependência**: Utilitário  
**Recebe ros como**: Nenhum  
**Topics subscritos (ROS → Frontend)**: Nenhum  
**Topics publicados (Frontend → ROS)**: Nenhum  
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-4 Avaliar caso a caso** (utilitário genérico, não específico de ROS)

### src/hooks/useFleetPolling.js
**Tipo de dependência**: Hook de dados  
**Recebe ros como**: Nenhum  
**Topics subscritos (ROS → Frontend)**: Nenhum  
**Topics publicados (Frontend → ROS)**: Nenhum  
**Services chamados**: Nenhum  
**Destino na migração**: **CAT-3 Deprecar Fase 4** (será substituído por useFleetState)

---

## Seção B — Grafo de Propagação do Objeto `ros`

```
useRos(robotIp)
└─► App.jsx (ros, isConnected)
    ├─► Map3D (ros prop)
    │     ├─► useTfGraph(ros) → SimpleTfGraph
    │     ├─► useRobotModel(ros, scene, tfGraph, showFootprint)
    │     │     └─► footprint subscriber
    │     ├─► useLidarLayer(ros, parentGroup, tfGraph)
    │     │     ├─► /lidar/front_aligned subscriber
    │     │     └─► /lidar/rear_aligned subscriber
    │     ├─► useCostmapLayer(ros, scene)
    │     │     ├─► /local_costmap/costmap subscriber
    │     │     ├─► /global_costmap/costmap subscriber
    │     │     └─► /map subscriber
    │     ├─► usePathLayer(ros, scene)
    │     │     └─► /plan subscriber
    │     ├─► useNavigationTool(ros, scene, camera, floorPlane, activeTool, setActiveTool)
    │     │     ├─► /ui/navigate_to_pose publisher
    │     │     └─► /initialpose publisher
    │     └► AMCLHelper(ros) [constructor]
    │           ├─► /initialpose publisher
    │           └─► /goal_pose publisher
    │
    ├─► DashboardPanel (ros prop)
    │     ├─► /hoverboard_base_controller/odom subscriber
    │     ├─► /battery_state subscriber
    │     ├─► /robot/mode_str subscriber
    │     └► /robot/set_mode service
    │
    ├─► Joystick (ros prop)
    │     └► /hoverboard_base_controller/cmd_vel publisher
    │
    └► NavigationControl (ros prop)
          └► initPoseTopicRef (/initialpose publisher)
```

---

## Seção C — Classificação por Destino de Migração

### **CATEGORIA 1 — Substituir por RMF API (Fase 1-3)**
Arquivos que usam roslib para funcionalidades que o open-RMF vai cobrir nativamente:

- `src/hooks/useRos.js` → Será substituído por `useRMFApi`
- `src/App.jsx` → Will consume `useRMFApi` instead of `useRos`
- `src/components/display/DashboardPanel.jsx` → Battery e mode virão de `FleetState`
- `src/components/controls/Joystick.jsx` → `cmd_vel` será substituído por RMF task execution
- `src/components/navigation/NavigationControl.jsx` → `initialpose` será enviado via RMF
- `src/components/navigation/map-layers/useNavigationTool.js` → Goal será enviado via POST /tasks
- `src/components/navigation/Map3D.jsx` → Irá consumir `useRMFPoses` em vez de `useTfGraph`
- `src/hooks/useFleetPolling.js` → Será substituído por `useFleetState`

### **CATEGORIA 2 — Manter via rosbridge temporariamente (Fase 1-3)**
Arquivos que usam roslib para dados de sensor que o RMF não fornece:

- `src/components/navigation/map-layers/useCostmapLayer.js`
  - `/local_costmap/costmap`
  - `/global_costmap/costmap`
  - `/map`
- `src/components/navigation/map-layers/useLidarLayer.js`
  - `/lidar/front_aligned`
  - `/lidar/rear_aligned`
- `src/components/navigation/map-layers/usePathLayer.js`
  - `/plan`

### **CATEGORIA 3 — Deprecar em Fase 4**
Arquivos que serão inteiramente eliminados quando rosbridge for removido:

- `src/utils/SimpleTfGraph.js` → Substituído por `useRMFPoses`
- `src/utils/amclHelper.js` → Substituído por RMF Task API
- `src/hooks/useFleetPolling.js` → Substituído por `useFleetState`

### **CATEGORIA 4 — Avaliar caso a caso**
Dependências ambíguas ou que precisam de decisão de arquitetura:

- `src/components/navigation/map-layers/useRobotModel.js`
  - `/footprint` topic - Robot footprint visualization
  - Pode ser migrado para RMF ou mantido via rosbridge
- `src/hooks/useExternalScript.js`
  - Utilitário genérico para carregar scripts externos
  - Não é específico de ROS, pode ser mantido

---

## Seção D — Tabela de Topics Completa

| Topic | Direção | messageType | Arquivo(s) | Categoria migração |
|-------|---------|------------|------------|-------------------|
| `/tf` | SUB | `tf2_msgs/TFMessage` | SimpleTfGraph.js | CAT-3 Deprecar Fase 4 |
| `/tf_static` | SUB | `tf2_msgs/TFMessage` | SimpleTfGraph.js | CAT-3 Deprecar Fase 4 |
| `/local_costmap/costmap` | SUB | `nav_msgs/OccupancyGrid` | useCostmapLayer.js | CAT-2 Manter Fase 1-3 |
| `/global_costmap/costmap` | SUB | `nav_msgs/OccupancyGrid` | useCostmapLayer.js | CAT-2 Manter Fase 1-3 |
| `/map` | SUB | `nav_msgs/OccupancyGrid` | useCostmapLayer.js | CAT-2 Manter Fase 1-3 |
| `/lidar/front_aligned` | SUB | `sensor_msgs/msg/LaserScan` | useLidarLayer.js | CAT-2 Manter Fase 1-3 |
| `/lidar/rear_aligned` | SUB | `sensor_msgs/msg/LaserScan` | useLidarLayer.js | CAT-2 Manter Fase 1-3 |
| `/plan` | SUB | `nav_msgs/Path` | usePathLayer.js | CAT-2 Manter Fase 1-3 |
| `/robot/mode_str` | SUB | `std_msgs/String` | App.jsx, DashboardPanel.jsx, Map3D.jsx | CAT-1 Substituir por RMF |
| `/initialpose` | PUB | `geometry_msgs/msg/PoseWithCovarianceStamped` | App.jsx, NavigationControl.jsx, amclHelper.js | CAT-1 Substituir por RMF |
| `/ui/navigate_to_pose` | PUB | `geometry_msgs/msg/PoseStamped` | useNavigationTool.js | CAT-1 Substituir por RMF |
| `/cmd_vel` | PUB | `geometry_msgs/Twist` | App.jsx, Joystick.jsx | CAT-1 Substituir por RMF |
| `/hoverboard_base_controller/odom` | SUB | `nav_msgs/Odometry` | DashboardPanel.jsx | CAT-1 Substituir por RMF |
| `/battery_state` | SUB | `sensor_msgs/BatteryState` | DashboardPanel.jsx | CAT-1 Substituir por RMF |
| `/robot/set_mode` | SERVICE | `freebotics_msgs/SetMode` | DashboardPanel.jsx | CAT-1 Substituir por RMF |
| `/goal_pose` | PUB | `geometry_msgs/msg/PoseStamped` | amclHelper.js | CAT-3 Deprecar Fase 4 |
| `/reinitialize_global_localization` | SERVICE | `std_srvs/srv/Empty` | amclHelper.js | CAT-3 Deprecar Fase 4 |
| `/footprint` | SUB | `geometry_msgs/PolygonStamped` | useRobotModel.js | CAT-4 Avaliar caso a caso |

---

## Seção E — Riscos e Dependências Ocultas

### 1. Props Spread em Map3D
```jsx
// Em App.jsx - props são passados sem explicitar 'ros'
<Suspense fallback={<div>Carregando Mapa...</div>}>
  <ErrorBoundary>
    <Map3D ros={ros} showFootprint={showFootprint} viewMode={viewMode} activeTool={activeTool} setActiveTool={setActiveTool} />
  </ErrorBoundary>
</Suspense>
```
**Risco**: Se `ros` for undefined em algum momento, pode causar erros em componentes filhos.

### 2. window.ROSLIB Acesso Dinâmico
```javascript
// Múltiplos locais onde window.ROSLIB é acessado diretamente
if (!window.ROSLIB) {
  console.error("window.ROSLIB is not loaded!");
}
```
**Risco**: Roslib pode não estar carregado no momento da execução, especialmente em cenários de SPA navigation.

### 3. Topics Criados Dinamicamente
```javascript
// Em NavigationControl.jsx - topic name pode vir de variável
const initPoseTopicRef = useRef(null);
if (isRoslibReady && window.ROSLIB) {
  initPoseTopicRef.current = new window.ROSLIB.Topic({
    ros, name: '/initialpose', messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped'
  });
}
```
**Risco**: Hardcoded topics não são um problema, mas sugere padrão que poderia ser mais genérico.

### 4. Referência ao IP do Robô
```javascript
// Em useRos.js - IP é dinâmico mas não vem de environment variable
const url = `ws://${robotIp}:9090`;
```
**Risco**: IP hardcoded na string, pode ser fonte de problemas em diferentes ambientes.

### 5. useEffect Dependencies
```javascript
// Vários useEffect dependem de 'ros' mas podem não limpar corretamente
useEffect(() => {
  if (!ros) return;
  // ... criar tópicos
  return () => {
    // ... limpeza
  };
}, [ros]);
```
**Risco**: Se ros mudar rapidamente, pode haver memory leaks de tópicos não desinscritos.

---

## Seção F — Estatísticas da Auditoria

**Total de arquivos com dependência roslib**: 15 arquivos  
**Topics subscritos (únicos)**: 13 topics  
**Topics publicados (únicos)**: 4 topics  
**Services chamados**: 3 services  
**Componentes que recebem ros como prop**: 6 componentes  
**Hooks que consomem ros diretamente**: 7 hooks  

**Classificação**:
- CAT-1 (Substituir por RMF): 8 arquivos
- CAT-2 (Manter rosbridge Fase 1-3): 3 arquivos
- CAT-3 (Deprecar Fase 4): 3 arquivos
- CAT-4 (Avaliar): 2 arquivos

---

## Conclusões

### Respostas Rápidas:

1. **"Posso remover o rosbridge agora?"** 
   - **Não**, aqui está por quê: [CAT-2 - useCostmapLayer.js, useLidarLayer.js, usePathLayer.js] ainda precisam de dados de sensor que o RMF não fornece.

2. **"O que muda na Semana 3 do plano de migração?"**
   - [CAT-1] - Refatorar 8 arquivos para usar RMF API:
     - `useRos.js` → `useRMFApi`
     - `useFleetPolling.js` → `useFleetState`
     - DashboardPanel, Joystick, NavigationControl, Map3D, useNavigationTool
     - App.jsx para consumir hooks novos

3. **"O que some de vez na Fase 4?"**
   - [CAT-3] - Remover 3 arquivos quando rosbridge for desativado:
     - `SimpleTfGraph.js` (substituído por `useRMFPoses`)
     - `amclHelper.js` (substituído por RMF Task API)
     - `useFleetPolling.js` (já substituído na Semana 3)

4. **"Tem algum risco escondido?"**
   - [CAT-4 + Seção E] - Riscos identificados:
     - Props spread em Map3D
     - Acesso dinâmico a window.ROSLIB
     - Limpeza de useEffect com ros dependency
     - Topics hardcoded (menor risco)