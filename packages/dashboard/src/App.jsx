import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';

// LEGACY: useRos kept for rosbridge sensor data (costmaps, LiDAR) until Phase 4
import { useRos } from './hooks/useRos';

import { useRMFApi }    from './hooks/useRMFApi';
import { useFleetState } from './hooks/useFleetState';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import { initRMFUrls } from './lib/rmfClient';

const Joystick           = lazy(() => import('./components/controls/Joystick'));
const DashboardPanel     = lazy(() => import('./components/display/DashboardPanel'));
const NavigationControl  = lazy(() => import('./components/navigation/NavigationControl'));
const Map3D              = lazy(() => import('./components/navigation/Map3D'));
const LogoUploader       = lazy(() => import('./components/fleet/LogoUploader'));
const FleetSelector      = lazy(() => import('./components/fleet/FleetSelector'));
const NotificationDisplay = lazy(() => import('./components/display/NotificationDisplay'));
const TaskManager        = lazy(() => import('./components/tasks/TaskManager'));
const ConnectionSettings  = lazy(() => import('./components/settings/ConnectionSettings'));

// ── Connection status dot ────────────────────────────────────────────────────
const STATUS_DOT = {
  connected:    { color: '#10b981', title: 'RMF conectado' },
  connecting:   { color: '#f59e0b', title: 'Conectando ao RMF…' },
  disconnected: { color: '#6b7280', title: 'RMF desconectado' },
  error:        { color: '#ef4444', title: 'Erro RMF' },
};

function ConnectionDot({ status }) {
  const cfg = STATUS_DOT[status] ?? STATUS_DOT.disconnected;
  return (
    <span
      title={cfg.title}
      style={{
        display: 'inline-block',
        width: 8, height: 8,
        borderRadius: '50%',
        background: cfg.color,
        boxShadow: `0 0 6px ${cfg.color}`,
        flexShrink: 0,
      }}
    />
  );
}

ConnectionDot.propTypes = { status: PropTypes.string };

// ── SidebarLeft — fleet list ─────────────────────────────────────────────────
function SidebarLeft({ robots, activeRobotId, onSelectRobot, connectionStatus }) {
  return (
    <aside style={{
      position: 'absolute', top: '90px', left: '20px', width: '280px', zIndex: 10,
      display: 'flex', flexDirection: 'column', gap: '12px',
      pointerEvents: 'none'
    }}>
      <div style={{
        pointerEvents: 'auto',
        opacity: 0.9,
        background: 'rgba(19, 21, 31, 0.9)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        padding: '15px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.4)'
      }}>
        <FleetSelector
          robots={robots}
          activeId={activeRobotId}
          onSelect={onSelectRobot}
          connectionStatus={connectionStatus}
        />
      </div>
    </aside>
  );
}

SidebarLeft.propTypes = {
  robots:           PropTypes.array.isRequired,
  activeRobotId:    PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSelectRobot:    PropTypes.func.isRequired,
  connectionStatus: PropTypes.string,
};

// ── SidebarRight — nav controls + TaskManager ────────────────────────────────
function SidebarRight({ ros, isRoslibReady, showFootprint, setShowFootprint, viewMode, setViewMode, activeTool, setActiveTool }) {
  return (
    <aside style={{
      position: 'absolute', opacity: 0.9, top: '90px', right: '20px', width: '290px', zIndex: 10,
      display: 'flex', flexDirection: 'column', gap: '10px',
      pointerEvents: 'auto', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto'
    }}>
      {/* Navigation tools */}
      <div style={{ background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ccc', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px', marginBottom: '5px' }}>NAV2 CONTROL</div>

        <button onClick={() => setActiveTool(activeTool === 'GOAL' ? null : 'GOAL')} style={{ background: activeTool === 'GOAL' ? '#ff4b5c' : 'rgba(0, 210, 106, 0.1)', border: '1px solid #00d26a', color: activeTool === 'GOAL' ? '#fff' : '#00d26a', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
          {activeTool === 'GOAL' ? '❌ CANCEL' : '🎯 SET GOAL'}
        </button>

        <button onClick={() => setActiveTool(activeTool === 'POSE' ? null : 'POSE')} style={{ background: activeTool === 'POSE' ? '#ff4b5c' : 'rgba(157, 0, 255, 0.1)', border: '1px solid #9d00ff', color: activeTool === 'POSE' ? '#fff' : '#9d00ff', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
          {activeTool === 'POSE' ? '❌ CANCEL' : '📍 SET POSE'}
        </button>
        {/* STOP button removed — use TaskManager cancelTask for RMF-managed robots */}
      </div>

      {/* View/sensor options */}
      <div>
        <NavigationControl ros={ros} isRoslibReady={isRoslibReady} showFootprint={showFootprint} setShowFootprint={setShowFootprint} viewMode={viewMode} setViewMode={setViewMode} />
      </div>

      {/* Task Manager — RMF task submission and status */}
      <TaskManager />
    </aside>
  );
}

SidebarRight.propTypes = {
  ros:              PropTypes.object,
  isRoslibReady:    PropTypes.bool.isRequired,
  showFootprint:    PropTypes.bool.isRequired,
  setShowFootprint: PropTypes.func.isRequired,
  viewMode:         PropTypes.string.isRequired,
  setViewMode:      PropTypes.func.isRequired,
  activeTool:       PropTypes.string,
  setActiveTool:    PropTypes.func.isRequired,
};

// ── TopHeader ─────────────────────────────────────────────────────────────────
function TopHeader({ connectionStatus, onSettingsClick }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60px', zIndex: 20, display: 'flex', alignItems: 'center', padding: '0 20px', pointerEvents: 'none', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', pointerEvents: 'auto' }}>
        <LogoUploader />
        <h1 style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '2px', fontWeight: '800', color: 'rgba(255,255,255,0.9)', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>HERMES</h1>
        <ConnectionDot status={connectionStatus} />
      </div>
      <button
        onClick={onSettingsClick}
        style={{
          pointerEvents: 'auto',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '6px',
          padding: '6px 10px',
          cursor: 'pointer',
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: '18px',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={e => {
          e.target.style.background = 'rgba(255, 255, 255, 0.15)';
          e.target.style.color = 'rgba(255, 255, 255, 0.9)';
        }}
        onMouseLeave={e => {
          e.target.style.background = 'rgba(255, 255, 255, 0.1)';
          e.target.style.color = 'rgba(255, 255, 255, 0.7)';
        }}
        title="Connection Settings"
      >
        ⚙️
      </button>
    </div>
  );
}

TopHeader.propTypes = { connectionStatus: PropTypes.string, onSettingsClick: PropTypes.func };

// ── AppContent — main layout ──────────────────────────────────────────────────
function AppContent() {
  const isRoslibReady = true;
  const { addNotification } = useNotification();

  // RMF: start WebSocket → populates fleetStore
  useRMFApi();
  const { robots, connectionStatus } = useFleetState();

  // LEGACY: rosbridge connection for sensor data (costmaps, LiDAR) until Phase 4
  const robotIp = import.meta.env.VITE_ROBOT_IP ?? 'localhost';
  const { ros } = useRos(isRoslibReady ? robotIp : null);

  const [activeRobotId, setActiveRobotId]     = useState(null);
  const [showFootprint, setShowFootprint]     = useState(true);
  const [viewMode, setViewMode]               = useState('FREE');
  const [activeTool, setActiveTool]           = useState(null);
  const [initialPoseSent, setInitialPoseSent] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Auto-select first robot when fleet populates
  useEffect(() => {
    if (!activeRobotId && robots.length > 0) {
      setActiveRobotId(robots[0].id);
    }
  }, [robots, activeRobotId]);

  const activeRobot = useMemo(() => robots.find(r => r.id === activeRobotId), [robots, activeRobotId]);

  // Send initial pose via rosbridge when connected (AMCL re-localisation)
  useEffect(() => {
    if (!ros || !window.ROSLIB || initialPoseSent) return;
    try {
      const initPoseTopic = new window.ROSLIB.Topic({ ros, name: '/initialpose', messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped' });
      initPoseTopic.publish({
        header: { frame_id: 'map', stamp: { sec: 0, nanosec: 0 } },
        pose: {
          pose: { position: { x: 0.3, y: -1, z: 0.0 }, orientation: { x: 0, y: 0, z: 1, w: 0 } },
          covariance: [0.25, 0, 0, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0, 0, 0.0685, 0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0.0685],
        },
      });
      setInitialPoseSent(true);
    } catch { addNotification('❌ Erro pose inicial'); }
  }, [ros, initialPoseSent, addNotification]);

  return (
    <div style={{ position: 'relative', opacity: 0.8, height: '100vh', width: '100vw', background: '#000', overflow: 'hidden', color: '#eee', fontFamily: 'system-ui, sans-serif' }}>
      <Suspense fallback={<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Carregando Mapa...</div>}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <ErrorBoundary>
            <Map3D ros={ros} showFootprint={showFootprint} viewMode={viewMode} activeTool={activeTool} setActiveTool={setActiveTool} />
          </ErrorBoundary>
        </div>
      </Suspense>

      <Suspense fallback={null}>
        <DashboardPanel ros={ros} robotName={activeRobot?.id} robot={activeRobot} />
        <TopHeader connectionStatus={connectionStatus} onSettingsClick={() => setShowSettingsModal(true)} />
        <ConnectionSettings isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
        <SidebarLeft robots={robots} activeRobotId={activeRobotId} onSelectRobot={setActiveRobotId} connectionStatus={connectionStatus} />
        <SidebarRight
          ros={ros}
          isRoslibReady={isRoslibReady}
          showFootprint={showFootprint}
          setShowFootprint={setShowFootprint}
          viewMode={viewMode}
          setViewMode={setViewMode}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
        />
        <Joystick ros={ros} />
      </Suspense>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
function App() {
  const [notifications, setNotifications] = useState([]);

  // Initialize RMF URLs from Electron settings (if running in Electron)
  useEffect(() => {
    initRMFUrls().catch(error => console.error('[App] Failed to init RMF URLs:', error));
  }, []);

  return (
    <NotificationProvider onNotification={setNotifications}>
      <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000', color: '#fff' }}>
        <AppContent />
        <Suspense fallback={null}>
          <NotificationDisplay notifications={notifications} />
        </Suspense>
      </div>
    </NotificationProvider>
  );
}

export default App;
