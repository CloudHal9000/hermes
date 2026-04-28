# Auth Specification — Hermes RMF API Client

**Status:** MVP (Sprint 1)  
**Última revisão:** 2026-04-28  
**Contexto:** open-RMF Fleet API Server exposto em rede interna/VPN

---

## 1. Estado atual (linha de base)

| Componente | Autenticação atual |
|---|---|
| `useFleetPolling` → `/api/robots` | **Nenhuma** — fetch sem headers |
| Vite dev proxy `/api/*` → `:8000` | Sem auth (proxy transparente) |
| RMF API Server (`:8000` ou `:7878`) | JWT Bearer esperado pelo servidor |
| WebSocket RMF `/fleet_states` | Token esperado pelo servidor |

**`.env.local` existente** já contém as variáveis corretas:
- `VITE_RMF_API_URL` — URL base da REST API
- `VITE_RMF_WS_URL` — URL base WebSocket
- `VITE_RMF_TOKEN` — JWT Bearer token (stub HS256 para desenvolvimento)

O gap é que **nenhum hook usa essas variáveis** — todo fetch atual vai para a URL legada (`VITE_API_URL`) sem auth. O `src/lib/rmfClient.js` fecha esse gap.

---

## 2. Modelo de ameaça (escopo MVP)

### Ativos a proteger

| Ativo | Risco sem auth |
|---|---|
| `POST /tasks` | Qualquer dispositivo na rede envia robôs para posições arbitrárias |
| `GET /fleet_states` | Vazamento de dados de localização em tempo real |
| `WebSocket /fleet_states` | Stream de posição de todos os robôs disponível sem identificação |

### Ameaças no escopo do MVP

**T1 — Dispositivo não autorizado na mesma rede**  
Qualquer equipamento no segmento de rede (câmera IP, laptop de manutenção) pode enviar `POST /tasks`. Mitigação: Bearer token no header rejeita requests sem token válido.

**T2 — Acesso não autenticado ao estado da frota**  
GET e WebSocket sem auth expõem posição de todos os robôs. Mitigação: mesma — token obrigatório no servidor.

**T3 — Token vazado via bundle Vite**  
`VITE_*` variáveis são embutidas no JS compilado. Qualquer pessoa com acesso ao bundle (DevTools, `dist/`) vê o token.

> **Quando T3 é aceitável:** rede isolada (Tailscale VPN, VLAN industrial) onde o bundle já é acessível apenas para quem tem acesso à rede — o token no bundle não expande a superfície de ataque.

> **Quando T3 NÃO é aceitável:** app com acesso público à internet, CDN público, ou se o bundle for cacheado em CDN. Nesses casos, o token deve viver apenas em servidor (BFF proxy com cookie HttpOnly).

### Fora do escopo do MVP (documentado para Sprint 2)

- Autenticação multi-usuário / RBAC
- Rotação automática de tokens
- Refresh token flow
- Audit log de ações em `/tasks`
- mTLS entre Fleet Adapter e RMF Core
- SSO / integração com identidade corporativa

---

## 3. Solução escolhida: JWT Bearer token

### Por que não uma API Key estática simples?

O open-RMF API Server já é projetado para receber JWT — em produção, integra com Keycloak/OAuth2. O stub token em `.env.local` **já é um JWT** (HS256, `iss: "stub"`, `aud: "rmf_api_server"`). Usar o formato JWT desde o MVP significa:

- Zero mudança de contrato quando migrar para Keycloak (apenas trocar o issuer/secret)
- O servidor já valida `aud` e `exp` — uma API key estática quebraria essa validação

### Comparação de alternativas

| Alternativa | Pros | Cons | Decisão |
|---|---|---|---|
| JWT Bearer (atual) | Compatível com RMF server; evoluível | Token no bundle (T3) | **Escolhido** |
| API Key estática | Simples | Incompatível com RMF server; sem expiração | Descartado |
| Cookie HttpOnly via BFF proxy | Elimina T3 | Requer novo serviço backend | Sprint 2 |
| Sem auth | Simples | Risco operacional inaceitável | Descartado |

---

## 4. Fluxo de autenticação

```
Frontend (browser)
│
├─ REST requests  ──────────────────────────────────────────────►  RMF API Server
│    GET  /fleet_states                                             valida header:
│    POST /tasks                                                    Authorization: Bearer <JWT>
│    Authorization: Bearer {VITE_RMF_TOKEN}                        ↓
│                                                               200 OK / 401 Unauthorized
│
└─ WebSocket  ──────────────────────────────────────────────────►  RMF API Server
     ws://host:port/fleet_states?token={VITE_RMF_TOKEN}            valida query param
     (browser não envia custom headers no upgrade HTTP)            no WS handshake
     ↓
     SSE stream de FleetStateUpdate events
```

**Por que query param no WebSocket?** A API do browser para WebSocket (`new WebSocket(url)`) não aceita headers customizados. As duas alternativas padrão são query param no URL ou subprotocolo. O open-RMF server suporta `?token=` — usar isso.

---

## 5. Configuração de ambiente

### `.env.local` (nunca commitar — protegido por `*.local` no `.gitignore`)

```bash
# RMF API Server
VITE_RMF_API_URL=http://<rmf-server-ip>:8000
VITE_RMF_WS_URL=ws://<rmf-server-ip>:8000
VITE_RMF_TOKEN=<jwt-token-aqui>
```

Para obter um stub token de desenvolvimento, rodar o RMF API Server em modo dev — ele loga o token gerado no startup. O token tem formato:
```
eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.<payload>.<signature>
```

### `.env.example` (commitar — sem valores reais)

Ver arquivo `.env.example` na raiz do projeto.

### Risco Vite — leitura obrigatória

O Vite inlina todas as variáveis `VITE_*` no bundle JS compilado durante `npm run build`. Isso significa:

```js
// No bundle compilado (dist/assets/index-xxx.js), aparece literalmente:
const token = "eyJhbGciOiAiSFMyNTYiLCAidHlwIj...";
```

**Consequência:** qualquer pessoa com acesso ao arquivo bundle (DevTools, `curl dist/assets/index-*.js`) consegue extrair o token.

**Mitigação no contexto atual:** o deploy é em rede Tailscale/VPN — quem tem acesso ao bundle já tem acesso à rede e ao RMF server. A exposição não aumenta a superfície de ataque.

**Mitigação para deploy público (Sprint 2):** implementar BFF (Backend-for-Frontend) proxy que injeta o header `Authorization` server-side, e o token nunca chega ao browser.

---

## 6. Como um novo dev configura auth do zero

```bash
# 1. Copiar template de variáveis de ambiente
cp .env.example .env.local

# 2. Preencher .env.local com valores reais:
#    - VITE_RMF_API_URL: IP do servidor RMF (perguntar ao líder do projeto)
#    - VITE_RMF_WS_URL: mesmo IP, protocolo ws://
#    - VITE_RMF_TOKEN: obter com o time de infra ou rodar RMF server localmente

# 3. Verificar que .env.local NÃO está no git:
git status --short | grep .env.local
# Deve retornar vazio (ignorado pelo .gitignore)

# 4. Iniciar dev server
npm run dev

# 5. Verificar no console do browser:
# Deve aparecer: [rmfClient] Token configurado (JWT, exp: <data>)
# Se aparecer: [rmfClient] VITE_RMF_TOKEN não definida — requests vão sem auth
# → voltar ao passo 2
```

---

## 7. Impacto em `useFleetPolling` (legado)

O hook `useFleetPolling` usa `VITE_API_URL` (URL legada do backend Flask em `:8000`) via o proxy Vite `/api/*`. Esse hook **não usa** o RMF API Server ainda e **não requer auth** com o backend legado atual.

Quando `useFleetPolling` for substituído por `useFleetState` (open-RMF, conforme OPENRMF_MIGRATION.md Fase 1), o novo hook deve importar `rmfFetch` de `src/lib/rmfClient.js` em vez de fazer `fetch` diretamente.

> **Nota sobre `vite.config.js`:** o arquivo tem um bloco `define` que hardcoda `VITE_API_URL` para `http://localhost:8000`, sobrescrevendo o valor do `.env`. Isso é um bug menor — a variável legada não pode ser sobrescrita por env. Deve ser removido quando `useFleetPolling` for deprecated na Fase 2.

---

## 8. Roadmap de auth pós-MVP

### Sprint 2 (Semanas 5–8)

- [ ] **JWT com expiração curta + refresh token** — substituir stub token de longa duração (exp 2027) por tokens de 1h com refresh flow
- [ ] **Login screen básico** — tela de login no frontend que autentica contra Keycloak e armazena token em memória (não localStorage)
- [ ] **BFF proxy** — backend leve (Express ou Nginx) que injeta `Authorization` header server-side, eliminando T3

### Fase futura

- RBAC: papéis `operador` (leitura + tasks básicas), `supervisor` (todos os tasks), `admin` (configuração)
- Audit log: toda chamada a `POST /tasks` registrada com usuário, timestamp, payload
- mTLS entre Fleet Adapter e RMF Core (serviço a serviço, sem browser)
- SSO se integrar com identidade corporativa do cliente (Active Directory, Google Workspace)
