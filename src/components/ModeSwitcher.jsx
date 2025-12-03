import { useEffect, useState } from 'react';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';

export function ModeSwitcher({ ros }) {
  const [currentMode, setCurrentMode] = useState('UNKNOWN');

  const MODES = {
    MANUAL: { id: 0, label: 'MANUAL', color: '#00d26a' },
    AUTONOMOUS: { id: 1, label: 'AUTO', color: '#f6d365' },
    MAPPING: { id: 2, label: 'MAP', color: '#00e5ff' }
  };

  useEffect(() => {
    if (!ros) return;
    const modeListener = new ROSLIB.Topic({
      ros: ros,
      name: '/robot/mode_str',
      messageType: 'std_msgs/String'
    });
    modeListener.subscribe((msg) => {
      setCurrentMode(msg.data.toUpperCase());
    });
    return () => modeListener.unsubscribe();
  }, [ros]);

  const setMode = (modeId) => {
    const service = new ROSLIB.Service({
      ros: ros,
      name: '/robot/set_mode',
      serviceType: 'freebotics_msgs/SetMode'
    });

    // --- CORREÇÃO AQUI ---
    // Não use 'new ROSLIB.ServiceRequest'. Use JSON direto.
    const request = { mode: modeId };

    service.callService(request, (res) => {
      console.log('Modo alterado:', res);
    }, (err) => {
      console.error('Erro ao trocar modo:', err);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>OPERATION MODE</div>
      <div style={{ display: 'flex', background: '#161822', borderRadius: '8px', padding: '4px', gap: '4px', border: '1px solid #333' }}>
        <ModeButton active={currentMode === 'MANUAL'} config={MODES.MANUAL} onClick={() => setMode(0)} />
        <ModeButton active={currentMode === 'AUTONOMOUS'} config={MODES.AUTONOMOUS} onClick={() => setMode(1)} />
        <ModeButton active={currentMode === 'MAPPING'} config={MODES.MAPPING} onClick={() => setMode(2)} />
      </div>
    </div>
  );
}

function ModeButton({ active, config, onClick }) {
  return (
    <button onClick={onClick} style={{
        flex: 1, border: 'none', borderRadius: '6px', padding: '8px 0', cursor: 'pointer',
        fontWeight: 'bold', fontSize: '0.8rem',
        color: active ? '#111' : '#888',
        background: active ? config.color : 'transparent',
        transition: 'all 0.2s'
    }}>
      {config.label}
    </button>
  );
}

ModeSwitcher.propTypes = { ros: PropTypes.object };
ModeButton.propTypes = { active: PropTypes.bool, config: PropTypes.object, onClick: PropTypes.func };