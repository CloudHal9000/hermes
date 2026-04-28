# ADR-001: Adoção de TypeScript, Zustand e Vitest no Hermes

**Status:** Aceito  
**Data:** 2026-04-28  
**Autores:** Time Hermes  
**Contexto relacionado:** OPENRMF_MIGRATION.md, docs/auth-spec.md

---

## Contexto

O Hermes está em transição de um dashboard single-robot (ROS 1/2 via roslib) para
uma plataforma multi-robot via open-RMF. O stack atual tem três fragilidades que se
tornam bloqueios à medida que a complexidade aumenta:

**1. JavaScript puro sem checagem de tipos**  
Os contratos da API RMF (`FleetState`, `TaskState`, etc.) existem apenas como
`.d.ts` declarativos. Nada impede que um hook passe `robot.battery_level` onde
a API espera `robot.battery` — o erro só aparece em runtime, depois que um robô
foi mandado para o lugar errado.

**2. Estado global distribuído via prop drilling e Context API**  
`robots`, `ros`, `activeRobotId` e `addNotification` percorrem a árvore de
componentes via props. `App.jsx` passa `ros` para `Map3D` que passa para
`useRobotModel` que passa para `SimpleTfGraph`. Adicionar estado de 5 robôs nesse
modelo exige refatorar N componentes intermediários.

O `NotificationContext` usa React Context, que re-renderiza toda a árvore
descendente a cada update. Para notificações (baixa frequência) isso é aceitável.
Para `FleetState` chegando via WebSocket a 10Hz com 5 robôs, não é.

**3. Zero cobertura de testes**  
Type guards, lógica de store, transformações de dados RMF — nenhum desses tem
proteção automatizada. Bugs de regressão na migração open-RMF serão descobertos
manualmente em hardware real.

---

## Decisão

### TypeScript incremental (não big-bang)

Adotar TypeScript em fases, sem reescrever o código existente de uma vez:

| Fase | Escopo | Status |
|---|---|---|
| **0 — Atual** | `.d.ts` + `jsconfig.json` com `checkJs` | ✅ Implementado |
| **1 — MVP** | Novos arquivos criados em `.ts`/`.tsx`; existentes ficam `.js` | ✅ Em andamento |
| **2 — Pós-MVP** | Migrar hooks críticos (`useRMFApi`, `useFleetState`) para `.ts` | Semana 5–6 |
| **3 — Sprint 2+** | Migrar componentes UI progressivamente | Sprint 2+ |
| ~~Big-bang~~ | ~~Reescrever tudo de uma vez~~ | ❌ Descartado |

**Por que incremental?** A migração big-bang congela o desenvolvimento por 1–2
semanas enquanto o MVP tem prazo de 4 semanas. Incremental permite que features
RMF coexistam com código JS legado sem bloquear entrega.

**Como o esbuild se encaixa nisso?** Vite usa esbuild para transpor `.ts` — ele
strip-a anotações de tipo sem checar erros. Isso significa que os benefícios de
TypeScript em IDE (autocompletar, erros inline) funcionam desde o Fase 0, mas
erros de tipo não bloqueiam o build. Para detectar erros em CI, adicionar
`tsc --noEmit` como step separado na Fase 2.

### Zustand para estado global

`src/store/fleetStore.ts` é a store central. Substitui prop drilling de `robots`
e `ros` e será populada por `useFleetState` (open-RMF) quando substituir
`useFleetPolling`.

**Por que não Context API?**  
Já usamos Context para `NotificationContext`. O problema é que Context causa
re-render em todos os consumidores a cada mudança de valor — mesmo que o
componente só use `robots[2].battery`. Para `FleetState` a 10Hz com 5 robôs:
50 updates/segundo × N componentes consumidores = re-renders excessivos. Zustand
usa seletores granulares: `useFleetStore(s => s.robots[0].battery)` só re-renderiza
quando aquele campo específico muda.

Além disso, Zustand funciona fora da árvore React via `.getState()` — crítico
para callbacks do Three.js (que rodam no `requestAnimationFrame`, fora do ciclo
React) e para o `rmfClient.js` (que não é um componente).

**Por que não Redux Toolkit?**  
Redux tem excelente devtools e ecosystem, mas exige boilerplate significativo:
slice + action creators + reducers + provider + selectors. Para um time pequeno
em sprint de 4 semanas, o overhead de setup é alto demais. Zustand entrega
95% dos benefícios com ~20% do código.

**Por que não Jotai?**  
Jotai (state atômico) é excelente para estado UI granular. Mas para `FleetState`
que chega como objeto completo via WebSocket, o modelo de átomos individuais
exige mais orquestração. Zustand com slices é mais natural para "receber um
FleetState completo e fazer merge".

**Por que não Recoil / MobX?**  
Recoil foi deprecated pelo Meta. MobX é excelente mas requer decorators e tem
curva de aprendizado maior. Zustand tem a menor curva de aprendizado entre as
opções avaliadas.

**Comparação direta:**

| Critério | Context API | Redux | Jotai | Zustand |
|---|---|---|---|---|
| Boilerplate | Baixo | Alto | Médio | **Mínimo** |
| Performance a 10Hz | ❌ Re-renders | ✅ | ✅ | ✅ |
| Fora da árvore React | ❌ | ✅ | ✅ | ✅ |
| DevTools | ❌ | ✅ | Parcial | **✅** |
| Curva de aprendizado | Baixa | Alta | Média | **Mínima** |
| Provider obrigatório | ✅ | ✅ | ✅ | **Não** |

### Vitest para testes

**Por que não Jest?**  
O projeto usa Vite com `"type": "module"` (ES modules nativos). Jest ainda tem
fricção significativa com ESM — requer `--experimental-vm-modules`, transform
config customizado, e frequentemente conflita com dependências que assumem ESM.
Vitest usa a mesma pipeline do Vite (esbuild + rollup), então não há config
adicional. Um arquivo `.ts` que funciona em dev funciona nos testes, sem adaptações.

**Velocidade:** Vitest em watch mode usa HMR para re-executar apenas os testes
afetados pelo arquivo modificado — fundamental para TDD. Jest refaz todo o bundle
no watch.

**API compatível com Jest:** `describe`, `test`, `expect`, `beforeEach`, `vi.fn()`
— mesmo padrão. A curva de aprendizado é zero para quem já conhece Jest.

---

## Consequências

### O que fica mais fácil

- **Refatoração segura:** testes de store e guards detectam regressões antes de
  chegar em hardware
- **Autocompletar nos hooks:** `useFleetStore(s => s.ro...)` sugere `robots` com
  tipo correto — sem adivinhar se é `battery_level` ou `battery`
- **State debugging:** Redux DevTools mostra histórico de actions (`setFleetState`,
  `updateRobot`) com payload completo
- **Componentes Three.js independentes:** `Map3D` pode ler `useFleetStore.getState()`
  no animation loop sem precisar de props

### O que fica mais difícil

- **Dois sistemas de estado em paralelo:** durante a migração, `useFleetPolling`
  (estado local via useState) e `fleetStore` (Zustand) coexistem. Desenvolvedores
  precisam saber qual usar em cada contexto. Isso se resolve na Semana 3 quando
  `useFleetState` substituir `useFleetPolling` e popular o store.
- **TypeScript incremental tem "zonas cegas":** arquivos `.js` existentes não são
  type-checked. Um import errado entre `.js` e `.ts` pode passar pelo build sem
  erro. Mitigação: `jsconfig.json` com `checkJs: true` dá checagem parcial nos
  `.js` existentes.
- **Sem cobertura de tipos em CI ainda:** esbuild strip-a tipos sem checar. Erros
  de tipo só são detectados na IDE. Adicionar `tsc --noEmit` ao pipeline de CI
  é ação obrigatória na Fase 2.

---

## Alternativas consideradas e descartadas

| Alternativa | Razão para descartar |
|---|---|
| Big-bang TypeScript migration | Congela MVP por 1–2 semanas; risco de regressão alto |
| Redux Toolkit | Boilerplate excessivo para time pequeno em sprint curto |
| Jotai | Modelo atômico menos natural para FleetState como objeto completo |
| Recoil | Deprecated pelo Meta |
| Jest | Fricção com ESM nativo; config adicional; mais lento em watch mode |
| `@testing-library/react` sem Vitest | Requer Jest ou outro runner — não soma sem test runner |
| Manter só Context API | Não escala para 10Hz × N robôs; sem `.getState()` fora de React |

---

## Plano de execução

### Fase 1 — MVP (Semanas 1–4, sem bloquear entregas)

- [x] `src/types/rmf.d.ts` — contratos da API
- [x] `src/types/guards.ts` — type guards com testes
- [x] `src/store/fleetStore.ts` — store Zustand com testes
- [x] `src/lib/rmfClient.ts` — cliente HTTP/WS autenticado
- [ ] `src/hooks/useFleetState.ts` — substitui `useFleetPolling`, popula store
- [ ] `src/hooks/useRMFApi.ts` — submissão de tasks via rmfClient

### Fase 2 — Pós-MVP (Semanas 5–6)

- [ ] Migrar `useRos.js` → `useRos.ts`
- [ ] Migrar `useFleetPolling.js` → deprecated (remover quando `useFleetState` estiver estável)
- [ ] Adicionar `tsc --noEmit` ao CI
- [ ] Cobertura de testes para hooks novos

### Fase 3 — Sprint 2+ (sem prazo fixo)

- [ ] Migrar componentes UI críticos (`Map3D`, `DashboardPanel`) para `.tsx`
- [ ] Configurar `eslint-plugin-@typescript-eslint` para regras TS
- [ ] Configurar `@vitest/coverage-v8` e threshold de cobertura em CI (meta: 80% para `src/store/` e `src/types/`)

### Regras de convivência TypeScript/JavaScript

Durante a migração, para evitar confusão:

1. **Novos arquivos:** sempre `.ts` ou `.tsx`
2. **Arquivos existentes `.js`:** não migrar a menos que haja razão específica (bug, feature nova no arquivo)
3. **Imports entre `.js` e `.ts`:** funcionam, mas não usar `import type` de arquivos `.js` (não tem declarações de tipo)
4. **`any` explícito:** permitido em `.js` legado, proibido em novos `.ts`

---

## Como verificar que esta decisão está sendo seguida

```bash
# Testes devem passar
npm run test:run

# Novos arquivos devem ser .ts/.tsx
find src/ -newer src/store/fleetStore.ts -name "*.js" | grep -v node_modules
# → deve retornar vazio (nenhum .js novo após esta decisão)

# Store deve ser a única fonte de verdade para FleetState
grep -r "useState.*robots\|useState.*tasks" src/ --include="*.tsx" --include="*.ts"
# → deve retornar vazio (sem useState local para fleet data)
```
