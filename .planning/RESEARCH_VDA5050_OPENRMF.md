# Pesquisa: Integração VDA5050 + open-RMF ao Dashboard

## 1. Análise da Arquitetura Atual

### Stack Atual
- **Comunicação**: ROS 1 via WebSocket (roslib) + MQTT indireto
- **Fleet Management**: Polling simples via `/api/robots`
- **Visualização**: Three.js com URDF
- **Padrão de Comunicação**: ROS nativo (tópicos e serviços)

### Limitações Identificadas
1. **Sem padrão de interoperabilidade**: Dependente de ROS, não funciona com frota heterogênea
2. **Fleet management básico**: Apenas seleção e status, sem deconflição de tráfego
3. **Sem coordenação multi-frota**: Cada robô é independente
4. **Escalabilidade limitada**: Polling simples não escala bem

---

## 2. VDA5050 - Padrão de Comunicação

### O que é
Standard de comunicação entre AGVs/AMRs e Master Control (Fleet Manager) desenvolvido pela Associação Automotiva Alemã (VDA).

### Características Técnicas
- **Protocolo**: MQTT (JSON messages)
- **Modelo**: Cliente-Servidor (AGVs = clientes, Fleet Manager = servidor/broker)
- **Conceito Base**: Envio sequencial de comandos (orders) para completar missões
- **Vantagem Principal**: Interoperabilidade - um fleet manager funciona com veículos de diferentes fabricantes

### Estrutura de Mensagens
- **Topics MQTT padrão**:
  - `uagv/v2/{manufacturer}/{version}/state` (AGV → Master)
  - `uagv/v2/{manufacturer}/{version}/order` (Master → AGV)
  - `uagv/v2/{manufacturer}/{version}/action` (estados de ação)
  - `uagv/v2/{manufacturer}/{version}/visualization` (dados de visualização)

### Implementações ROS Existentes
1. **vda5050_connector** (TUM FML)
   - Bridge entre ROS 2 e VDA5050
   - Componentes: MQTT Bridge → Controller → Robot Adapter
   - Suporta VDA5050 v1.1+

2. **isaac_ros_cloud_control** (NVIDIA)
   - Fleet manager compatível com VDA5050
   - ROS 2 packages para controle em nuvem

3. **ros_amr_interop** (InOrbit)
   - Pacotes para simplificar integração

---

## 3. open-RMF - Framework de Fleet Management

### O que é
Framework open-source construído sobre ROS 2 para gerenciar frotas heterogêneas de robôs, coordenar tráfego compartilhado e alocar tarefas.

### Características Principais
- **Built on ROS 2**: Aproveita comunicação descentralizada
- **Deconflição de Tráfego**: Scheduleamento dinâmico de rotas evitando colisões
- **Alocação de Tarefas**: Distribuição inteligente entre múltiplos robôs
- **Integração com Infraestrutura**: Portas, elevadores, sistemas de construção
- **Fleet Adapters**: Tradução entre proprietary APIs e RMF

### Arquitetura Core
```
┌─────────────────────────────────────────────────────┐
│           RMF Core (ROS 2 based)                    │
├─────────────────────────────────────────────────────┤
│ rmf_traffic         - Scheduling & deconfliction    │
│ rmf_task            - Task planning & allocation    │
│ rmf_battery         - Battery estimation            │
│ rmf_ros2            - ROS 2 adapters & bindings    │
└─────────────────────────────────────────────────────┘
         ↑                              ↑
    ┌────┴────────────────────────────┴────┐
    │    Fleet Adapters (Translation Layer) │
    ├──────────────────────────────────────┤
    │ • Kinematic Transformation            │
    │ • Navigation Command Mapping          │
    │ • State Synchronization               │
    │ • Real-time Status Publication        │
    └──────────────────────────────────────┘
         ↑                              ↑
    Robot API 1                    Robot API N
```

### Traffic Deconfliction
- **Nível 1 (Prevenção)**: Traffic Schedule Database evita conflitos antecipadamente
- **Nível 2 (Resolução)**: Negociação entre fleet managers quando conflitos são inevitáveis

---

## 4. Modificações Necessárias no Dashboard

### 4.1 Arquitetura de Comunicação

#### Antes (ROS Puro)
```
Dashboard → roslib WebSocket → ROS Master (ws://robot_ip:9090)
                            ↓
                      Robot nativo ROS
```

#### Depois (VDA5050 + open-RMF)
```
Dashboard → RMF REST/gRPC API → open-RMF Core → Fleet Adapters → Robôs
                                      ↓
                                 MQTT Broker VDA5050
                                      ↓
                        Robôs VDA5050 ou ROS com vda5050_connector
```

### 4.2 Mudanças no Backend

#### Necessárias
1. **Implementar Fleet Manager (open-RMF)**
   - Instalação de rmf_core, rmf_ros2, rmf_task
   - Configuração do Traffic Schedule Database
   - Criação de Fleet Adapters para cada tipo de robô

2. **Suporte a VDA5050**
   - MQTT Broker (mosquitto ou similar)
   - vda5050_connector para robôs ROS legados
   - Mapear mensagens ROS → VDA5050

3. **Endpoint API Moderno**
   - Substituir polling simples por API RESTful ou gRPC
   - Endpoints para:
     - Listar robôs e status
     - Submeter tarefas
     - Visualizar schedule de tráfego
     - Negotiation de conflitos

### 4.3 Mudanças no Frontend

#### Hooks Customizados
| Componente Atual | Mudança Necessária | Novo Comportamento |
|---|---|---|
| `useRos` | Deprecar | Substituir por `useRMFApi` (REST/gRPC) |
| `useFleetPolling` | Modernizar | Event-driven via WebSocket ao invés de polling |
| App Architecture | Expand | Suportar múltiplas frotas (open-RMF) |

#### Novos Componentes
1. **Task Manager UI**
   - Submissão de tarefas estruturadas
   - Acompanhamento de execução
   - Histórico de tarefas

2. **Traffic Schedule Visualizer**
   - Timeline 4D (x, y, z, tempo) de rotas
   - Visualização de conflitos detectados
   - Status de negociação entre frotas

3. **Fleet Adapter Manager**
   - Seleção de tipo de robô (ROS, VDA5050, outro)
   - Configuração por tipo de frota

4. **Enhanced Dashboard**
   - Modo por frota (múltiplos robôs simultâneos)
   - Métricas agregadas
   - Alertas de conflito/negociação

### 4.4 Dependências de Código

#### Remover
- roslib (não necessário)
- useRos hook
- Polling baseado em /api/robots

#### Adicionar
```json
{
  "dependencies": {
    "@openrmf/rmf-web-core": "^1.0+",
    "mqtt": "^5.0+",
    "@grpc/grpc-js": "^1.8+",
    "protobufjs": "^7.0+"
  },
  "devDependencies": {
    "@openrmf/rmf-code-gen": "^1.0+"
  }
}
```

#### Backend (Python/ROS2)
```python
# Requisitos adicionados
- ros2
- rmf-core
- rmf-ros2
- vda5050-connector  # Se usando robôs legados
- mosquitto (MQTT broker)
```

---

## 5. Caminho de Migração (Phased Approach)

### Fase 1: Preparação (Semana 1-2)
- [ ] Instalar open-RMF em ambiente de desenvolvimento
- [ ] Configurar MQTT Broker local
- [ ] Estudar rmf_demos
- [ ] Planejar Fleet Adapter para robô atual

### Fase 2: Backend (Semana 2-4)
- [ ] Implementar Fleet Adapter para ROS atual
- [ ] Integrar open-RMF com roslib existente (compatibilidade)
- [ ] Criar API REST/gRPC para dashboard
- [ ] Testes de deconflição básica (2+ robôs)

### Fase 3: Frontend (Semana 4-6)
- [ ] Criar hook `useRMFApi` (substitui useRos)
- [ ] Implementar Task Manager UI
- [ ] Atualizar Map3D para múltiplos robôs
- [ ] Traffic Schedule Visualizer simples

### Fase 4: VDA5050 (Semana 6-8)
- [ ] Integrar vda5050_connector
- [ ] Testar com robôs VDA5050 (ou simulados)
- [ ] UI adaptativa por tipo de robô
- [ ] Documentação de integração

### Fase 5: Testes e Otimização (Semana 8+)
- [ ] E2E tests com múltiplas frotas
- [ ] Performance tuning
- [ ] Documentação completa
- [ ] Deploy em produção

---

## 6. Impacto no CLAUDE.md

Mudanças necessárias na documentação:

1. **Remover**: Seção de ROS WebSocket
2. **Adicionar**: 
   - Descrição de open-RMF architecture
   - Guia de Fleet Adapter development
   - VDA5050 integration guide
   - Migration path from roslib
3. **Atualizar**:
   - Dependencies
   - Architecture diagram
   - Common commands para incluir ROS 2 + RMF

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Backward compatibility com robôs ROS legados | Alta | Alto | vda5050_connector como bridge temporário |
| Complexidade de open-RMF | Alta | Alto | Usar rmf_demos como referência, treinamento |
| Performance com múltiplas frotas | Média | Médio | Profiling antecipado, cache de schedule |
| Curva de aprendizado MQTT/VDA5050 | Alta | Médio | Documentação, exemplos, testes simples primeiro |

---

## 8. Repositórios e Recursos Recomendados

### Oficiais
- [open-rmf/rmf](https://github.com/open-rmf/rmf) - Core
- [open-rmf/rmf_demos](https://github.com/open-rmf/rmf_demos) - Exemplos
- [VDA5050 Spec](https://github.com/VDA5050/VDA5050) - Standard
- [vda5050_connector](https://github.com/tum-fml/vda5050_connector) - ROS Bridge

### Documentação
- [open-rmf.org](https://www.open-rmf.org/)
- [Programming Multiple Robots with ROS 2](https://osrf.github.io/ros2multirobotbook/)
- [VDA5050 Overview](https://bluebotics.com/vda-5050-explained-agv-communication-standard/)

### Implementações Referência
- [NVIDIA Isaac ROS Cloud Control](https://github.com/NVIDIA-ISAAC-ROS/isaac_ros_cloud_control)
- [InOrbit ros_amr_interop](https://github.com/inorbit-ai/ros_amr_interop)

---

## 9. Próximos Passos

1. ✅ Pesquisa completada
2. ⬜ **Criar plano detalhado de arquitetura**
3. ⬜ **Prototipar integração open-RMF simples**
4. ⬜ **Adicionar suporte VDA5050 gradualmente**
5. ⬜ **Documentar padrões e conventions**
