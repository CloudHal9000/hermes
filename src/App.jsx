import { useState, useEffect, useRef } from 'react';
import { useRos } from './hooks/useRos';
import { useExternalScript } from './hooks/useExternalScript';
import { Joystick } from './components/Joystick';
import { DashboardPanel } from './components/DashboardPanel';
import { NavigationControl } from './components/NavigationControl';
import { Map3D } from './components/Map3D';
import { LogoUploader } from './components/LogoUploader';
import { FleetSelector } from './components/FleetSelector';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { NotificationDisplay } from './components/NotificationDisplay';

function AppContent() {
  const isEventEmitterReady = useExternalScript("https://cdn.jsdelivr.net/npm/eventemitter2@6.4.9/lib/eventemitter2.min.js" );
  const isRoslibReady = useExternalScript(isEventEmitterReady ? "https://cdn.jsdelivr.net/npm/roslib/build/roslib.min.js" : null );
  const { addNotification } = useNotification();

  const [robots, setRobots] = useState([]);
  const [activeRobotId, setActiveRobotId] = useState(1);
  const [showFootprint, setShowFootprint] = useState(true);
  const [viewMode, setViewMode] = useState('FREE');
  const [activeTool, setActiveTool] = useState(null);
  const [initialPoseSent, setInitialPoseSent] = useState(false);
  const apiNotificationShownRef = useRef(false);

  // FETCH API
  useEffect(() => {
    const fetchRobotsFromAPI = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/robots' );
        if (!response.ok) { addNotification(`⚠️ API status ${response.status}`); return; }
        const data = await response.json();
        
        if (data.robots && Array.isArray(data.robots)) {
          const mappedRobots = data.robots.map((robot, index) => ({
            id: index + 1,
            name: robot.id.charAt(0).toUpperCase() + robot.id.slice(1),
            ip: robot.ip,
            online: robot.status === 'online',
            status: robot.status, 
            battery_level: robot.battery_level,
            mode: robot.mode,
            hasError: robot.has_error || false 
          }));

          if (!apiNotificationShownRef.current) {
            addNotification(`✅ ${mappedRobots.length} robô(s) carregado(s)`);
            apiNotificationShownRef.current = true;
          }
          setRobots(mappedRobots);
        }
      } catch { addNotification(`❌ Erro API`); }
    };
    fetchRobotsFromAPI();
    const interval = setInterval(fetchRobotsFromAPI, 5000);
    return () => clearInterval(interval);
  }, [addNotification]);

  const activeRobot = robots.find(r => r.id === activeRobotId);
  const { isConnected, ros } = useRos(isRoslibReady ? activeRobot?.ip : null);

  // POSE INICIAL
  useEffect(() => {
    if (!isConnected || !isRoslibReady || !window.ROSLIB || initialPoseSent) return;
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

  const handleStopNav2 = () => {
    if (!ros || !isRoslibReady || !window.ROSLIB) return;
    const cmdVel = new window.ROSLIB.Topic({ ros, name: '/cmd_vel', messageType: 'geometry_msgs/Twist' });
    const stopMsg = new window.ROSLIB.Message({ linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } });
    for (let i = 0; i < 5; i++) cmdVel.publish(stopMsg);
    setActiveTool(null);
    addNotification("🛑 Parada enviada");
  };

  return (
    <div style={{ position: 'relative', opacity: 0.8, height: '100vh', width: '100vw', background: '#000', overflow: 'hidden', color: '#eee', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* --- FUNDO 3D --- */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Map3D ros={ros} showFootprint={showFootprint} viewMode={viewMode} activeTool={activeTool} setActiveTool={setActiveTool} />
      </div>

      {/* --- BARRA TOPO --- */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '80px', zIndex: 20, display: 'flex', alignItems: 'center', padding: '0 20px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', pointerEvents: 'auto' }}>
          <LogoUploader />
          <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '2px', fontWeight: '800', color: 'rgba(255,255,255,0.9)', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>FREEBOTICS STUDIO</h1>
        </div>
      </div>

      {/* --- SIDEBAR ESQUERDA (APENAS FLEET) --- */}
      <aside style={{ 
        position: 'absolute', top: '100px', left: '20px', width: '280px', zIndex: 10, 
        display: 'flex', flexDirection: 'column', gap: '15px', pointerEvents: 'none' 
      }}>
        
        <div style={{ pointerEvents: 'auto', opacity: 0.8, background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <FleetSelector robots={robots} activeId={activeRobotId} onSelect={setActiveRobotId} />
        </div>

      </aside>

      {/* --- SIDEBAR DIREITA (WIDGET + COMANDOS) --- */}
      <aside style={{ 
        position: 'absolute', opacity: 0.8, top: '20px', right: '20px', width: '300px', zIndex: 10, 
        display: 'flex', flexDirection: 'column', gap: '12px', 
        pointerEvents: 'auto', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' 
      }}>
        
        {/* 1. WIDGET DE STATUS (Slim) */}
        <DashboardPanel ros={ros} robotName={activeRobot?.name} robot={activeRobot} />

        {/* 2. NAV2 CONTROL (Movido da esquerda) */}
        <div style={{ background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ccc', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px', marginBottom:'5px' }}>NAV2 CONTROL</div>
            
            <button onClick={() => setActiveTool(activeTool === 'GOAL' ? null : 'GOAL')} style={{ background: activeTool === 'GOAL' ? '#ff4b5c' : 'rgba(0, 210, 106, 0.1)', border: '1px solid #00d26a', color: activeTool === 'GOAL' ? '#fff' : '#00d26a', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
              {activeTool === 'GOAL' ? '❌ CANCEL' : '🎯 SET GOAL'}
            </button>
            
            <button onClick={() => setActiveTool(activeTool === 'POSE' ? null : 'POSE')} style={{ background: activeTool === 'POSE' ? '#ff4b5c' : 'rgba(157, 0, 255, 0.1)', border: '1px solid #9d00ff', color: activeTool === 'POSE' ? '#fff' : '#9d00ff', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
              {activeTool === 'POSE' ? '❌ CANCEL' : '📍 SET POSE'}
            </button>
            
            <button onClick={handleStopNav2} style={{ marginTop: '5px', background: 'rgba(255, 75, 92, 0.2)', border: '1px solid #ff4b5c', color: '#ff4b5c', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
              🛑 STOP ROBOT
            </button>
        </div>

        {/* 3. NAVIGATION (Movido da esquerda) */}
        <div>
          <NavigationControl ros={ros} isRoslibReady={isRoslibReady} showFootprint={showFootprint} setShowFootprint={setShowFootprint} viewMode={viewMode} setViewMode={setViewMode} />
        </div>

      </aside>

      <Joystick ros={ros} />
    </div>
  );
}

function App() {
  const [notifications, setNotifications] = useState([]);
  return (
    <NotificationProvider onNotification={setNotifications}>
      <AppContent />
      <NotificationDisplay notifications={notifications} />
    </NotificationProvider>
  );
}

export default App;