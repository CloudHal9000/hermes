# Campos Inferidos - Necessitam Verificação

Estes campos foram inferidos com base na documentação existente, mas precisam de confirmação contra o RMF API Server real:

## RMF API Types

### RobotState
- **`battery: number`** (0-100)
  - Inferido da seção "Battery estimation" do open-RMF
  - VERIFY: Confirmar se é percentagem (0-100) ou valor bruto

- **`status: string`**
  - Valores possíveis: "idle", "moving", "charging", "error"
  - VERIFY: Confirmar todos os estados válidos no RMF API

### TaskState
- **`state: string`**
  - Valores: "pending", "executing", "completed", "failed", "cancelled"
  - VERIFY: Confirmar se há outros estados possíveis

- **`assigned_robot_id?: string`**
  - Campo lógico para rastrear qual robô está executando a tarefa
  - VERIFY: Confirmar se este campo existe é é usado no RMF

### TaskRequest
- **`category: string`**
  - Valores: "delivery", "navigation", "patrol"
  - VERIFY: Confirmar categorias exatas suportadas

### FleetState
- **`tasks: TaskState[]`**
  - Inferido de que o Fleet State inclui tarefas ativas
  - VERIFY: Confirmar se tarefas vêm no mesmo objeto ou via endpoint separado

## ROS Legacy Types

### RosCostmapMessage
- **`data: Uint8Array`**
  - Baseado em nav2_msgs/OccupancyGrid
  - VERIFY: Confirmar formato exato (pode ser Int8Array em algumas versões)

### RosLidarMessage
- **`intensities: number[]`**
  - Nem todos os LiDAR fornecem intensidade
  - VERIFY: Confirmar se este campo é sempre presente

### RosInitialPoseMessage
- **`covariance: number[]`**
  - Deveria ter 36 elementos (6x6 matrix)
  - VERIFY: Confirmar tamanho e formato exato

## Verificação Necessária

Execute este fluxo de verificação quando o RMF API Server estiver disponível:

1. **GET /fleet_states** - Comparar resposta com `FleetState` type
2. **POST /tasks** - Comparar resposta com `TaskResponse` type  
3. **WebSocket /fleet_states** - Validar eventos push com `RMFWebSocketEvent`
4. **GET /tasks/{id}** - Comparar com `TaskState` type

## Instruções de Verificação

```javascript
// Exemplo de verificação no console do navegador
const response = await fetch('http://localhost:7878/fleet_states');
const data = await response.json();

// Importar os tipos para verificar
import { isFleetState } from './src/types/guards';

console.log('É FleetState válido?', isFleetState(data));
console.log('Dados recebidos:', data);
```

## Prioridade de Verificação

1. **Alta**: `FleetState.robots[]` e `TaskState` - estruturas centrais
2. **Média**: `TaskRequest` - usado em submissões de tarefas
3. **Baixa**: Campos opcionais como `assigned_robot_id`