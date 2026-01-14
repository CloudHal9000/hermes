import { useEffect, useState, useRef } from 'react';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';
import { useNotification } from '../context/NotificationContext';

export function DashboardPanel({ ros, robotName, robot }) { 
  const [isOpen, setIsOpen] = useState(false);
  const [velocityKmh, setVelocityKmh] = useState(0.0);
  const [currentMode, setCurrentMode] = useState('UNKNOWN');
  const [batteryPercentage, setBatteryPercentage] = useState(null);
  const { addNotification } = useNotification();

  const odomListenerRef = useRef(null);
  const batListenerRef = useRef(null);
  const modeListenerRef = useRef(null);
  const lastModeRef = useRef(null);

  const getPanelAlertState = () => {
    if (robot && !robot.online) return { isCritical: true, label: 'OFF', color: '#ff4b5c' };
    const isLowBat = (robot?.battery_level !== undefined && robot.battery_level < 20) || (batteryPercentage !== null && batteryPercentage < 20);
    if (isLowBat) return { isCritical: true, label: 'LOW BAT', color: '#ff9f43' };
    if (robot?.status === 'BLOCKED') return { isCritical: true, label: 'BLOCKED', color: '#ff9f43' };
    return { isCritical: false, label: null, color: null };
  };

  const alertState = getPanelAlertState();

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

  const cycleMode = (e) => {
    e.stopPropagation();
    if (alertState.isCritical && alertState.label === 'OFF') return;
    let nextModeId = 0;
    if (currentMode === 'MANUAL') nextModeId = 1;
    else if (currentMode === 'AUTONOMOUS') nextModeId = 2;
    else if (currentMode === 'MAPPING') nextModeId = 0;
    const service = new ROSLIB.Service({ ros: ros, name: '/robot/set_mode', serviceType: 'freebotics_msgs/SetMode' });
    const request = { mode: nextModeId };
    service.callService(request, () => addNotification(`✅ Modo alterado`), () => addNotification(`❌ Erro ao alterar`));
  };

  const getButtonColor = () => {
    if (alertState.isCritical) return alertState.color;
    switch (currentMode) {
      case 'AUTONOMOUS': return '#f6d365';
      case 'MANUAL': return '#00d26a';
      case 'MAPPING': return '#00e5ff';
      default: return '#ccc';
    }
  };

  const mainColor = alertState.isCritical ? alertState.color : '#00d26a';
  const btnColor = getButtonColor();

  const infoLabelStyle = { fontSize: '0.6rem', color: '#888', fontWeight: 'bold', marginRight: '4px' };
  const infoValueStyle = { fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' };

  return (
    <div 
      onClick={() => setIsOpen(!isOpen)}
      style={{
        position: 'fixed',
        top: '0',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,

        background: 'rgba(19, 21, 31, 0.95)',
        backdropFilter: 'blur(12px)',
        borderLeft: `1px solid ${mainColor}`,
        borderRight: `1px solid ${mainColor}`,
        borderBottom: `1px solid ${mainColor}`,
        borderTop: 'none',

        boxShadow: `0 4px 20px ${mainColor}40`,
        borderRadius: '0 0 16px 16px',

        width: '420px', 
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    }}>

      {}
      <div style={{ 
        width: '100%', padding: '12px 20px', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: isOpen ? '1px solid rgba(255,255,255,0.1)' : 'none'
      }}>

        {}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: mainColor, boxShadow: `0 0 10px ${mainColor}` }}></div>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {robotName || 'SELECT ROBOT'}
          </span>
        </div>

        {}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>

            {}
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={infoValueStyle}><span style={{fontSize: '0.7em', color:'#aaa', fontWeight:'normal'}}>SPEED:</span> 
                    {velocityKmh.toFixed(1)} <span style={{fontSize: '0.7em', color:'#aaa', fontWeight:'normal'}}>km/h</span>
                </span>
            </div>

            {}
            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }}></div>

            {}
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={infoValueStyle}><span style={{fontSize: '0.7em', color:'#aaa', fontWeight:'normal'}}>BATTERY:</span> 
                    {batteryPercentage !== null ? batteryPercentage : '--'} <span style={{fontSize: '0.7em', color:'#aaa', fontWeight:'normal'}}>%</span>
                </span>
            </div>

            {}
            <div style={{ 
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
              transition: 'transform 0.3s',
              color: '#aaa', fontSize: '0.8rem', marginLeft: '5px'
            }}>
              ▼
            </div>
        </div>
      </div>

      {}
      <div style={{ 
        height: isOpen ? '60px' : '0px', 
        opacity: isOpen ? 1 : 0,
        width: '100%',
        transition: 'all 0.3s ease',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: isOpen ? '0 20px 15px 20px' : '0 20px',
        pointerEvents: isOpen ? 'auto' : 'none'
      }}>

        <button 
          onClick={cycleMode}
          style={{
            width: '100%', padding: '10px', borderRadius: '8px',
            background: `${btnColor}20`,
            border: `1px solid ${btnColor}`,
            color: btnColor,
            fontWeight: 'bold', fontSize: '0.95rem', letterSpacing: '2px', textTransform: 'uppercase',
            cursor: alertState.isCritical ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: `0 2px 10px ${btnColor}20`
          }}
        >
          {alertState.isCritical ? `⚠️ ${alertState.label}` : currentMode}
        </button>

      </div>
    </div>
  );
}

DashboardPanel.propTypes = {
  ros: PropTypes.object,
  robotName: PropTypes.string,
  robot: PropTypes.object
};
