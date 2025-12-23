import { useState, useEffect } from 'react';
import { useRos } from './hooks/useRos';
import { useExternalScript } from './hooks/useExternalScript'; // 1. Mantenha esta importação
import { Joystick } from './components/Joystick';
import { Telemetry } from './components/Telemetry';
import { NavigationControl } from './components/NavigationControl';
import { Map3D } from './components/Map3D';
import { LogoUploader } from './components/LogoUploader';
import { FleetSelector } from './components/FleetSelector';

function App() {
  const isEventEmitterReady = useExternalScript("https://cdn.jsdelivr.net/npm/eventemitter2@6.4.9/lib/eventemitter2.min.js" );
  const isRoslibReady = useExternalScript(isEventEmitterReady ? "https://cdn.jsdelivr.net/npm/roslib/build/roslib.min.js" : null );

  const [robots, setRobots] = useState([
    { id: 1, name: 'Mutley', ip: '192.168.1.142', online: false },
    { id: 2, name: 'Darth',  ip: '192.168.0.40', online: false },
    { id: 3, name: 'Sim',    ip: 'localhost',    online: false }
  ]);

  const [activeRobotId, setActiveRobotId] = useState(1);
  const [showFootprint, setShowFootprint] = useState(true);
  const [viewMode, setViewMode] = useState('FREE');
  const [activeTool, setActiveTool] = useState(null);

  useEffect(() => {
    const fetchRobotsFromAPI = async () => {
      try {
        const response = await fetch('http://0.0.0.0:8000/api/robots' );
        
        if (!response.ok) {
          console.warn(`⚠️ API retornou status ${response.status}. Mantendo lista anterior de robôs.`);
          return;
        }

        const data = await response.json();
        
        // Mapeia os dados da API para o formato esperado pelo dashboard
        if (data.robots && Array.isArray(data.robots)) {
          const mappedRobots = data.robots.map((robot, index) => ({
            id: index + 1, // Usa um ID numérico para compatibilidade com o seletor
            name: robot.id.charAt(0).toUpperCase() + robot.id.slice(1), // Capitaliza o nome
            ip: robot.ip,
            online: robot.status === 'online',
            battery_level: robot.battery_level,
            mode: robot.mode
          }));

          console.log('✅ Robôs carregados da API:', mappedRobots);
          setRobots(mappedRobots);
        }
      } catch (error) {
        console.error('❌ Erro ao buscar robôs da API:', error);
        // Se houver erro, mantém a lista anterior
      }
    };

    // Busca os robôs imediatamente quando o componente monta
    fetchRobotsFromAPI();

    // Configura a atualização periódica a cada 5 segundos
    const interval = setInterval(fetchRobotsFromAPI, 5000);

    // Limpa o intervalo quando o componente é desmontado
    return () => clearInterval(interval);
  }, []);

  const activeRobot = robots.find(r => r.id === activeRobotId);
  const { isConnected, ros } = useRos(isRoslibReady ? activeRobot?.ip : null);

  useEffect(() => {
    setRobots(prev => prev.map(r => r.id === activeRobotId ? { ...r, online: isConnected } : r));
  }, [isConnected, activeRobotId]);

  const handleStopNav2 = () => {
    // 4. ALTERAÇÃO: Verifica se o window.ROSLIB existe antes de usar
    if (!ros || !isRoslibReady || !window.ROSLIB) return;
    console.log("🛑 STOP NAV2");
    const cmdVel = new window.ROSLIB.Topic({ ros, name: '/cmd_vel', messageType: 'geometry_msgs/Twist' });
    const stopMsg = new window.ROSLIB.Message({ linear: { x: 0,y:0,z:0 }, angular: { x: 0,y:0,z:0 } });
    for(let i=0; i<5; i++) cmdVel.publish(stopMsg);
    setActiveTool(null);
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', background: '#000', overflow: 'hidden', color: '#eee', fontFamily: 'system-ui, sans-serif' }}>
      
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Map3D 
          ros={ros} 
          showFootprint={showFootprint} 
          viewMode={viewMode}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
        />
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '80px', zIndex: 20, display: 'flex', alignItems: 'center', padding: '0 20px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', pointerEvents: 'auto' }}>
          <LogoUploader />
          <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '2px', fontWeight: '800', color: 'rgba(255,255,255,0.9)', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
            FREEBOTICS STUDIO
          </h1>
        </div>
      </div>

      <aside style={{ position: 'absolute', top: '100px', left: '20px', width: '280px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '15px', pointerEvents: 'none' }}>
        
        <div style={{ pointerEvents: 'auto', background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <FleetSelector robots={robots} activeId={activeRobotId} onSelect={setActiveRobotId} />
        </div>

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

        <div style={{ pointerEvents: 'auto' }}>
          <NavigationControl 
            ros={ros}
            isRoslibReady={isRoslibReady}
            showFootprint={showFootprint} 
            setShowFootprint={setShowFootprint} 
            viewMode={viewMode} 
            setViewMode={setViewMode} 
          />
        </div>
      </aside>

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
