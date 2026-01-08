import { useEffect, useState, useRef } from 'react';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';
import { useNotification } from '../context/NotificationContext';

export function DashboardPanel({ ros, robotName, robot }) { 
  const [velocityKmh, setVelocityKmh] = useState(0.0);
  const [currentMode, setCurrentMode] = useState('UNKNOWN');
  const [batteryPercentage, setBatteryPercentage] = useState(null);
  const { addNotification } = useNotification();

  const odomListenerRef = useRef(null);
  const batListenerRef = useRef(null);
  const modeListenerRef = useRef(null);
  const lastModeRef = useRef(null);

  // --- LÓGICA DE ALERTA ---
  const getPanelAlertState = () => {
    if (robot && !robot.online) return { isCritical: true, label: 'OFF', color: '#ff4b5c' };
    
    const isLowBatAPI = robot?.battery_level !== undefined && robot?.battery_level !== null && robot.battery_level < 20;
    const isLowBatROS = batteryPercentage !== null && batteryPercentage < 20;
    if (isLowBatAPI || isLowBatROS) return { isCritical: true, label: 'LOW BAT', color: '#ff9f43' };
    
    if (robot?.status === 'BLOCKED') return { isCritical: true, label: 'BLOCKED', color: '#ff9f43' };
    
    return { isCritical: false, label: null, color: null };
  };

  const alertState = getPanelAlertState();

  // --- SUBSCRIPTIONS ---
  useEffect(() => {
    if (!ros) return;
    if (odomListenerRef.current) odomListenerRef.current.unsubscribe();
    const odomListener = new ROSLIB.Topic({ ros: ros, name: '/hoverboard_base_controller/odom', messageType: 'nav_msgs/Odometry' });
    odomListener.subscribe((msg) => {
      const linearMs = msg.twist.twist.linear.x;
      setVelocityKmh(Math.abs(linearMs * 3.6));
    });
    odomListenerRef.current = odomListener;
    return () => { if (odomListenerRef.current) odomListenerRef.current.unsubscribe(); };
  }, [ros]);

  useEffect(() => {
    if (!ros) return;
    if (batListenerRef.current) batListenerRef.current.unsubscribe();
    const batListener = new ROSLIB.Topic({ ros: ros, name: '/battery_state', messageType: 'sensor_msgs/BatteryState' });
    batListener.subscribe((msg) => { setBatteryPercentage(Math.round(msg.percentage * 100)); });
    batListenerRef.current = batListener;
    return () => { if (batListenerRef.current) batListenerRef.current.unsubscribe(); };
  }, [ros]);

  useEffect(() => {
    if (!ros) return;
    if (modeListenerRef.current) modeListenerRef.current.unsubscribe();
    const modeListener = new ROSLIB.Topic({ ros: ros, name: '/robot/mode_str', messageType: 'std_msgs/String' });
    modeListener.subscribe((msg) => {
      const newMode = msg.data.toUpperCase();
      if (lastModeRef.current !== newMode) {
        addNotification(`🔄 Modo alterado para ${newMode}`);
        lastModeRef.current = newMode;
      }
      setCurrentMode(newMode);
    });
    modeListenerRef.current = modeListener;
    return () => { if (modeListenerRef.current) modeListenerRef.current.unsubscribe(); };
  }, [ros, addNotification]);

  const cycleMode = () => {
    if (alertState.isCritical && alertState.label === 'OFF') return;
    let nextModeId = 0;
    if (currentMode === 'MANUAL') nextModeId = 1;
    else if (currentMode === 'AUTONOMOUS') nextModeId = 2;
    else if (currentMode === 'MAPPING') nextModeId = 0;
    const service = new ROSLIB.Service({ ros: ros, name: '/robot/set_mode', serviceType: 'freebotics_msgs/SetMode' });
    const request = { mode: nextModeId };
    service.callService(request, () => addNotification(`✅ Modo alterado`), () => addNotification(`❌ Erro ao alterar`));
  };

  // --- ESTILOS ---
  const getButtonStyle = () => {
    if (alertState.isCritical) return { color: alertState.color, borderColor: alertState.color, background: `${alertState.color}26` };
    switch (currentMode) {
      case 'AUTONOMOUS': return { color: '#f6d365', borderColor: '#f6d365', background: 'rgba(246, 211, 101, 0.15)' };
      case 'MANUAL': return { color: '#00d26a', borderColor: '#00d26a', background: 'rgba(0, 210, 106, 0.15)' };
      case 'MAPPING': return { color: '#00e5ff', borderColor: '#00e5ff', background: 'rgba(0, 229, 255, 0.15)' };
      default: return { color: '#ccc', borderColor: '#ccc', background: 'rgba(255, 255, 255, 0.1)' };
    }
  };

  const btnStyle = getButtonStyle();
  // Fonte reduzida e condensada para os valores
  const valueStyle = { fontFamily: 'monospace', fontWeight: 'bold', lineHeight: '1', color: '#ffffff', fontSize: '0.8rem' };

  return (
    <div style={{
      background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)',
      border: alertState.isCritical ? '1px solid #ff4b5c' : '1px solid rgba(255,255,255,0.08)',
      boxShadow: alertState.isCritical ? '0 0 15px rgba(255, 75, 92, 0.2)' : 'none',
      animation: alertState.isCritical ? 'pulse-red 2s infinite' : 'none',
      borderRadius: '8px', 
      padding: '6px 10px', 
      display: 'flex', 
      flexDirection: 'row', 
      alignItems: 'center',
      justifyContent: 'space-between', 
      width: '100%', 
      boxSizing: 'border-box', 
      overflow: 'hidden',
      height: '52px' // Altura fixa levemente maior para caber as 2 linhas
    }}>
      <style>{`@keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(255, 75, 92, 0.7); border-color: rgba(255, 75, 92, 1); } 70% { box-shadow: 0 0 0 10px rgba(255, 75, 92, 0); border-color: rgba(255, 75, 92, 0.5); } 100% { box-shadow: 0 0 0 0 rgba(255, 75, 92, 0); border-color: rgba(255, 75, 92, 1); } }`}</style>

      {/* --- COLUNA ESQUERDA: NOME (EM CIMA) + DADOS (EMBAIXO) --- */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center',
        gap: '4px', // Espaço entre nome e dados
        flex: '1',
        marginRight: '10px'
      }}>
        
        {/* NOME (Reduzido, em cima) */}
        <span style={{ 
          color: '#ffffff', fontWeight: 'bold', fontSize: '0.75rem', 
          letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textTransform: 'uppercase', opacity: 0.9
        }}>
          {robotName || 'BOT'}
        </span>

        {/* DADOS (Speed | Bat) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          <span style={valueStyle}>
            {velocityKmh.toFixed(1)}<span style={{fontSize: '0.7em', opacity: 0.6, fontWeight: 'normal', marginLeft:'1px'}}>km</span>
          </span>

          <div style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.2)' }}></div>

          <span style={valueStyle}>
            {batteryPercentage !== null ? batteryPercentage : '--'}<span style={{fontSize: '0.7em', opacity: 0.6, fontWeight: 'normal', marginLeft:'1px'}}>%</span>
          </span>

        </div>
      </div>

      {/* --- COLUNA DIREITA: BOTÃO --- */}
      <button 
        onClick={cycleMode} 
        style={{ 
          display: 'flex', justifyContent: 'center', alignItems: 'center', 
          background: btnStyle.background, 
          border: `1px solid ${btnStyle.borderColor}`, 
          color: btnStyle.color,
          borderRadius: '6px', 
          padding: '0 10px', // Padding lateral interno
          height: '36px',    // Altura fixa para alinhar com o bloco da esquerda
          cursor: alertState.isCritical ? 'not-allowed' : 'pointer', 
          fontWeight: 'bold', fontSize: '0.75rem', 
          transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '1px',
          minWidth: '85px', 
          flexShrink: 0 
        }} 
        onMouseEnter={(e) => { if(!alertState.isCritical) e.target.style.opacity = '0.8'; }} 
        onMouseLeave={(e) => { if(!alertState.isCritical) e.target.style.opacity = '1'; }}
      >
        {alertState.isCritical ? (
          <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}>⚠️ {alertState.label}</span>
        ) : currentMode}
      </button>

    </div>
  );
}

DashboardPanel.propTypes = {
  ros: PropTypes.object,
  robotName: PropTypes.string,
  robot: PropTypes.object
};