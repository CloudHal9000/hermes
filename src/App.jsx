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
  // 1. A lista agora é um STATE completo, pois vamos atualizar o campo 'online' individualmente
  const [robots, setRobots] = useState([
    { id: 1, name: 'Mutley', ip: '192.168.0.39', online: false },
    { id: 2, name: 'Darth',  ip: '192.168.0.40', online: false },
    { id: 3, name: 'Sim',    ip: 'localhost',    online: false }
  ]);

  const [activeRobotId, setActiveRobotId] = useState(1);
  
  // Pega o robô ativo para saber qual IP conectar
  const activeRobot = robots.find(r => r.id === activeRobotId);
  
  // O Hook tenta conectar nesse IP
  const { isConnected, ros } = useRos(activeRobot?.ip);

  // 2. EFEITO: Quando o status da conexão muda, atualizamos SÓ o robô ativo na lista
  // Os outros robôs mantêm o status que tinham (Verde ou Vermelho)
  useEffect(() => {
    setRobots(prevRobots => prevRobots.map(robot => {
      if (robot.id === activeRobotId) {
        return { ...robot, online: isConnected };
      }
      return robot; // Não mexe nos outros
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

      {/* CAMADA 1: TÍTULO E LOGO FLUTUANTES */}
      <div style={{ 
        position: 'absolute', top: '20px', left: '20px', zIndex: 30,
        display: 'flex', alignItems: 'center', gap: '15px' 
      }}>
        <LogoUploader />
        <h1 style={{ 
          margin: 0, fontSize: '1.5rem', letterSpacing: '2px', fontWeight: '800', 
          color: 'rgba(255,255,255,0.9)', textShadow: '0 2px 10px rgba(0,0,0,0.8)' 
        }}>
          FREEBOTICS STUDIO
        </h1>
      </div>

      {/* CAMADA 2: PAINEL ESQUERDO (Fleet Manager) */}
      <aside style={{ 
        position: 'absolute', top: '80px', left: '20px', width: '300px', zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '15px', opacity: 0.9
      }}>
        <div style={{
            background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '15px',
            display: 'flex', flexDirection: 'column', gap: '15px', 
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          {/* Passamos a lista 'robots' direta, que agora tem memória */}
          <FleetSelector 
            robots={robots} 
            activeId={activeRobotId} 
            onSelect={setActiveRobotId} 
          />
        </div>
      </aside>

      {/* CAMADA 3: PAINEL DIREITO (Status + Telemetria) */}
      <aside style={{ 
        position: 'absolute', top: '20px', right: '20px', width: '320px', zIndex: 10,
        background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', 
        padding: '20px',
        display: 'flex', flexDirection: 'column', gap: '15px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        maxHeight: 'calc(100vh - 40px)', overflowY: 'auto'
      }}>
        
        {/* Cabeçalho do Painel Direito */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'
        }}>
           <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '1px' }}>
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
        <Joystick ros={ros} />

    </div>
  );
}

export default App;