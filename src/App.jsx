import { useRos } from './hooks/useRos';
import { Joystick } from './components/Joystick';
import { Telemetry } from './components/Telemetry';
import { Map3D } from './components/Map3D';
// Novos componentes
import { LogoUploader } from './components/LogoUploader';
//import { EStop } from './components/EStop';
//import { CameraView } from './components/CameraView';
//import { LogConsole } from './components/LogConsole';

function App() {
  const { isConnected, ip, ros } = useRos();

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '360px 1fr', // Aumentei um pouco a sidebar (360px)
      gridTemplateRows: '60px 1fr',     
      height: '100vh', 
      width: '100vw',
      background: '#0f111a', 
      color: '#eee',
      overflow: 'hidden'
    }}>
      
      {/* 1. HEADER COM LOGO */}
      <header style={{ 
        gridColumn: '1 / -1', 
        background: '#1f2833', 
        borderBottom: '1px solid #333',
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 20px',
        opacity: 0.6,
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Componente de Logo aqui */}
          <LogoUploader />
          
          <div>
            <h1 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '1px', fontWeight: 'bold' }}>
              FREEBOTICS STUDIO
            </h1>
            <span style={{ fontSize: '0.75rem', opacity: 0.7, background: '#000', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
              {ip}
            </span>
          </div>
        </div>
        
        <div className={isConnected ? 'online' : 'offline'} style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
          {isConnected ? '● CONECTADO' : '● DESCONECTADO'}
        </div>
      </header>

      {/* 2. SIDEBAR RECHEADA */}
      <aside style={{ 
        padding: '15px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '15px', 
        overflowY: 'auto',
        borderRight: '1px solid #222',
        background: '#13151f',
        zIndex: 5
      }}>
        
        {/*Prioridade Máxima: Botão de Pânico
        {/* <EStop ros={ros} /> */}
{/*  */}
        {/*Visualização (Câmera)
        {/* <CameraView /> */}

        {/* Dados e Controle */}
        <Telemetry ros={ros} />

        {/*Logs do Sistema (Fica no rodapé da sidebar)}
        {/* <LogConsole ros={ros} /> */}

      </aside>

      {/* 3. MAPA 3D */}
      <main style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
        <div style={{ flexGrow: 1, width: '100%', height: '100%', position: 'relative' }}>
            <Map3D ros={ros} />
        </div>
      </main>
      <Joystick ros={ros} />
    </div>
  );
}

export default App;