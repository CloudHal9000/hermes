import { useEffect, useRef, useState } from 'react';
import nipplejs from 'nipplejs';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';

export function Joystick({ ros }) {
  const joyRef = useRef(null);
  const [currentMode, setCurrentMode] = useState('UNKNOWN');

  // Refs para o loop de envio
  const linearRef = useRef(0);
  const angularRef = useRef(0);
  const intervalRef = useRef(null); 

  const MAX_LIN = 0.6; // m/s
  const MAX_ANG = 1.0; // rad/s
  const TOPIC_NAME = '/hoverboard_base_controller/cmd_vel_raw';

  useEffect(() => {
    if (!ros) return;

    // 1. Ouvir o Modo (Para esconder o joystick se não for MANUAL/MAP)
    const modeListener = new ROSLIB.Topic({
      ros: ros,
      name: '/robot/mode_str',
      messageType: 'std_msgs/String'
    });

    modeListener.subscribe((msg) => {
      setCurrentMode(msg.data.toUpperCase().trim());
    });

    // Se a div não existe (porque estamos ocultos), não inicia o Nipple
    if (!joyRef.current) return () => modeListener.unsubscribe();

    // 2. Iniciar Joystick Visual
    const manager = nipplejs.create({
      zone: joyRef.current,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: '#00d26a',
      size: 120,
      restOpacity: 0.8,
      dynamicPage: true
    });

    const cmdVel = new ROSLIB.Topic({
      ros: ros,
      name: TOPIC_NAME,
      messageType: 'geometry_msgs/TwistStamped'
    });

    // --- AQUI ESTAVA O ERRO ---
    // Removemos 'new ROSLIB.Message'. Usamos objeto simples.
    const sendVelocity = (lx, az) => {
      const twist = {
        header: { 
          frame_id: "base_link", 
          stamp: { sec: 0, nanosec: 0 } 
        },
        twist: {
          linear: { x: lx, y: 0, z: 0 },
          angular: { x: 0, y: 0, z: az }
        }
      };
      // O publish aceita JSON direto!
      cmdVel.publish(twist);
    };

    // Eventos do Joystick
    manager.on('start', () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        sendVelocity(linearRef.current, angularRef.current);
      }, 50);
    });

    manager.on('move', (evt, data) => {
      if (data && data.vector) {
        linearRef.current = data.vector.y * MAX_LIN;
        angularRef.current = -data.vector.x * MAX_ANG;
      }
    });

    manager.on('end', () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      linearRef.current = 0;
      angularRef.current = 0;
      sendVelocity(0, 0);
    });

    return () => {
      manager.destroy();
      modeListener.unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ros, currentMode]);

  // Lógica de Exibição
  const isAllowed = currentMode === 'MANUAL' || currentMode === 'MAPPING';
  
  if (!ros || !isAllowed) return null;

  return (
    <div style={{ 
      position: 'fixed',
      top: '80px',
      right: '20px',
      zIndex: 1000, // Por cima do mapa
      width: '140px', 
      height: '140px', 
      background: 'radial-gradient(circle, rgba(20,20,30,0.8) 0%, rgba(0,0,0,0.6) 70%)',
      borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(2px)'
    }}>
      <div ref={joyRef} style={{ width: '100%', height: '100%', position: 'absolute' }} />
    </div>
  );
}

Joystick.propTypes = { ros: PropTypes.object };