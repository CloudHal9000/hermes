import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { AMCLHelper } from '../utils/amclHelper'; // Ajuste o caminho conforme sua pasta

export function NavigationControl({ ros, showFootprint, setShowFootprint, viewMode, setViewMode }) {
  // Estado local para os Inputs
  const [poseInput, setPoseInput] = useState({ x: '0', y: '0', yaw: '0' });
  const amclRef = useRef(null);

  // Instancia o Helper quando o ROS muda
  useEffect(() => {
    if (ros) {
      amclRef.current = new AMCLHelper(ros);
    }
  }, [ros]);

  // Handler Genérico para Inputs
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPoseInput(prev => ({ ...prev, [name]: value }));
  };

  // Wrapper para chamar o helper
  const handleSetPose = () => {
    if (amclRef.current) {
      // Passa os valores atuais do estado
      amclRef.current.setInitialPose(poseInput.x, poseInput.y, poseInput.yaw);
    }
  };

  const handleGlobalLoc = () => {
    if (amclRef.current) {
      amclRef.current.reinitializeGlobalLocalization();
    }
  };

  const handleOrigin = () => {
    // Atalho para zerar tudo
    setPoseInput({ x: '0', y: '0', yaw: '0' });
    if (amclRef.current) {
      amclRef.current.setInitialPose(0, 0, 0);
    }
  };

  // --- RENDERIZAÇÃO (Mantendo o estilo "clean" que definimos antes) ---
  return (
    <div style={{
        width: '100%',
        background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', top: '100px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '30px'
    }}>
      
      <div style={{ fontSize: '0.9rem', color: '#ccc', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
         📍 NAVIGATION
      </div>

      {/* AMCL CONTROLS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
          LOCALIZATION (AMCL)
        </div>
        
        {/* Botões Rápidos */}
        <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={handleOrigin} style={{ flex: 1, background: 'rgba(0, 210, 106, 0.15)', border: '1px solid #00d26a', color: '#00d26a', borderRadius: '4px', padding: '6px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}>🏠 ORIGIN</button>
            <button onClick={handleGlobalLoc} style={{ flex: 1, background: 'rgba(249, 217, 118, 0.15)', border: '1px solid #f9d976', color: '#f9d976', borderRadius: '4px', padding: '6px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}>🌍 LOST</button>
        </div>

        {/* Inputs Manuais */}
        <div style={{ display: 'flex', gap: '5px' }}>
          <input 
            type="number" name="x" placeholder="X" 
            value={poseInput.x} onChange={handleInputChange} 
            style={{ flex:1, width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #444', color: '#fff', borderRadius: '4px', padding: '4px', textAlign: 'center', fontSize: '0.7rem' }} 
          />
          <input 
            type="number" name="y" placeholder="Y" 
            value={poseInput.y} onChange={handleInputChange} 
            style={{ flex:1, width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #444', color: '#fff', borderRadius: '4px', padding: '4px', textAlign: 'center', fontSize: '0.7rem' }} 
          />
          <input 
            type="number" name="yaw" placeholder="Deg" 
            value={poseInput.yaw} onChange={handleInputChange} 
            style={{ flex:1, width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #444', color: '#fff', borderRadius: '4px', padding: '4px', textAlign: 'center', fontSize: '0.7rem' }} 
          />
          <button 
            onClick={handleSetPose}
            style={{ flex: 0.8, background: '#444', border: '1px solid #666', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
          >
            SET
          </button>
        </div>
      </div>

      {/* MAP LAYERS (Sem alterações de lógica, apenas mantendo layout) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
          MAP LAYERS
        </div>
        <button onClick={() => setShowFootprint(!showFootprint)} style={{ background: showFootprint ? 'rgba(0, 210, 106, 0.2)' : 'rgba(255,255,255,0.05)', border: showFootprint ? '1px solid #00d26a' : '1px solid rgba(255,255,255,0.1)', color: showFootprint ? '#fff' : '#aaa', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>
          {showFootprint ? '🟦 FOOTPRINT VISIBLE' : '⬜ FOOTPRINT HIDDEN'}
        </button>
        <div style={{ display: 'flex', gap: '5px' }}>
            {['2D', '3D', 'FREE'].map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{ flex: 1, background: viewMode === mode ? '#00d26a' : 'rgba(255,255,255,0.05)', color: viewMode === mode ? '#000' : '#aaa', border: 'none', borderRadius: '4px', padding: '6px 0', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>{mode}</button>
            ))}
        </div>
      </div>
    </div>
  );
}

NavigationControl.propTypes = {
  ros: PropTypes.object,
  showFootprint: PropTypes.bool,
  setShowFootprint: PropTypes.func,
  viewMode: PropTypes.string,
  setViewMode: PropTypes.func
};