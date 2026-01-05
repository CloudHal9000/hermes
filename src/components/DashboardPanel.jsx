import { useEffect, useState, useRef } from 'react';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';
import { useNotification } from '../context/NotificationContext';

export function DashboardPanel({ ros, robotName, robotIp }) {
  const [velocityKmh, setVelocityKmh] = useState(0.0);
  const [currentMode, setCurrentMode] = useState('UNKNOWN');
  const [batteryPercentage, setBatteryPercentage] = useState(null);
  const { addNotification } = useNotification();

  // Refs para armazenar os listeners e limpar depois
  const odomListenerRef = useRef(null);
  const batListenerRef = useRef(null);
  const modeListenerRef = useRef(null);
  const lastModeRef = useRef(null);

  const MODES = {
    MANUAL: { id: 0, label: 'MANUAL', color: '#00d26a' },
    AUTONOMOUS: { id: 1, label: 'AUTO', color: '#f6d365' },
    MAPPING: { id: 2, label: 'MAP', color: '#00e5ff' }
  };

  // --- SUBSCREVER À VELOCIDADE ---
  useEffect(() => {
    if (!ros) return;

    if (odomListenerRef.current) odomListenerRef.current.unsubscribe();

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

    return () => {
      if (odomListenerRef.current) odomListenerRef.current.unsubscribe();
    };
  }, [ros]);

  // --- SUBSCREVER À BATERIA ---
  useEffect(() => {
    if (!ros) return;

    if (batListenerRef.current) batListenerRef.current.unsubscribe();

    const batListener = new ROSLIB.Topic({
      ros: ros,
      name: '/battery_state',
      messageType: 'sensor_msgs/BatteryState'
    });
    
    batListener.subscribe((msg) => {
      setBatteryPercentage(Math.round(msg.percentage * 100));
    });
    
    batListenerRef.current = batListener;

    return () => {
      if (batListenerRef.current) batListenerRef.current.unsubscribe();
    };
  }, [ros]);

  // --- SUBSCREVER AO MODO ---
  useEffect(() => {
    if (!ros) return;

    if (modeListenerRef.current) modeListenerRef.current.unsubscribe();

    const modeListener = new ROSLIB.Topic({
      ros: ros,
      name: '/robot/mode_str',
      messageType: 'std_msgs/String'
    });
    
    modeListener.subscribe((msg) => {
      const newMode = msg.data.toUpperCase();
      
      if (lastModeRef.current !== newMode) {
        addNotification(`🔄 Modo alterado para ${newMode}`);
        lastModeRef.current = newMode;
      }
      
      setCurrentMode(newMode);
    });
    
    modeListenerRef.current = modeListener;

    return () => {
      if (modeListenerRef.current) modeListenerRef.current.unsubscribe();
    };
  }, [ros, addNotification]);

  // --- FUNÇÕES DE CONTROLE ---
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

  const getSpeedColor = (speed) => {
    if (speed < 0.5) return '#00d26a';
    if (speed < 1.0) return '#f6d365';
    return '#ff4b5c';
  };

  const getBatteryColor = (pct) => {
    if (pct === null) return '#666';
    if (pct < 20) return '#ff4b5c';
    if (pct < 40) return '#f6d365';
    return '#00d26a';
  };

  const getModeColor = () => {
    if (currentMode === 'MANUAL') return MODES.MANUAL.color;
    if (currentMode === 'AUTONOMOUS') return MODES.AUTONOMOUS.color;
    if (currentMode === 'MAPPING') return MODES.MAPPING.color;
    return '#666';
  };

  // --- ESTILOS ---
  const labelStyle = {
    fontSize: '0.65rem',
    color: '#ffffffff',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '2px',
    textAlign: 'center'
  };

  const valueStyle = {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: '1'
  };

  return (
    <div style={{
      background: 'rgba(19, 21, 31, 0.85)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',             // Ocupa 100% do pai
      boxSizing: 'border-box',   // Padding fica DENTRO dos 100%
      overflow: 'hidden'         // Garante que nada vaze
    }}>

      {/* --- CAIXINHA UNIFICADA --- */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '8px 8px', // Reduzi levemente o padding lateral
        width: '100%',
        boxSizing: 'border-box'
      }}>

        {/* COLUNA 1: NOME + IP */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '60px' }}>
          <span style={{ 
            color: '#00d26a',
            fontWeight: 'bold', 
            fontSize: '0.95rem', // Ajuste fino para não estourar nomes longos
            letterSpacing: '0.5px',
            lineHeight: '1.2',
            whiteSpace: 'nowrap'
          }}>
            {robotName || 'BOT'}
          </span>
          <span style={{ 
            fontSize: '0.7rem', 
            color: 'rgba(255, 255, 255, 1)', 
            fontFamily: 'monospace',
            marginTop: '2px'
          }}>
            {robotIp || '0.0.0.0'}
          </span>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 6px' }}></div>

        {/* COLUNA 2: VELOCIDADE */}
        <div style={{ display: 'flex', flexDirection: 'column', color: '#ffffff', alignItems: 'center' }}>
          <span style={labelStyle}>Speed</span>
          <span style={{ 
            ...valueStyle, 
            color: getSpeedColor(velocityKmh), 
            fontSize: '1rem' 
          }}>
            {velocityKmh.toFixed(1)} <span style={{fontSize: '0.7em', opacity: 0.7}}>km/h</span>
          </span>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 6px' }}></div>

        {/* COLUNA 3: BATERIA */}
        <div style={{ display: 'flex', flexDirection: 'column', color: '#ffffff', alignItems: 'center' }}>
          <span style={labelStyle}>Battery</span>
          <span style={{ 
            ...valueStyle, 
            color: getBatteryColor(batteryPercentage), 
            fontSize: '1rem' 
          }}>
            {batteryPercentage !== null ? batteryPercentage : '--'}
            <span style={{fontSize: '0.7em', opacity: 0.7}}>%</span>
          </span>
        </div>

      </div>

      {/* --- MODO DE OPERAÇÃO --- */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '0.7rem', color: '#ffffff', textAlign: 'center', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
          Operation Mode
        </div>
        <button
          onClick={cycleMode}
          style={{
            background: getModeColor(),
            border: 'none',
            borderRadius: '6px',
            padding: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.9rem',
            color: '#111',
            transition: 'all 0.3s ease',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            width: '100%' // Garante que o botão ocupe a largura total
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.9'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          {currentMode}
        </button>
      </div>

    </div>
  );
}

DashboardPanel.propTypes = {
  ros: PropTypes.object,
  robotName: PropTypes.string,
  robotIp: PropTypes.string
};