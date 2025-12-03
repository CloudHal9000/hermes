import { useEffect, useRef, useState } from 'react';
import nipplejs from 'nipplejs';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';

export function Joystick({ ros }) {
  const joyRef = useRef(null);
  const [currentMode, setCurrentMode] = useState('UNKNOWN');
  const [inputType, setInputType] = useState(null); 

  // Refs de controle
  const linearRef = useRef(0);
  const angularRef = useRef(0);
  const isTouchingRef = useRef(false);
  const keysPressed = useRef({ w: false, s: false, a: false, d: false });
  const intervalRef = useRef(null); 

  const MAX_LIN = 0.6; 
  const MAX_ANG = 1.0; 
  const TOPIC_NAME = '/hoverboard_base_controller/cmd_vel_raw';

  // --- 1. LÓGICA DE TECLADO ---
  useEffect(() => {
    const handleKey = (e, isDown) => {
      const k = e.key.toLowerCase();
      if (['w', 'arrowup'].includes(k)) keysPressed.current.w = isDown;
      if (['s', 'arrowdown'].includes(k)) keysPressed.current.s = isDown;
      if (['a', 'arrowleft'].includes(k)) keysPressed.current.a = isDown;
      if (['d', 'arrowright'].includes(k)) keysPressed.current.d = isDown;
    };
    const onDown = (e) => handleKey(e, true);
    const onUp = (e) => handleKey(e, false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // --- 2. LÓGICA DE GAMEPAD ---
  const pollGamepad = () => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0]; 
    if (gp) {
      const deadzone = 0.1;
      let rawY = -gp.axes[1]; 
      let rawX = -gp.axes[0]; 
      if (Math.abs(rawY) < deadzone) rawY = 0;
      if (Math.abs(rawX) < deadzone) rawX = 0;
      if (rawY !== 0 || rawX !== 0) return { x: rawX, y: rawY };
    }
    return null;
  };

  // --- 3. LOOP UNIFICADO ---
  useEffect(() => {
    if (!ros) return;

    const computeVelocity = () => {
      if (isTouchingRef.current) {
          if (inputType !== 'touch') setInputType('touch');
          return { lin: linearRef.current, ang: angularRef.current };
      }
      const gpInput = pollGamepad();
      if (gpInput) {
          if (inputType !== 'gamepad') setInputType('gamepad');
          return { lin: gpInput.y * MAX_LIN, ang: gpInput.x * MAX_ANG };
      }
      const k = keysPressed.current;
      let kLin = 0, kAng = 0;
      if (k.w) kLin += 1; if (k.s) kLin -= 1;
      if (k.a) kAng += 1; if (k.d) kAng -= 1;
      if (kLin !== 0 || kAng !== 0) {
          if (inputType !== 'keyboard') setInputType('keyboard');
          return { lin: kLin * MAX_LIN, ang: kAng * MAX_ANG };
      }
      if (inputType !== null) setInputType(null);
      return { lin: 0, ang: 0 };
    };

    const modeListener = new ROSLIB.Topic({
      ros: ros,
      name: '/robot/mode_str',
      messageType: 'std_msgs/String'
    });
    modeListener.subscribe((msg) => setCurrentMode(msg.data.toUpperCase().trim()));
    if (!joyRef.current) return () => modeListener.unsubscribe();

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

    const sendVelocity = (lx, az) => {
      cmdVel.publish({
        header: { frame_id: "base_link", stamp: { sec: 0, nanosec: 0 } },
        twist: { linear: { x: lx, y: 0, z: 0 }, angular: { x: 0, y: 0, z: az } }
      });
    };

    manager.on('start', () => { isTouchingRef.current = true; });
    manager.on('move', (evt, data) => {
      if (data?.vector) {
        linearRef.current = data.vector.y * MAX_LIN;
        angularRef.current = -data.vector.x * MAX_ANG;
      }
    });
    manager.on('end', () => { isTouchingRef.current = false; });

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const { lin, ang } = computeVelocity();
      sendVelocity(lin, ang);
    }, 50);

    return () => {
      manager.destroy();
      modeListener.unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ros, currentMode, inputType]);

  const isAllowed = currentMode === 'MANUAL' || currentMode === 'MAPPING';
  if (!ros || !isAllowed) return null;

  let borderColor = 'rgba(255,255,255,0.1)';
  let glowColor = 'rgba(20,20,30,0.8)';
  if (inputType === 'gamepad') { borderColor = '#00e5ff'; glowColor = 'rgba(0, 229, 255, 0.2)'; }
  else if (inputType === 'keyboard') { borderColor = '#f6d365'; glowColor = 'rgba(246, 211, 101, 0.2)'; }
  else if (inputType === 'touch') { borderColor = '#00d26a'; }

  return (
    <div style={{ 
      position: 'absolute',
      // --- AJUSTE DE POSIÇÃO ---
      bottom: '150px', // Mais alto que antes (era 30px)
      right: '110px', // Cálculo exato para centralizar com o painel de 320px
      
      zIndex: 1000, 
      width: '180px', 
      height: '180px', 
      background: `radial-gradient(circle, ${glowColor} 0%, rgba(0,0,0,0.6) 70%)`,
      borderRadius: '50%',
      border: `2px solid ${borderColor}`,
      backdropFilter: 'blur(2px)',
      transition: 'all 0.3s'
    }}>
      {inputType === 'gamepad' && <div style={{position:'absolute', top:-20, width:'100%', textAlign:'center', fontSize:'0.6rem', color:borderColor}}>GAMEPAD</div>}
      {inputType === 'keyboard' && <div style={{position:'absolute', top:-20, width:'100%', textAlign:'center', fontSize:'0.6rem', color:borderColor}}>KEYBOARD</div>}
      
      <div ref={joyRef} style={{ width: '100%', height: '100%', position: 'absolute' }} />
    </div>
  );
}

Joystick.propTypes = { ros: PropTypes.object };