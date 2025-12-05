import { useState, useEffect } from 'react';
import { useRos } from './hooks/useRos';
import { Joystick } from './components/Joystick';
import { Telemetry } from './components/Telemetry';
import { Map3D } from './components/Map3D';
import { LogoUploader } from './components/LogoUploader';
import { FleetSelector } from './components/FleetSelector';
// import { EStop } from './components/EStop';
// import { CameraView } from './components/CameraView';
// import { LogConsole } from './components/LogConsole';

function App() {
  // 1. Estado da Frota (Agora com memória de 'online')
  const [robots, setRobots] = useState([
    { id: 1, name: 'Mutley', ip: '192.168.0.39', online: false },
    { id: 2, name: 'Darth',  ip: '192.168.0.40', online: false },
    { id: 3, name: 'Sim',    ip: 'localhost',    online: false }
  ]);

  const [activeRobotId, setActiveRobotId] = useState(1);
  
  // Identifica o robô ativo para conectar
  const activeRobot = robots.find(r => r.id === activeRobotId);
  
  // O Hook gerencia a conexão real
  const { isConnected, ros } = useRos(activeRobot?.ip);

  // 2. EFEITO DE MEMÓRIA:
  // Sempre que a conexão muda (conectou ou caiu), atualizamos APENAS o robô ativo na lista.
  // Os outros robôs mantêm o último estado que tinham (não viram vermelho automaticamente).
  useEffect(() => {
    setRobots(prevRobots => prevRobots.map(robot => {
      // Se é o robô atual, atualiza com a verdade da conexão
      if (robot.id === activeRobotId) {
        return { ...robot, online: isConnected };
      }
      // Se não é o atual, retorna ele igualzinho estava (preserva o Verde/Vermelho)
      return robot;
    }));
  }, [isConnected, activeRobotId]);

  return (
    <div style={{ 
      position: 'relative', height: '100vh', width: '100vw', 
      background: '#000', overflow: 'hidden', color: '#eee', fontFamily: 'system-ui, sans-serif' 
    }}>
      
      {/* CAMADA 0: MAPA 3D */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <Map3D ros={ros} />
      </div>

      {/* CAMADA 1: HEADER TRANSPARENTE */}
      <div style={{ 
        position: 'absolute', top: 0, left: 0, width: '100%', height: '80px', 
        zIndex: 20, display: 'flex', alignItems: 'center', padding: '0 20px',
        background: 'transparent', pointerEvents: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', pointerEvents: 'auto' }}>
          <LogoUploader />
          <h1 style={{ 
            margin: 0, fontSize: '1.5rem', letterSpacing: '2px', fontWeight: '800', 
            color: 'rgba(255,255,255,0.9)', textShadow: '0 2px 10px rgba(0,0,0,0.8)' 
          }}>
            FREEBOTICS STUDIO
          </h1>
        </div>
      </div>

      {/* CAMADA 2: PAINEL ESQUERDO (FLEET) */}
      <aside style={{ 
        position: 'absolute', top: '100px', left: '20px', width: '280px', zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '15px', opacity: '0.9'
      }}>
        <div style={{
            background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', pointerEvents: 'auto'
        }}>
          {/* Passamos a lista 'robots' direta, que agora tem memória de estado */}
          <FleetSelector 
            robots={robots} 
            activeId={activeRobotId} 
            onSelect={setActiveRobotId} 
          />
        </div>
      </aside>

      {/* CAMADA 3: PAINEL DIREITO (TELEMETRIA) */}
      <aside style={{ 
        position: 'absolute', top: '20px', right: '20px', width: '320px', zIndex: 10,
        background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)', opacity: '0.9',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', 
        padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        pointerEvents: 'auto'
      }}>
        
        {/* Cabeçalho Técnico */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'
        }}>
           <span style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
             CONNECTION
           </span>
           <div style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
             <span style={{ color: isConnected ? '#00d26a' : '#ff4b5c' }}>
               {isConnected ? '● ONLINE' : '● OFFLINE'}
             </span>
             <span style={{ background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', opacity: 0.8 }}>
               {activeRobot?.ip}
             </span>
           </div>
        </div>

        <Telemetry ros={ros} />

      </aside>

      {/* CAMADA 4: JOYSTICK */}
      <Joystick ros={ros} />

    </div>
  );
}

export default App;