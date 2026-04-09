# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Freebotics Studio Dashboard is a React-based web interface for controlling and monitoring robots. It uses ROS (Robot Operating System) communication via roslib and Three.js for 3D visualization of the robot environment and URDF models.

## Development Setup

### Common Commands

- **Start development server**: `npm run dev` - Runs Vite dev server with hot module reload
- **Build for production**: `npm run build` - Creates optimized build in `dist/`
- **Lint code**: `npm run lint` - Runs ESLint on all JS/JSX files
- **Preview production build locally**: `npm run preview` - Serves the production build locally

### Build & Deployment

The application is built with Vite and includes special configuration for:
- **roslib dependency**: Listed in `optimizeDeps.include` due to CommonJS compatibility
- **API proxy**: Development server proxies `/api/*` requests to `http://localhost:8000` (configured in vite.config.js)
- **Environment variables**: API URL is set via `VITE_API_URL` and defaults to `http://localhost:8000`

## Architecture

### Core Dependencies

- **React 18.3**: UI framework with lazy loading and Suspense for component splitting
- **Three.js**: 3D graphics for map and robot visualization
- **roslib 2.0.1**: ROS WebSocket communication (loaded via CDN in index.html, accessed via `window.ROSLIB`)
- **urdf-loader**: Loads and renders URDF robot models in Three.js
- **react-router-dom**: Routing (imported but minimal usage in current codebase)
- **nipplejs**: Virtual joystick component
- **react-gauge-component**: Gauge displays for robot metrics

### Application Structure

The application is organized into several key areas:

#### Context & State Management

- **NotificationContext** (`src/context/NotificationContext.jsx`): Global notification system using React Context. Provides `addNotification()` hook for showing toast messages throughout the app. Messages auto-dismiss after 4 seconds by default.

#### Custom Hooks

- **useRos** (`src/hooks/useRos.js`): Manages ROS WebSocket connection. Takes `robotIp` and establishes connection to `ws://{robotIp}:9090`. Returns `{ ros, isConnected }`. Handles connection/error/close events.
- **useFleetPolling** (`src/hooks/useFleetPolling.js`): Polls the backend API (`/api/robots`) every 5 seconds to fetch robot list. Maps robot data and tracks online status, battery level, mode, etc. Returns array of robot objects.
- **useExternalScript** (`src/hooks/useExternalScript.js`): Utility for dynamically loading external scripts.

#### Main Components

- **App** (`src/App.jsx`): Root component. Contains NotificationProvider and AppContent.
  - **AppContent**: Main dashboard layout with:
    - **TopHeader**: Logo uploader and "FREEBOTICS STUDIO" title
    - **SidebarLeft**: Fleet selector (choose active robot)
    - **SidebarRight**: NAV2 control buttons (set goal, set pose, stop robot) and navigation options
    - **Map3D**: Full-screen 3D visualization (lazy loaded)
    - **Joystick**: Virtual joystick for manual control
    - **DashboardPanel**: Robot status information
    - **NotificationDisplay**: Toast notifications

#### Navigation & Visualization

- **Map3D** (`src/components/navigation/Map3D.jsx`): Core 3D visualization component using Three.js, OrbitControls, and URDF loader. Renders:
  - Robot model (URDF-based)
  - Costmaps (local and global)
  - Robot footprint
  - Navigation path
  - Goal and pose markers (interactive with mouse clicks)
  - Coordinate frames from TF tree
  - AMCL particle cloud for localization

  Uses modular hook architecture:
  - **useMapScene**: Basic Three.js setup (renderer, camera, controls)
  - **useTfGraph**: ROS transform management
  - **useRobotModel**: URDF model and footprint rendering
  - **useCostmapLayer**: Costmap visualization
  - **usePathLayer**: Navigation path rendering
  - **useNavigationTool**: Interactive goal/pose placement

  Subscribes to ROS topics:
  - `/robot/mode_str`: Robot mode (autonomous/manual)
  - `/ui/navigate_to_pose`: Goal positions
  - `/initialpose`: Robot initial pose
  - Various visualization and localization topics

- **NavigationControl** (`src/components/navigation/NavigationControl.jsx`): Right sidebar controls for visualization options (show footprint, view mode, etc.)

#### Utilities

- **SimpleTfGraph** (`src/utils/SimpleTfGraph.js`): Manages ROS TF (transform) tree subscription and updates. Converts TF frame data to Three.js transforms for rendering robot skeleton.
- **AMCLHelper** (`src/utils/amclHelper.js`): Handles AMCL (Adaptive Monte Carlo Localization) particle visualization. Manages particle cloud subscription and rendering.
- **amclHelper** export: Utility class for managing AMCL particle subscriptions

#### Other Components

- **FleetSelector** (`src/components/fleet/FleetSelector.jsx`): Dropdown to select active robot
- **LogoUploader** (`src/components/fleet/LogoUploader.jsx`): UI for uploading/displaying robot logo
- **Joystick** (`src/components/controls/Joystick.jsx`): Virtual joystick interface for manual robot control
- **DashboardPanel** (`src/components/display/DashboardPanel.jsx`): Displays robot status (battery, mode, etc.)
- **NotificationDisplay** (`src/components/display/NotificationDisplay.jsx`): Renders toast notifications

### Data Flow

1. **Fleet Loading**: `useFleetPolling` polls `/api/robots` every 5 seconds
2. **Robot Selection**: User selects robot in FleetSelector → activeRobotId changes
3. **ROS Connection**: `useRos` hook connects to selected robot's WebSocket server
4. **Visualization**: Map3D subscribes to ROS topics (TF, costmaps, AMCL, etc.) and renders 3D scene
5. **User Interaction**: Nav2 goal/pose commands sent to `/ui/navigate_to_pose` topic, joystick commands to `/cmd_vel`
6. **Notifications**: Operations trigger notifications via NotificationContext

### ROS Integration

The application communicates with ROS via WebSocket using roslib library (loaded from CDN). Key connection details:
- **WebSocket URL**: `ws://{robot_ip}:9090`
- **roslib** is accessed via `window.ROSLIB` global variable
- Published topics: `/cmd_vel`, `/initialpose`, `/ui/navigate_to_pose`
- Subscribed topics: Various transform frames, costmaps, AMCL particles, robot status

## Testing

No test framework is currently configured. The project focuses on:
- Manual testing with Vite dev server (`npm run dev`)
- Linting for code quality (`npm run lint`)
- Build validation (`npm run build`)

## Key Technical Considerations

### Three.js Scene Management
The Map3D component uses Three.js with:
- **WebGLRenderer**: Renders to the mount div
- **PerspectiveCamera**: 3D camera with orbit controls
- **GridHelper**: Floor grid for reference
- **URDF models**: Robot representation loaded via urdf-loader
- **Raycasting**: Mouse picking for interactive goal/pose placement

### Performance
- Components use lazy loading with React.lazy() and Suspense for code splitting
- Robot polling (5s interval) uses ref to track if API notification already shown
- Document visibility check prevents polling when tab is hidden
- Scene updates batched with requestAnimationFrame in Map3D
- Error boundaries wrap Map3D and other critical components

### styling
All styling is done inline with React style objects. No CSS files except `src/index.css`. Dark theme with glassmorphism effects (backdrop blur, semi-transparent backgrounds).

## ESLint Configuration

Rules follow React 18.3 best practices:
- React hooks rules enforced
- JSX runtime rules enabled (no React import needed)
- React Refresh integration for fast refresh
- `jsx-no-target-blank` disabled

Run `npm run lint` to check for violations.

## Architecture Migration: open-RMF + VDA5050

**⚠️ Important**: This project is scheduled for a major architecture migration. **Read [OPENRMF_MIGRATION.md](./OPENRMF_MIGRATION.md) before starting any significant development work.**

### Current Status

- **Stack**: ROS 1/2 with roslib WebSocket (single robot)
- **Limitation**: No multi-robot coordination, no interoperability with other manufacturers

### Migration Goal

- **Target**: open-RMF fleet manager with VDA5050 interoperability
- **Timeline**: MVP in 4 weeks (Phases 1-3), VDA5050 in Sprint 2 (Phase 4)
- **Impact**: Significant refactoring of hooks, API integration, and state management

### Key Changes (Planned)

1. **useRos** → **useRMFApi** (REST + WebSocket to RMF API Server :7878)
2. **useFleetPolling** → **useFleetState** (event-driven Fleet State)
3. **useTfGraph** → **useRMFPoses** (centralized pose from RMF)
4. **Fleet Adapter** (new backend): Translates ROS 2 ↔ open-RMF ↔ VDA5050
5. **TaskManager** (new UI): Multi-task submission and tracking

### When to Use Current vs New Architecture

- **Current** (ROS single-robot): Development until Phase 1 complete
- **New** (open-RMF multi-robot): Development from Semana 2 onwards
- **Parallel**: rosbridge continues for sensor data (costmaps, LiDAR) during Phases 1-3, deprecated in Phase 4

### Files to Watch for Changes

- `src/hooks/useRos.js` - Will be wrapped by `useRosVisuals` → deprecated
- `src/hooks/useFleetPolling.js` - Will be replaced by `useFleetState`
- `src/components/navigation/Map3D.jsx` - Multi-robot refactoring
- `src/utils/SimpleTfGraph.js` - Will be replaced by `useRMFPoses`

See **[OPENRMF_MIGRATION.md](./OPENRMF_MIGRATION.md)** for complete details, timeline, and implementation guide.
