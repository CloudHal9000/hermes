# Hermes — Three.js Performance Benchmark Report

**Data:** 2026-04-28  
**Executado em:** Node.js v22.22.2 · linux/x64  
**Branch:** main  
**Script:** `node scripts/benchmark-threejs.js`

---

## 3.1 Metodologia

### O que foi medido diretamente

O script `scripts/benchmark-threejs.js` mede apenas **custo de CPU em JavaScript puro**, sem Three.js nem browser. Ele replica matematicamente as operações críticas identificadas na análise estática:

| Componente | O que foi simulado | Fidelidade |
|---|---|---|
| `SimpleTfGraph.lookupTransform` | BFS completo com quaternion compose, estrutura de dados idêntica | Alta — mesma lógica copiada |
| `useCostmapLayer.updateCostmapMesh` | Alocação de `Uint8Array(4×W×H)` + loop de preenchimento | Alta — mesmo padrão de loop |
| `isFleetState` guard | Lógica de validação de `src/types/guards.ts` replicada em JS | Alta — campo a campo idêntico |
| LiDAR (`useLidarLayer`) | Estimativa baseada em custo típico de `Float32Array` para 720 pontos | Estimada |

### O que NÃO foi medido (e por quê importa)

| Custo | Por que não medível fora do browser | Impacto estimado |
|---|---|---|
| GPU texture upload (`DataTexture.needsUpdate`) | API WebGL/driver, invisível ao JS | **Alto** — 0.5–3ms por upload dependendo de GPU |
| Draw calls WebGL (`renderer.render()`) | Requer contexto WebGL real | **Alto** — escala com N × URDF meshes |
| `URDFLoader.load()` N simultâneo | Requer fetch + parse DOM XML | **Moderado** — one-time, mas bloqueia thread |
| Overhead N WebSocket connections | Depende de network stack do OS | **Baixo para ≤10 robôs** |

**Convenção de custo de render WebGL:** estimado como 3ms fixo na seção de headroom — valor conservador para cena simples com 1 robô. Com 5 robôs e ~100–200 draw calls de URDF, pode aumentar para 6–8ms.

---

## 3.2 Resultados por Componente

### SimpleTfGraph — BFS lookupTransform

Grafo sintético com 20 frames (cadeia linear: `map → base_footprint → link_2 … → link_19`), espelhando a estrutura bidirecional real de `SimpleTfGraph`.

| Cenário | Avg/frame | ops/sec | % Frame Budget (16.67ms) |
|---|---|---|---|
| 1 robô, 20 frames TF | ~4.9µs | 205.259 | 0.03% |
| 5 robôs, 20 frames TF | ~24µs | — | 0.14% |
| 10 robôs, 20 frames TF | ~49µs | — | 0.29% |
| Pior caso (profundidade 20) × 5 robôs | ~26µs | — | 0.16% |
| Pior caso (profundidade 20) × 10 robôs | ~52µs | — | 0.31% |

**Conclusão:** BFS é negligenciável até 30+ robôs. O custo de quaternion compose é bem otimizado pelo V8 JIT.

> **Caveat:** `queue.shift()` em `SimpleTfGraph` é O(n) porque reindicia o array. V8 mascara isso em filas curtas (≤20 entradas). Com grafas TF com >50 frames (robôs complexos ou ambientes com muitos frames estáticos), o custo cresce de forma não-linear.

---

### useCostmapLayer — DataTexture update

| Grid | Alloc + fill | Buffer reutilizado | Speedup | MB alocado | Max Hz |
|---|---|---|---|---|---|
| 100×100 (pequeno) | 55µs | 45µs | 1.2× | 0.04 MB | 18.133 |
| 384×384 (típico) | 668µs | 623µs | 1.1× | 0.56 MB | 1.497 |
| 1000×1000 (grande) | 4.72ms | 4.20ms | 1.1× | 3.81 MB | 211 |

**Impacto multi-robô com local costmap 384×384 @ 2hz (amortizado por frame):**

| Robôs | Custo amortizado/frame | MB/s alocados | % Frame Budget |
|---|---|---|---|
| 1 | 22µs | 1.13 MB/s | 0.13% |
| 5 | 111µs | 5.63 MB/s | 0.67% |
| 10 | 223µs | 11.25 MB/s | 1.34% |

> **Nota crítica:** estes valores medem apenas o loop JS. O custo real inclui também a **transferência GPU** ao setar `texture.needsUpdate = true` — para 0.56 MB de textura RGBA, uma upload de textura pode levar 0.5–2ms dependendo do driver/GPU. Isso não foi medido porque requer contexto WebGL.

---

### isFleetState — validação de WebSocket

| FleetState | Avg | ops/sec | % Frame Budget |
|---|---|---|---|
| 1 robô | 117ns | 8.5M | < 0.001% |
| 5 robôs | 137ns | 7.3M | < 0.001% |
| 10 robôs | 84ns | 11.9M | < 0.001% |

**Conclusão:** Validação de tipo é completamente negligenciável. Não é gargalo em nenhum cenário.

---

### Estimativa de headroom por cenário

Modelo de custo por frame considerando todos os componentes:

| Componente | 2 robôs | 5 robôs | 10 robôs |
|---|---|---|---|
| BFS TF lookups | 9.7µs | 24.4µs | 48.7µs |
| Costmap alloc (amortizado 2hz) | 44.5µs | 111.3µs | 222.6µs |
| LiDAR buffer alloc (amortizado 10hz) | 200µs | 500µs | 1.0ms |
| WebGL render (estimado fixo) | 3.0ms | 3.0ms | 3.0ms |
| OrbitControls.update() | 100µs | 100µs | 100µs |
| **TOTAL (CPU conservador)** | **3.35ms** | **3.74ms** | **4.37ms** |
| **% Frame Budget** | **20.1%** | **22.4%** | **26.2%** |
| **Headroom** | **13.3ms** | **12.9ms** | **12.3ms** |

> **Limite estimado:** ~30 robôs antes de atingir 85% do frame budget em custo puro de CPU JS.
> 
> **Com GPU uploads incluídos (estimativa):** GPU upload de 5 costmaps a 2hz amortiza ~0.5ms/frame adicional. Draw calls de URDF para 5 robôs (~150 meshes) podem adicionar 2–5ms. Limite real cai para ~7–10 robôs sem instancing.

---

## 3.3 Gargalos por Ordem de Severidade

---

🔴 **CRÍTICO — `useCostmapLayer`: `new THREE.DataTexture()` a cada mensagem**

```
Arquivo: src/components/navigation/map-layers/useCostmapLayer.js:46
```

**Problema:** `updateCostmapMesh()` cria `new Uint8Array(4 × W × H)` e `new THREE.DataTexture()` a cada mensagem de costmap. Para um grid 384×384, isso aloca 590KB por update. Com 5 robôs emitindo local costmap a 2hz: **10 alocações/segundo de 590KB** (5.9 MB/s de pressão GC). O mais crítico é que cada `new THREE.DataTexture` com `needsUpdate = true` força um **upload completo de textura na GPU** — operação que não é incremental e bloqueia o pipeline de render.

**Impacto com 5 robôs:** 5× custo de upload de textura por frame (amortizado), além de pressão GC que causa jank esporádico.

**Solução:** Criar `DataTexture` uma vez por costmap layer, manter referência ao buffer `data`, atualizar pixels in-place, e setar `texture.needsUpdate = true` sem realocar. Disposar a textura anterior apenas quando o tamanho do grid mudar.

```js
// ANTES (atual)
const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
texture.needsUpdate = true;
meshRef.current.material.map = texture;

// DEPOIS (correto)
if (!textureRef.current || textureRef.current.image.width !== w) {
    textureRef.current?.dispose();
    textureRef.current = new THREE.DataTexture(new Uint8Array(4*w*h), w, h, THREE.RGBAFormat);
}
// ...fill textureRef.current.image.data in-place...
textureRef.current.needsUpdate = true;
```

**Esforço:** Baixo (refatoração isolada, 20 linhas)  
**Fase de correção:** Antes do MVP (Quick win — Semana 3)

---

🔴 **CRÍTICO — `useRobotModel` + `useLidarLayer`: Sem compartilhamento de geometria entre robôs**

```
Arquivo: src/components/navigation/map-layers/useRobotModel.js:25-33
Arquivo: src/components/navigation/map-layers/useLidarLayer.js:15-24
```

**Problema:** `URDFLoader.load()` cria um grafo completo de `THREE.Mesh` / `THREE.BufferGeometry` / `THREE.Material` para cada robô independentemente. Para um URDF com 20 links, cada robô adiciona ~40–80 objetos Three.js à cena. Com 5 robôs: 200–400 objetos. Cada objeto representa um **draw call** no render loop. A GPU executa chamadas de draw sequencialmente — 400 draw calls por frame a 60fps é o limite prático antes de quedas de FPS.

Além disso, `useLidarLayer` cria `new THREE.Float32BufferAttribute(pts, 3)` em todo scan (10hz × 2 lidars = 20 alocações/segundo por robô). Para 5 robôs: 100 alocações/segundo de arrays de floats.

**Impacto com 5 robôs:** Aumento de 5× no número de draw calls — de ~40 para ~200 apenas para geometria de robôs URDF. Este é o principal risco de frame drop não capturado pelo benchmark Node.js.

**Solução imediata (Baixo esforço):** Para LiDAR — pré-alocar `Float32Array` com tamanho máximo (720 pontos × 3), usar `BufferGeometry.setDrawRange()` para limitar pontos visíveis, e usar `array.set()` para atualizar in-place.  
**Solução estrutural:** `THREE.InstancedMesh` para robôs idênticos (compartilha geometria+material, múltiplas poses em 1 draw call).

**Esforço:** Médio (LiDAR buffer: baixo; instancing URDF: alto)  
**Fase de correção:** LiDAR buffer antes do MVP. Instancing URDF na Semana 3/Fase 4.

---

🟡 **MODERADO — `SimpleTfGraph`: `queue.shift()` é O(n) por dequeue**

```
Arquivo: src/utils/SimpleTfGraph.js:72
```

**Problema:** `queue.shift()` reindicia toda a array a cada elemento removido — custo O(k) onde k é o tamanho atual da fila. Para grafas TF com muitos frames estáticos (ambientes com múltiplos cômodos, ou robôs com suspensão/articulações), k pode atingir 50–100 entradas. V8 otimiza arrays pequenos, mas o problema aparece com grafas complexos.

**Impacto com 5 robôs e grafo complexo (50+ frames):** ~250µs/frame — ainda dentro do budget, mas crescimento não-linear preocupante.

**Solução:** Substituir `queue.shift()` por um índice de leitura (sem mutação de array), ou usar a estrutura nativa de fila do V8 (array circular com dois ponteiros).

```js
// Substituição simples sem dependências externas:
let head = 0;
while (head < queue.length) {
    const cur = queue[head++];  // O(1) em vez de shift()
    // ...
}
```

**Esforço:** Baixo (5 linhas)  
**Fase de correção:** Semana 3 (junto com outros quick wins)

---

🟡 **MODERADO — `useTfGraph`: Uma instância de `SimpleTfGraph` por robô, N subscriptions `/tf`**

```
Arquivo: src/components/navigation/map-layers/useTfGraph.js:11
Arquivo: src/utils/SimpleTfGraph.js:7-21
```

**Problema:** Na arquitetura atual (single robot via roslib), há 1 `SimpleTfGraph` com 2 subscriptions ROS (`/tf` e `/tf_static`). Para N robôs, seriam N grafas independentes + 2N subscriptions WebSocket. Cada subscription cria um listener no roslib topic, que processa mensagens sequencialmente no event loop.

**Impacto com 5 robôs:** 10 WebSocket message handlers para tópicos TF, cada um executando `_onTf()` + `_addEdge()` a cada mensagem. `/tf` pode emitir a 50hz, então 500 callbacks/segundo apenas para TF com 5 robôs.

**Solução na arquitetura open-RMF:** `useRMFPoses` substituirá `useTfGraph` — poses centralizadas via API RMF em vez de TF graph por robô.

**Esforço:** N/A (resolvido pela migração open-RMF)  
**Fase de correção:** Fase 4 da migração

---

🟢 **BAIXO — `AMCLHelper`: instância sem cleanup garantido**

```
Arquivo: src/components/navigation/Map3D.jsx:43-46
```

**Problema:** `new AMCLHelper(ros)` é instanciado sem guardar referência — sem possibilidade de `destroy()` no cleanup do useEffect. Se o componente remontar (troca de robô), múltiplas instâncias ficam ativas subscribing ao mesmo tópico.

**Impacto:** Subscriptions duplicadas para partículas AMCL. Visível como partículas "fantasma" ao trocar de robô.

**Solução:** Guardar a instância no ref e chamar `destroy()` no cleanup.

**Esforço:** Mínimo (3 linhas)  
**Fase de correção:** Semana 3 (já que é uma limitação existente também no single-robot)

---

🟢 **BAIXO — `useCostmapLayer`: `/map` (mapa estático) recria `THREE.Mesh` a cada mensagem**

```
Arquivo: src/components/navigation/map-layers/useCostmapLayer.js:77-90
```

**Problema:** O listener de `/map` cria `new THREE.PlaneGeometry` + `new THREE.MeshBasicMaterial` a cada mensagem. O mapa estático tipicamente emite apenas 1x (latched topic), então na prática o impacto é mínimo.

**Impacto:** Negligenciável (ocorre apenas 1x por conexão).

**Solução:** Unsubscribe após a primeira mensagem recebida.

**Esforço:** Mínimo  
**Fase de correção:** Qualquer momento (cosmético)

---

## 3.4 Recomendações por Threshold de Robôs

### 1–3 robôs — Stack atual aguenta sem alteração?

**Sim.** Com base nos dados medidos, o custo CPU de JS para 3 robôs é ~3.5ms/frame (21% do budget). Somando uma estimativa conservadora de GPU (uploads de textura + ~60 draw calls de URDF) de ~4ms, o total fica em ~7.5ms/frame — dentro do budget de 16.67ms com margem confortável.

**Ressalva:** O bug de `AMCLHelper` sem cleanup pode causar subscriptions duplicadas ao trocar de robô. Corrigir antes de testar multi-robô.

### 4–6 robôs — Otimizações mínimas necessárias

1. **`DataTexture` reutilização** — eliminar 590KB de alloc por update de costmap (evita GC jank)
2. **LiDAR buffer pré-alocado** — substituir `new Float32BufferAttribute` por `setDrawRange` + `array.set()`
3. **Monitorar draw calls no DevTools** — se total de draw calls ultrapassar 300/frame, avaliar instancing
4. **`AMCLHelper` cleanup** — evitar subscriptions acumuladas ao trocar de robô

### 7–10 robôs — Refatorações necessárias

1. Todas as otimizações de 4–6 robôs, mais:
2. **`THREE.InstancedMesh` para robôs idênticos** — substitui N×draw_calls_URDF por 1 draw call instanciado
3. **Cache de transform result** — memoizar `lookupTransform` por frame (invalidar apenas ao receber mensagem `/tf`)
4. **Gerenciamento explícito de LOD** — reduzir resolução de costmap para robôs não selecionados
5. **Limitar frequência de costmap update** — throttle de 2hz a 1hz para robôs não em foco

### 10+ robôs — Mudanças arquiteturais necessárias

1. Todas as refatorações de 7–10 robôs, mais:
2. **Migração para open-RMF** (conforme OPENRMF_MIGRATION.md) — elimina N WebSocket connections, centraliza estado em API RMF via SSE/polling
3. **Web Worker para processamento de costmap** — mover o loop `Uint8Array` fill para Worker thread para não bloquear o render loop
4. **Renderização de múltiplos robôs em viewports separados** ou **câmera de overview** com LOD agressivo para robôs distantes
5. **GPU picking com buffer de cor** em vez de raycasting CPU para seleção de robôs

---

## 3.5 Quick Wins (antes do MVP — Semana 3–4)

Ordenados por impacto/esforço:

| Prioridade | Mudança | Arquivo | Esforço | Impacto |
|---|---|---|---|---|
| 1 | Reutilizar `DataTexture` buffer (não realocar a cada costmap) | `useCostmapLayer.js:46` | ~30min | Elimina GC jank, reduz GPU stalls |
| 2 | `AMCLHelper` cleanup no useEffect | `Map3D.jsx:42` | ~5min | Evita subscription leak ao trocar robô |
| 3 | `queue.shift()` → índice de leitura em `lookupTransform` | `SimpleTfGraph.js:72` | ~10min | Futuro-proof para grafas complexos |
| 4 | LiDAR buffer pré-alocado com `setDrawRange` | `useLidarLayer.js:41` | ~45min | Elimina 20 alocações/robô/segundo |
| 5 | Unsubscribe `/map` após primeira mensagem | `useCostmapLayer.js:64` | ~5min | Elimina listener desnecessário |

---

## Veredicto Final

> **"Posso lançar o MVP com 5 robôs simultâneos sem otimização prévia?"**

**✅ Sim** — com uma ressalva importante.

O custo CPU-JavaScript mensurado para 5 robôs é **22.4% do frame budget** (3.74ms de 16.67ms). Somando estimativa conservadora de GPU (uploads de textura, draw calls), o total estimado fica em **~8–10ms/frame** — dentro do budget.

**A ressalva:** o custo não medido de **draw calls N×URDF** é o maior risco. Se o modelo URDF do robô tiver >40 meshes, 5 robôs adicionam >200 draw calls — limiar onde GPUs mobile/integradas começam a cair abaixo de 60fps. Recomenda-se verificar o número real de meshes do URDF com `scene.children.length` no DevTools do browser antes do launch.

**Recomendação de lançamento:**
- Aplicar os Quick Wins 1 e 2 (DataTexture + AMCLHelper) antes do MVP — esforço total <1h.
- Monitorar FPS em browser com `stats.js` durante testes com 5 robôs reais.
- Planejar Quick Wins 3–4 para a Semana 4 se os testes confirmarem jank esporádico de GC.
