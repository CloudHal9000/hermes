import { useEffect, useState, useRef } from 'react';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';
import { useNotification } from '../context/NotificationContext';

export function DashboardPanel({ ros, robotName }) {
  const [velocityKmh, setVelocityKmh] = useState(0.0);
  const [currentMode, setCurrentMode] = useState('UNKNOWN');
  const [batteryPercentage, setBatteryPercentage] = useState(null);
  const { addNotification } = useNotification();

  // Refs para gerenciar subscriptions
  const odomListenerRef = useRef(null);
  const batListenerRef = useRef(null);
  const modeListenerRef = useRef(null);
  const lastModeRef = useRef(null);
  const subscriptionsInitializedRef = useRef(false);

  const MODES = {
    MANUAL: { id: 0, label: 'MANUAL', color: '#00d26a' },
    AUTONOMOUS: { id: 1, label: 'AUTO', color: '#f6d365' },
    MAPPING: { id: 2, label: 'MAP', color: '#00e5ff' }
  };

  // --- SUBSCREVER À VELOCIDADE ---
  useEffect(() => {
    if (!ros || subscriptionsInitializedRef.current) return;

    if (odomListenerRef.current) {
      odomListenerRef.current.unsubscribe();
    }

    const odomListener = new ROSLIB.Topic({
      ros: ros,
      name: '/hoverboard_base_controller/odom',
      messageType: 'nav_msgs/Odometry'
    });
    
    odomListener.subscribe((msg) => {
      const linearMs = msg.twist.twist.linear.x;
      setVelocityKmh(Math.abs(linearMs * 3.6));
    });
    
    odomListenerRef.current = odomListener;
  }, [ros]);

  // --- SUBSCREVER À BATERIA ---
  useEffect(() => {
    if (!ros || subscriptionsInitializedRef.current) return;

    if (batListenerRef.current) {
      batListenerRef.current.unsubscribe();
    }

    const batListener = new ROSLIB.Topic({
      ros: ros,
      name: '/battery_state',
      messageType: 'sensor_msgs/BatteryState'
    });
    
    batListener.subscribe((msg) => {
      setBatteryPercentage(Math.round(msg.percentage * 100));
    });
    
    batListenerRef.current = batListener;
  }, [ros]);

  // --- SUBSCREVER AO MODO ---
  useEffect(() => {
    if (!ros) return;

    if (modeListenerRef.current) {
      modeListenerRef.current.unsubscribe();
    }

    const modeListener = new ROSLIB.Topic({
      ros: ros,
      name: '/robot/mode_str',
      messageType: 'std_msgs/String'
    });
    
    modeListener.subscribe((msg) => {
      const newMode = msg.data.toUpperCase();
      
      // Mostra notificação apenas se o modo realmente mudou
      if (lastModeRef.current !== newMode) {
        addNotification(`🔄 Modo alterado para ${newMode}`);
        lastModeRef.current = newMode;
      }
      
      setCurrentMode(newMode);
    });
    
    modeListenerRef.current = modeListener;

    // Marcar que subscrições foram inicializadas
    subscriptionsInitializedRef.current = true;

    // Cleanup
    return () => {
      if (odomListenerRef.current) odomListenerRef.current.unsubscribe();
      if (batListenerRef.current) batListenerRef.current.unsubscribe();
      if (modeListenerRef.current) modeListenerRef.current.unsubscribe();
    };
  }, [ros, addNotification]);

  // --- FUNÇÃO PARA MUDAR MODO (CICLA) ---
  const cycleMode = () => {
    let nextModeId = 0;
    if (currentMode === 'MANUAL') nextModeId = 1;
    else if (currentMode === 'AUTONOMOUS') nextModeId = 2;
    else if (currentMode === 'MAPPING') nextModeId = 0;

    const service = new ROSLIB.Service({
      ros: ros,
      name: '/robot/set_mode',
      serviceType: 'freebotics_msgs/SetMode'
    });

    const request = { mode: nextModeId };
    service.callService(request,
      () => addNotification(`✅ Modo alterado com sucesso`),
      () => addNotification(`❌ Erro ao alterar modo`)
    );
  };

  // --- FUNÇÃO PARA OBTER COR DA VELOCIDADE ---
  const getSpeedColor = (speed) => {
    if (speed < 0.5) return '#00d26a';
    if (speed < 1.0) return '#f6d365';
    return '#ff4b5c';
  };

  // --- FUNÇÃO PARA OBTER COR DA BATERIA ---
  const getBatteryColor = (pct) => {
    if (pct === null) return '#666';
    if (pct < 20) return '#ff4b5c';
    if (pct < 40) return '#f6d365';
    return '#00d26a';
  };

  // --- FUNÇÃO PARA OBTER COR DO MODO ---
  const getModeColor = () => {
    if (currentMode === 'MANUAL') return MODES.MANUAL.color;
    if (currentMode === 'AUTONOMOUS') return MODES.AUTONOMOUS.color;
    if (currentMode === 'MAPPING') return MODES.MAPPING.color;
    return '#666';
  };

  return (
    <div style={{
      background: 'rgba(19, 21, 31, 0.85)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '5px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>

      {/* --- NOME DO ROBÔ --- */}
      <div style={{ 
        fontSize: '1.1rem', 
        fontWeight: 'bold', 
        textAlign: 'center',
        color: '#00d26a',
        letterSpacing: '1px'
      }}>
        {robotName || 'ROBÔ'}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: 0, marginBottom: '10px' }} />

      {/* --- VELOCIDADE --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ fontSize: '0.75rem', opacity: 0.6, letterSpacing: '1px', textTransform: 'uppercase' }}>
          Speed (km/h)
        </div>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: getSpeedColor(velocityKmh),
          fontFamily: 'monospace',
          textAlign: 'center',
          transition: 'color 0.3s ease'
        }}>
          {velocityKmh.toFixed(1)}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: 0 }} />

      {/* --- MODO (BOTÃO ÚNICO) --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ fontSize: '0.75rem', opacity: 0.6, letterSpacing: '1px', textTransform: 'uppercase' }}>
          Operation Mode
        </div>
        <button
          onClick={cycleMode}
          style={{
            background: getModeColor(),
            border: 'none',
            borderRadius: '8px',
            padding: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '1rem',
            color: '#111',
            transition: 'all 0.3s ease',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.8'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          {currentMode}
        </button>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: 0 }} />

      {/* --- BATERIA --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.75rem', opacity: 0.6, letterSpacing: '1px', textTransform: 'uppercase' }}>
          Battery Charge
        </div>
        <div style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          color: getBatteryColor(batteryPercentage),
          fontFamily: 'monospace',
          textAlign: 'center',
          transition: 'color 0.3s ease'
        }}>
          {batteryPercentage !== null ? `${batteryPercentage}%` : '--'}
        </div>
      </div>

    </div>
  );
}

DashboardPanel.propTypes = {
  ros: PropTypes.object,
  robotName: PropTypes.string
};
