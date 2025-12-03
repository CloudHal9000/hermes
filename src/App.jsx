import { useRos } from './hooks/useRos';
import { Joystick } from './components/Joystick';
import { Telemetry } from './components/Telemetry';
import { Map3D } from './components/Map3D';
import { LogoUploader } from './components/LogoUploader';
// import { EStop } from './components/EStop';
// import { CameraView } from './components/CameraView';
// import { LogConsole } from './components/LogConsole';

function App() {
  const { isConnected, ip, ros } = useRos();

  return (
    <div style={{ 
      position: 'relative',
      height: '100vh', 
      width: '100vw',
      background: '#000', 
      overflow: 'hidden',
      color: '#eee',
      fontFamily: 'system-ui, sans-serif'
    }}>
      
      {/* --- CAMADA 0: MAPA 3D (Fundo Total) --- */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        zIndex: 0 
      }}>
        <Map3D ros={ros} />
      </div>

      {/* --- CAMADA 1: HEADER (Flutuante no topo) --- */}
      <header style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '60px',
        zIndex: 20, 
        
        // Estilo Vidro
        background: 'rgba(31, 40, 51, 0.85)', 
        backdropFilter: 'blur(8px)',          
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 20px',
        justifyContent: 'space-between',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <LogoUploader />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '1px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              FREEBOTICS STUDIO
            </h1>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
              {ip}
            </span>
          </div>
        </div>
        <div className={isConnected ? 'online' : 'offline'} style={{ fontSize: '0.8rem', fontWeight: 'bold', textShadow: '0 1px 2px black' }}>
          {isConnected ? '● CONECTADO' : '● DESCONECTADO'}
        </div>
      </header>

      {/* --- CAMADA 2: SIDEBAR (Flutuante na esquerda) --- */}
      <aside style={{ 
        position: 'absolute',
        top: '80px',
        left: '10px',
        bottom: '20px',
        width: '340px',
        height: '500px',
        zIndex: 10,
      }}>
        {/* Componentes da Sidebar */}
        {/* <EStop ros={ros} /> */}
        {/* <CameraView /> */}
        <Telemetry ros={ros} />
        {/* <LogConsole ros={ros} /> */}

      </aside>
      {/* --- CAMADA 3: JOYSTICK (Já é fixed/flutuante) --- */}
      <Joystick ros={ros} />
    </div>
  );
}

export default App;