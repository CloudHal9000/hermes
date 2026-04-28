# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hermes is a React-based fleet management dashboard for controlling and monitoring multi-robot systems via **open-RMF**. It uses the RMF API Server for fleet state and task dispatch, rosbridge WebSocket for sensor data (costmaps, LiDAR), and Three.js for 3D visualization of robots, maps and navigation.

## Development Setup

### Common Commands

- **Start development server**: `npm run dev` — Vite dev server with HMR
- **Build for production**: `npm run build` — optimised bundle in `dist/`
- **Lint**: `npm run lint`
- **Tests**: `npm run test:run` — 32+ tests, Vitest + jsdom
- **Backend check**: `bash scripts/setup-ros2-rmf.sh` — verify ROS 2 / RMF prerequisites

### Backend Launch (ROS 2)

```bash
export RMF_JWT_SECRET=hermes-dev-secret
ros2 launch ros2/launch/hermes_backend.launch.py
# or:
docker compose -f docker/docker-compose.yml up
```

### Validation Scripts

| Script | Purpose |
|---|---|
| `bash scripts/validate-week1.sh` | ROS 2 + adapter compiled |
| `bash scripts/validate-week2.sh --with-backend` | RMF API Server + rosbridge live |
| `bash scripts/validate-week3.sh` | Hooks + TaskManager UI |
| `bash scripts/validate-week4.sh` | Full integration |

### Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `VITE_RMF_API_URL` | `http://localhost:8000` | RMF API Server (8000 = Docker, 7878 = native) |
| `VITE_RMF_WS_URL` | `ws://localhost:8000` | WebSocket URL |
| `VITE_RMF_TOKEN` | — | JWT Bearer token — see `docs/infrastructure-requirements.md#jwt` |
| `VITE_ROBOT_IP` | `localhost` | Robot IP for rosbridge legacy connection |

## Architecture — open-RMF (Current)

Data flows from robot through RMF stack to the dashboard:

```
Robot → /tf /battery_state (ROS 2)
        ↓
freebotics_rmf_adapter  →  rmf_fleet_msgs/FleetState (10 Hz)
        ↓
RMF API Server :7878    →  REST + WebSocket (fleet_states, tasks)
        ↓
useRMFApi               →  validates events, syncs fleetStore (Zustand)
        ↓
useFleetState / useRMFPoses  →  expose data to components
        ↓
Map3D + TaskManager     →  render fleet state, submit tasks
```

**Sensor data** (costmaps, LiDAR) still flows via rosbridge (:9090) — deprecated in Phase 4.

## Application Structure

### State Management

- **fleetStore** (`src/store/fleetStore.ts`): Central Zustand store. Holds `robots[]`, `tasks[]`, `connectionStatus`. Populated by `useRMFApi`. Works outside React tree via `.getState()`.
- **NotificationContext** (`src/context/NotificationContext.jsx`): Toast notifications. `addNotification(message, duration?)`.

### Custom Hooks

| Hook | Path | Purpose |
|---|---|---|
| `useRMFApi` | `src/hooks/useRMFApi.js` | WebSocket to `/fleet_states` with exponential backoff reconnect; REST helpers (createTask, cancelTask, getTask) |
| `useFleetState` | `src/hooks/useFleetState.js` | Selects robots/tasks from fleetStore; transforms to UI format |
| `useRMFPoses` | `src/components/navigation/map-layers/useRMFPoses.js` | Converts robots[] to Three.js `{position, quaternion}` map |
| `useRos` | `src/hooks/useRos.js` | **LEGACY** — rosbridge connection for sensor data; kept until Phase 4 |
| `useFleetPolling` | `src/hooks/useFleetPolling.js` | **LEGACY** — replaced by useRMFApi + useFleetState |

### Main Components

- **App** (`src/App.jsx`): Root. `useRMFApi()` starts WebSocket on mount. `useRos()` kept for rosbridge sensors.
- **Map3D** (`src/components/navigation/Map3D.jsx`): Three.js scene. Uses `useMultiRobotModel` + `useRMFPoses` for N robots. `ros` prop used only by `useCostmapLayer` and `useLidarLayer`.
- **TaskManager** (`src/components/tasks/TaskManager.jsx`): Task submission form + live task list. Consumes `useFleetState` internally.
- **FleetSelector** (`src/components/fleet/FleetSelector.jsx`): Auto-detects RMF mode (robots have `.fleet` field) vs legacy mode (robots have `.ip` field).

### Map3D Layers

| Hook | Data source | Notes |
|---|---|---|
| `useMapScene` | — | WebGLRenderer, camera, OrbitControls |
| `useMultiRobotModel` | fleetStore robots[] + rmfPoses | N URDF groups; replaces `useRobotModel` |
| `useRMFPoses` | fleetStore robots[] | yaw→quaternion; replaces `useTfGraph` |
| `useCostmapLayer` | rosbridge `/local_costmap/costmap` | DataTexture reused per frame (PERF QW1) |
| `useLidarLayer` | rosbridge `/lidar/front_aligned` | tfGraph removed; group positioned by RMF |
| `usePathLayer` | rosbridge `/path` | Navigation path viz |
| `useNavigationTool` | Three.js raycasting + createTask() | GOAL → POST /tasks; POSE → /initialpose via rosbridge |

### Data Flow (post-MVP)

1. `useRMFApi` connects WebSocket → validates `isRMFWebSocketEvent` + `isFleetState` → `fleetStore.setFleetState()`
2. `useFleetState` selects from store → `robotList` with UI-friendly fields
3. `useRMFPoses` converts `robots[].location` to Three.js poses
4. `useMultiRobotModel` syncs Three.js Groups with rmfPoses in animation loop
5. `useNavigationTool` raycasts on pointer drag → `createTask({ category: 'navigation', goal: {x,y,yaw} })`
6. `TaskManager` shows task list from store; cancel via `cancelTask(id)`
7. Sensor data (costmaps, LiDAR) still reaches Map3D via rosbridge `:9090`

## Testing

```bash
npm run test:run  # 32+ tests, <3s
```

Suites:
- `src/store/__tests__/fleetStore.test.ts` — Zustand store actions
- `src/types/__tests__/guards.test.ts` — isFleetState, isTaskState, isRMFWebSocketEvent
- `src/hooks/__tests__/useRMFApi.test.js` — WebSocket lifecycle, backoff reconnect, REST
- `src/hooks/__tests__/useFleetState.test.js` — robot normalisation, dual-format support

Mocking pattern: `vi.mock('../../lib/rmfClient')` + `rmfWebSocket.mockReturnValue(mockWs)` in `beforeEach`.

## Key Technical Rules

### Never do this

- `fetch()` or `new WebSocket()` directly in hooks — use `rmfFetch()` / `rmfWebSocket()` from `src/lib/rmfClient.js`
- CSS modules or Tailwind — all styles via inline JS objects
- `<form>` tag — use div + onClick (project convention)
- Hardcode `RMF_JWT_SECRET` in any file — env var only

### Always do this

- New files: `.ts` / `.tsx` (TypeScript, Phases 1+)
- Existing `.js` files: migrate only when editing for another reason
- Store updates from outside React: `useFleetStore.getState().setXxx()`
- Add `// LEGACY: remove Phase 4` comments when keeping deprecated rosbridge code

## Styling

Dark glassmorphism theme. All styles inline with JS objects:

```jsx
style={{ background: 'rgba(15,17,26,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)' }}
```

## ESLint

```bash
npm run lint  # pre-existing errors only in public/lib/roslib.js (vendored)
```

## Backend Overview

See `docs/infrastructure-requirements.md` for full setup. Quick reference:

| Service | Port | Start |
|---|---|---|
| RMF API Server | 8000 (Docker) / 7878 (native) | `docker compose up` or ROS 2 launch |
| rosbridge | 9090 | Included in `hermes_backend.launch.py` |
| freebotics_rmf_adapter | — | ROS 2 node, auto-started by launch |

See `OPENRMF_MIGRATION.md` for the full 4-week migration plan and Phase 4 (VDA5050) roadmap.
