import { useState, useEffect } from 'react';
import { useRos } from './hooks/useRos';
import { Joystick } from './components/Joystick';
import { Telemetry } from './components/Telemetry';
import { NavigationControl } from './components/NavigationControl';
import { Map3D } from './components/Map3D';
import { LogoUploader } from './components/LogoUploader';
import { FleetSelector } from './components/FleetSelector';
import * as ROSLIB from 'roslib'; // Import necessário para o Cancel

function App() {
  const [robots, setRobots] = useState([
    { id: 1, name: 'Mutley', ip: '192.168.1.56', online: false }, // Ajuste seus IPs
    { id: 2, name: 'Darth',  ip: '192.168.0.40', online: false },
    { id: 3, name: 'Sim',    ip: 'localhost',    online: false }
  ]);

  const [activeRobotId, setActiveRobotId] = useState(1);
  const [showFootprint, setShowFootprint] = useState(true);
  const [viewMode, setViewMode] = useState('FREE');
  
  // --- NOVO: Estado para controlar a ferramenta do mouse (GOAL ou POSE) ---
  const [activeTool, setActiveTool] = useState(null);

  const activeRobot = robots.find(r => r.id === activeRobotId);
  const { isConnected, ros } = useRos(activeRobot?.ip);

  useEffect(() => {
    setRobots(prev => prev.map(r => r.id === activeRobotId ? { ...r, online: isConnected } : r));
  }, [isConnected, activeRobotId]);

  // Função para Cancelar Navegação (Stop)
  const handleStopNav2 = () => {
    if (!ros) return;
    console.log("🛑 STOP NAV2");
    // Publica velocidade zero para garantir parada imediata
    const cmdVel = new ROSLIB.Topic({ ros, name: '/cmd_vel', messageType: 'geometry_msgs/Twist' });
    const stopMsg = new ROSLIB.Message({ linear: { x: 0,y:0,z:0 }, angular: { x: 0,y:0,z:0 } });
    
    // Tenta cancelar ação do Nav2 (dependendo da sua stack, pode precisar de ActionClient)
    // Por enquanto, enviamos STOP manual várias vezes
    for(let i=0; i<5; i++) cmdVel.publish(stopMsg);
    
    setActiveTool(null); // Desativa ferramentas
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', background: '#000', overflow: 'hidden', color: '#eee', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* CAMADA 0: MAPA 3D (Recebe activeTool e setActiveTool) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Map3D 
          ros={ros} 
          showFootprint={showFootprint} 
          viewMode={viewMode}
          activeTool={activeTool}       // <--- Passando estado
          setActiveTool={setActiveTool} // <--- Passando função
        />
      </div>

      {/* HEADER */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '80px', zIndex: 20, display: 'flex', alignItems: 'center', padding: '0 20px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', pointerEvents: 'auto' }}>
          <LogoUploader />
          <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '2px', fontWeight: '800', color: 'rgba(255,255,255,0.9)', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
            FREEBOTICS STUDIO
          </h1>
        </div>
      </div>

      {/* PAINEL ESQUERDO */}
      <aside style={{ position: 'absolute', top: '100px', left: '20px', width: '280px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '15px', pointerEvents: 'none' }}>
        
        {/* 1. SELETOR DE FROTA */}
        <div style={{ pointerEvents: 'auto', background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <FleetSelector robots={robots} activeId={activeRobotId} onSelect={setActiveRobotId} />
        </div>

        {/* 2. NAV2 CONTROL (RESTAURADO) */}
        <div style={{ pointerEvents: 'auto', background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ccc', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>
                NAV2 CONTROL
            </div>
            
            <button 
                onClick={() => setActiveTool(activeTool === 'GOAL' ? null : 'GOAL')} 
                style={{ 
                    background: activeTool === 'GOAL' ? '#ff4b5c' : 'rgba(0, 210, 106, 0.1)', 
                    border: '1px solid #00d26a', color: activeTool === 'GOAL' ? '#fff' : '#00d26a', 
                    padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                }}>
                {activeTool === 'GOAL' ? '❌ CANCEL SELECTION' : '🎯 SET GOAL'}
            </button>

            <button 
                onClick={() => setActiveTool(activeTool === 'POSE' ? null : 'POSE')}
                style={{ 
                    background: activeTool === 'POSE' ? '#ff4b5c' : 'rgba(157, 0, 255, 0.1)', 
                    border: '1px solid #9d00ff', color: activeTool === 'POSE' ? '#fff' : '#9d00ff', 
                    padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                }}>
                {activeTool === 'POSE' ? '❌ CANCEL SELECTION' : '📍 SET POSITION'}
            </button>

            <button 
                onClick={handleStopNav2}
                style={{ 
                    marginTop: '5px', background: 'rgba(255, 75, 92, 0.2)', 
                    border: '1px solid #ff4b5c', color: '#ff4b5c', 
                    padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                }}>
                🛑 STOP ROBOT
            </button>
        </div>

        {/* 3. NAVIGATION CONTROL (Inputs Manuais) */}
        <div style={{ pointerEvents: 'auto' }}>
          <NavigationControl 
            ros={ros} 
            showFootprint={showFootprint} 
            setShowFootprint={setShowFootprint} 
            viewMode={viewMode} 
            setViewMode={setViewMode} 
          />
        </div>
      </aside>

      {/* PAINEL DIREITO */}
      <aside style={{ position: 'absolute', top: '20px', right: '20px', width: '320px', zIndex: 10, background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', pointerEvents: 'auto', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
           <span style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase' }}>CONNECTION</span>
           <div style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
             <span style={{ color: isConnected ? '#00d26a' : '#ff4b5c' }}>{isConnected ? '● ONLINE' : '● OFFLINE'}</span>
             <span style={{ background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', opacity: 0.8 }}>{activeRobot?.ip}</span>
           </div>
        </div>
        <Telemetry ros={ros} />
      </aside>

      <Joystick ros={ros} />
    </div>
  );
}

export default App;