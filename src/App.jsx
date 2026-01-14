import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useRos } from './hooks/useRos';
import { useFleetPolling } from './hooks/useFleetPolling';
import { NotificationProvider, useNotification } from './context/NotificationContext';

const Joystick = lazy(() => import('./components/controls/Joystick'));
const DashboardPanel = lazy(() => import('./components/display/DashboardPanel'));
const NavigationControl = lazy(() => import('./components/navigation/NavigationControl'));
const Map3D = lazy(() => import('./components/navigation/Map3D'));
const LogoUploader = lazy(() => import('./components/fleet/LogoUploader'));
const FleetSelector = lazy(() => import('./components/fleet/FleetSelector'));
const NotificationDisplay = lazy(() => import('./components/display/NotificationDisplay'));

function SidebarLeft({ robots, activeRobotId, onSelectRobot }) {
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
        <FleetSelector robots={robots} activeId={activeRobotId} onSelect={onSelectRobot} />
      </div>
    </aside>
  );
}

function SidebarRight({ ros, isRoslibReady, showFootprint, setShowFootprint, viewMode, setViewMode, activeTool, setActiveTool, onStopNav2 }) {
  return (
    <aside style={{
      position: 'absolute', opacity: 0.9, top: '90px', right: '20px', width: '280px', zIndex: 10,
      display: 'flex', flexDirection: 'column', gap: '10px',
      pointerEvents: 'auto', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto'
    }}>
      <div style={{ background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ccc', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px', marginBottom: '5px' }}>NAV2 CONTROL</div>

        <button onClick={() => setActiveTool(activeTool === 'GOAL' ? null : 'GOAL')} style={{ background: activeTool === 'GOAL' ? '#ff4b5c' : 'rgba(0, 210, 106, 0.1)', border: '1px solid #00d26a', color: activeTool === 'GOAL' ? '#fff' : '#00d26a', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
          {activeTool === 'GOAL' ? '❌ CANCEL' : '🎯 SET GOAL'}
        </button>

        <button onClick={() => setActiveTool(activeTool === 'POSE' ? null : 'POSE')} style={{ background: activeTool === 'POSE' ? '#ff4b5c' : 'rgba(157, 0, 255, 0.1)', border: '1px solid #9d00ff', color: activeTool === 'POSE' ? '#fff' : '#9d00ff', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
          {activeTool === 'POSE' ? '❌ CANCEL' : '📍 SET POSE'}
        </button>

        <button onClick={onStopNav2} style={{ marginTop: '5px', background: 'rgba(255, 75, 92, 0.2)', border: '1px solid #ff4b5c', color: '#ff4b5c', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
          🛑 STOP ROBOT
        </button>
      </div>

      <div>
        <NavigationControl ros={ros} isRoslibReady={isRoslibReady} showFootprint={showFootprint} setShowFootprint={setShowFootprint} viewMode={viewMode} setViewMode={setViewMode} />
      </div>
    </aside>
  );
}

function TopHeader() {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '300px', height: '60px', zIndex: 20, display: 'flex', alignItems: 'center', padding: '0 20px', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', pointerEvents: 'auto' }}>
        <LogoUploader />
        <h1 style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '2px', fontWeight: '800', color: 'rgba(255,255,255,0.9)', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>FREEBOTICS STUDIO</h1>
      </div>
    </div>
  );
}

function AppContent() {
  const isRoslibReady = true; // Assumimos que foi carregado via index.html
  const { addNotification } = useNotification();

  const robots = useFleetPolling(addNotification);
  const [activeRobotId, setActiveRobotId] = useState(1);
  const [showFootprint, setShowFootprint] = useState(true);
  const [viewMode, setViewMode] = useState('FREE');
  const [activeTool, setActiveTool] = useState(null);
  const [initialPoseSent, setInitialPoseSent] = useState(false);

  const activeRobot = useMemo(() => robots.find(r => r.id === activeRobotId), [robots, activeRobotId]);
  const { isConnected, ros } = useRos(isRoslibReady ? activeRobot?.ip : null);

  useEffect(() => {
    if (!isConnected || !window.ROSLIB || initialPoseSent) return;
    try {
      const initPoseTopic = new window.ROSLIB.Topic({ ros: ros, name: '/initialpose', messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped' });
      const msg = new window.ROSLIB.Message({
        header: { frame_id: 'map', stamp: { sec: 0, nanosec: 0 } },
        pose: {
          pose: { position: { x: 0.3, y: -1, z: 0.0 }, orientation: { x: 0, y: 0, z: 1, w: 0 } },
          covariance: [0.25, 0, 0, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0, 0, 0.0685, 0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0.0685]
        }
      });
      initPoseTopic.publish(msg);
      setInitialPoseSent(true);
    } catch { addNotification(`❌ Erro pose inicial`); }
  }, [isConnected, isRoslibReady, initialPoseSent, ros, addNotification]);

  const handleStopNav2 = useCallback(() => {
    if (!ros || !isRoslibReady || !window.ROSLIB) return;
    const cmdVel = new window.ROSLIB.Topic({ ros, name: '/cmd_vel', messageType: 'geometry_msgs/Twist' });
    const stopMsg = new window.ROSLIB.Message({ linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } });
    for (let i = 0; i < 5; i++) cmdVel.publish(stopMsg);
    setActiveTool(null);
    addNotification("🛑 Parada enviada");
  }, [ros, isRoslibReady, addNotification]);

  return (
    <div style={{ position: 'relative', opacity: 0.8, height: '100vh', width: '100vw', background: '#000', overflow: 'hidden', color: '#eee', fontFamily: 'system-ui, sans-serif' }}>
      <Suspense fallback={<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Carregando Mapa...</div>}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <Map3D ros={ros} showFootprint={showFootprint} viewMode={viewMode} activeTool={activeTool} setActiveTool={setActiveTool} />
        </div>
      </Suspense>

      <Suspense fallback={null}>
        <DashboardPanel ros={ros} robotName={activeRobot?.name} robot={activeRobot} />
        <TopHeader />
        <SidebarLeft robots={robots} activeRobotId={activeRobotId} onSelectRobot={setActiveRobotId} />
        <SidebarRight
          ros={ros}
          isRoslibReady={isRoslibReady}
          showFootprint={showFootprint}
          setShowFootprint={setShowFootprint}
          viewMode={viewMode}
          setViewMode={setViewMode}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          onStopNav2={handleStopNav2}
        />
        <Joystick ros={ros} />
      </Suspense>
    </div>
  );
}

function App() {
  const [notifications, setNotifications] = useState([]);

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
