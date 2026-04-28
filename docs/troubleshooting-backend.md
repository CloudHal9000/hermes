# Troubleshooting — Hermes Backend (Semana 2)

**Stack:** open-RMF API Server + freebotics_rmf_adapter + rosbridge  
**Diagnóstico rápido:** `bash scripts/validate-week2.sh --with-backend`

---

## Índice

1. [API Server não encontra fleet state — `GET /fleets` retorna vazio](#1-api-server-não-encontra-fleet-state)
2. [JWT inválido — frontend recebe 401](#2-jwt-inválido--frontend-recebe-401)
3. [Conflito de porta entre RMF API e rosbridge](#3-conflito-de-porta)
4. [Costmap não aparece no frontend](#4-costmap-não-aparece-no-frontend)
5. [Latência > 500ms no FleetState](#5-latência--500ms-no-fleetstate)
6. [colcon build falha no freebotics_rmf_adapter](#6-colcon-build-falha)
7. [rmf_api_server não inicia — config format error](#7-rmf_api_server-config-format)
8. [Port 7878 vs 8000 — discrepância entre Docker e ROS 2](#8-porta-7878-vs-8000)

---

## 1. API Server não encontra fleet state

**Sintoma:** `GET /fleets` ou `GET /fleet_states` retorna `[]` ou `{"robots":[]}`

**Causa mais provável:** O `freebotics_fleet_adapter` não está publicando no tópico `/fleet_states`.

**Diagnóstico em ordem:**

```bash
# 1. O adapter está rodando?
ros2 node list | grep freebotics
# Esperado: /freebotics_fleet_adapter

# 2. O tópico /fleet_states existe?
ros2 topic list | grep fleet_states
# Esperado: /fleet_states

# 3. O adapter está publicando dados?
ros2 topic echo /fleet_states --once
# Esperado: name: "freebotics", robots: [{name: "freebotics_001", ...}]

# 4. A frequência está correta?
ros2 topic hz /fleet_states
# Esperado: ~10.0 Hz

# 5. O RMF API Server está subscrito ao tópico?
ros2 topic info /fleet_states
# Esperado: Subscription count: >=1
```

**Solução por causa:**

| Causa | Solução |
|---|---|
| Adapter não iniciou | `ros2 launch freebotics_rmf_adapter adapter.launch.py` |
| TF não disponível (sem robô) | Publicar TF de teste: `ros2 run tf2_ros static_transform_publisher 0 0 0 0 0 0 map base_footprint` |
| rmf_api_server não subscreve `/fleet_states` | Verificar versão: `ros2 pkg xml rmf_api_server \| grep version` |

---

## 2. JWT inválido — frontend recebe 401

**Sintoma:** Console do browser mostra `[rmfClient] Token configurado` mas requests retornam 401. O `rmfClient.js` dispara `CustomEvent('rmf:auth-error')`.

**Diagnóstico:**

```bash
# 1. Decodificar o token do .env.local
TOKEN=$(grep VITE_RMF_TOKEN .env.local | cut -d= -f2)
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
# Verificar: "aud" deve ser "rmf_api_server"
# Verificar: "exp" deve ser no futuro (Unix timestamp)
# Verificar: "iss" deve corresponder ao jwt_issuer do servidor

# 2. Qual secret está o servidor usando?
# Para Docker:
cat docker/api-server-config.py | grep jwt_secret
# Para ROS 2 nativo:
grep jwt_secret ros2/config/rmf_api_server.config.yaml

# 3. Testar o token diretamente
RMF_TOKEN=$(grep VITE_RMF_TOKEN .env.local | cut -d= -f2)
curl -H "Authorization: Bearer $RMF_TOKEN" http://localhost:8000/health
# 200 = token válido; 401 = secret/aud errado; 403 = expirado
```

**Solução — gerar novo token de desenvolvimento:**

```bash
# Opção A: Node.js (mais comum no projeto)
node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  sub: 'admin',
  preferred_username: 'admin',
  iss: 'stub',
  aud: 'rmf_api_server',
  exp: Math.floor(Date.now()/1000) + 60*60*24*365  // 1 year
})).toString('base64url');
const secret = process.env.RMF_JWT_SECRET || 'hermes-dev-secret';
const sig = crypto.createHmac('sha256', secret)
  .update(header + '.' + payload).digest('base64url');
console.log(header + '.' + payload + '.' + sig);
"

# Opção B: Python (sem dependências externas)
python3 -c "
import hmac, hashlib, base64, json, time, os
def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()
header  = b64url(json.dumps({'alg':'HS256','typ':'JWT'}).encode())
payload = b64url(json.dumps({
    'sub':'admin','preferred_username':'admin',
    'iss':'stub','aud':'rmf_api_server',
    'exp':int(time.time()) + 86400*365
}).encode())
secret = os.environ.get('RMF_JWT_SECRET','hermes-dev-secret').encode()
sig = b64url(hmac.new(secret, f'{header}.{payload}'.encode(), hashlib.sha256).digest())
print(f'{header}.{payload}.{sig}')
"
```

**Copiar o output para `.env.local`:**
```bash
VITE_RMF_TOKEN=<output-do-comando-acima>
```

> **Atenção:** O token gerado usa `iss: "stub"` — adequado para dev. Em produção, o issuer será a URL do Keycloak.

---

## 3. Conflito de porta

**Sintoma:** Um dos serviços não sobe, ou `Connection refused` em uma das portas.

**Diagnóstico:**

```bash
# Quais processos estão usando :7878 e :9090?
ss -tlnp | grep -E ':7878|:9090'
# ou
lsof -i :7878 -i :9090

# Se uma porta está ocupada por outro processo:
fuser 7878/tcp   # mostra PID
fuser 9090/tcp
```

**Verificação de separação correta:**

```bash
# RMF API Server deve estar em :7878 (nativo) ou :8000 (Docker)
curl -sf http://localhost:7878/health && echo "RMF API em :7878"
curl -sf http://localhost:8000/health && echo "RMF API em :8000 (Docker)"

# rosbridge deve estar em :9090
websocat --exit-on-eof ws://localhost:9090 <<< '{}' 2>&1 | head -3
```

**Notas sobre porta 7878 vs 8000:**

O `docker/api-server-config.py` usa porta **8000** (configuração atual de desenvolvimento). O `ros2/config/rmf_api_server.config.yaml` e o `OPENRMF_MIGRATION.md` especificam **7878** (convenção open-RMF).

Para alinhar:
- Dev com Docker: usar `RMF_URL=http://localhost:8000` em `.env.local`
- Dev nativo (ROS 2): usar `RMF_URL=http://localhost:7878` em `.env.local`
- Produção: alinhar ambos para :7878 e atualizar `docker/api-server-config.py`

---

## 4. Costmap não aparece no frontend

**Sintoma:** `Map3D` conecta no `:9090` (o console mostra conexão) mas os meshes de costmap ficam invisíveis (`useCostmapLayer` nunca atualiza).

**Diagnóstico em camadas:**

```bash
# Camada 1: rosbridge está recebendo o tópico?
ros2 topic list | grep costmap
# Esperado: /local_costmap/costmap  /global_costmap/costmap

# Camada 2: Nav2 está publicando?
ros2 topic hz /local_costmap/costmap
# Esperado: ~5 Hz
# Se 0 Hz: Nav2 não está rodando

# Camada 3: rosbridge está retransmitindo?
# Abrir console do browser → Network → WS → encontrar conexão :9090
# Deve haver mensagens periódicas após subscrever o tópico

# Camada 4: topic está na whitelist?
grep local_costmap ros2/config/rosbridge.config.yaml
# Deve estar presente em topics_glob
```

**Soluções por camada:**

| Camada | Problema | Solução |
|---|---|---|
| Nav2 | Costmap não publicado | `ros2 launch nav2_bringup navigation_launch.py` |
| rosbridge | Tópico fora da whitelist | Adicionar a `topics_glob` em `rosbridge.config.yaml` |
| Frontend | CBOR não suportado | Verificar `compression: 'cbor'` em `useCostmapLayer.js` |
| Frontend | Mesh invisível | `meshRef.current.visible` pode ser `false` — verificar no Three.js inspector |

---

## 5. Latência > 500ms no FleetState

**Sintoma:** `test-rmf-pipeline.sh` reporta latência > 500ms; frontend parece "lento" para refletir posição do robô.

**Diagnóstico:**

```bash
# Verificar frequência de publicação do adapter
ros2 topic hz /fleet_states
# Esperado: 10.0 Hz
# Se < 10: adapter pode estar com TF lookup falhando (throttle em WARN)

# Verificar carga do RMF API Server
# Com Docker:
docker stats $(docker ps | grep api-server | awk '{print $1}')

# Medir latência ROS → REST (quanto o API Server demora para expor)
# Timestamp no log do adapter:
ros2 topic echo /fleet_states | grep -A1 "stamp"

# Comparar com timestamp no response do curl:
time curl -sf http://localhost:8000/fleets | python3 -m json.tool | grep stamp
```

**Soluções por causa:**

| Causa | Diagnóstico | Solução |
|---|---|---|
| Adapter < 10 Hz | `ros2 topic hz /fleet_states` | Verificar `fleet_state_publish_rate` em `freebotics.yaml` |
| TF lookup falhando | `ros2 log show freebotics_fleet_adapter` | Publicar TF de teste ou conectar robô real |
| API Server sobrecarregado | `docker stats` / `htop` | Reduzir robôs simulados; aumentar RAM do container |
| Rede entre ROS e API Server | `ping` / `iperf3` | Se Docker: usar `network_mode: host` (já configurado) |

---

## 6. colcon build falha

**Sintoma:** `colcon build` falha com erro de linking ou header não encontrado em `freebotics_fleet_adapter.cpp`.

**Diagnóstico:**

```bash
# Ver o log completo de build:
cat /tmp/hermes_build.log | grep -E "error:|Error" | head -20

# Verificar se rmf_fleet_msgs está instalado:
ros2 pkg list | grep rmf_fleet
# Esperado: rmf_fleet_adapter  rmf_fleet_msgs  rmf_fleet_robot_state_msgs

# Verificar versão:
ros2 pkg xml rmf_fleet_msgs | grep version
```

**Soluções por erro:**

```bash
# Erro: "rmf_fleet_msgs/msg/FleetState.hpp: No such file"
sudo apt install ros-humble-rmf-fleet-msgs
# ou compilar do source (rmf_fleet_msgs está em open-rmf/rmf_internal_msgs)

# Erro: "tf2_ros/buffer.h: No such file"
sudo apt install ros-humble-tf2-ros

# Erro: "undefined reference to rclcpp::..."
# → Problema de linkagem; verificar CMakeLists.txt
# → Confirmar: ament_target_dependencies inclui rclcpp

# Erro: "C++17 required"
# → cmake -DCMAKE_CXX_STANDARD=17  já está no CMakeLists.txt
# → Verificar: gcc --version (deve ser >= 7)
```

---

## 7. rmf_api_server config format

**Sintoma:** `rmf_api_server` não inicia ou ignora configurações do `rmf_api_server.config.yaml`.

**Causa:** O rmf_api_server aceita **dois formatos de configuração diferentes** dependendo de como é executado:

| Modo de execução | Formato de config |
|---|---|
| `ros2 run rmf_api_server rmf_api_server` | YAML com `ros__parameters` (ROS 2 params) |
| `python3 -m api_server` | Python dict em arquivo `.py` |
| Docker (docker-compose.yml) | Python dict (ex: `docker/api-server-config.py`) |

**Verificar qual está sendo usado:**

```bash
# Se usando Docker:
cat docker/api-server-config.py
# Modificar aqui para dev com Docker

# Se usando ROS 2 native:
ros2 param list /rmf_api_server
# Ver e comparar com ros2/config/rmf_api_server.config.yaml
```

**Resolver para Docker dev:**

O `docker/api-server-config.py` tem `"jwt_secret": "hermes-dev-secret"` hardcoded. Para produção, substituir por variável de ambiente:

```python
# docker/api-server-config.py — versão segura
import os
config = {
    # ... outros campos ...
    "jwt_secret": os.environ.get("RMF_JWT_SECRET", "change-me-in-production"),
}
```

---

## 8. Porta 7878 vs 8000

**Contexto:** Há uma discrepância entre a porta especificada no OPENRMF_MIGRATION.md (`:7878`) e a porta usada pelo `docker/api-server-config.py` (`:8000`).

**Estado atual (Semana 2):**

| Arquivo | Porta | Quando usar |
|---|---|---|
| `docker/api-server-config.py` | **8000** | Dev com Docker (`docker compose up`) |
| `ros2/config/rmf_api_server.config.yaml` | **7878** | Dev nativo (ROS 2 launch) |
| `.env.local` | **8000** | Alinhado com Docker dev atual |
| `OPENRMF_MIGRATION.md` | **7878** | Convenção open-RMF padrão |

**Recomendação:** Manter 8000 para dev com Docker. Alinhar para 7878 ao promover para produção, mudando:
1. `docker/api-server-config.py`: `"port": 7878`
2. `.env.local`: `VITE_RMF_API_URL=http://...:7878`
3. `VITE_RMF_WS_URL=ws://...:7878`

---

## Diagnóstico rápido de todo o stack

```bash
# 1. Todos os serviços rodando?
ros2 node list
# Esperado: /rmf_traffic_schedule  /freebotics_fleet_adapter
#           /rmf_api_server (se ROS node)  /rosbridge_websocket

# 2. Tópicos críticos ativos?
ros2 topic hz /fleet_states    # deve ser ~10 Hz
ros2 topic hz /tf              # deve ser >>10 Hz (robot publishing)

# 3. API Server responde?
curl -sf http://localhost:8000/health  # Docker
curl -sf http://localhost:7878/health  # Native

# 4. Frontend conecta?
# Abrir browser → Console → Network → WS
# Deve ver conexão ws://localhost:9090 (rosbridge)
# Deve ver requests para http://localhost:8000/* (RMF API)

# 5. Validação automática:
bash scripts/validate-week2.sh --with-backend
```
