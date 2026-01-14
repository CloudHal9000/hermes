import { useEffect, useRef, useState, useCallback } from 'react';
import nipplejs from 'nipplejs';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';

export function Joystick({ ros }) {
  const joyRef = useRef(null);
  const [currentMode, setCurrentMode] = useState('UNKNOWN');
  const [inputType, setInputType] = useState(null); 

  const linearRef = useRef(0);
  const angularRef = useRef(0);
  const isTouchingRef = useRef(false);
  const keysPressed = useRef({ w: false, s: false, a: false, d: false });
  const intervalRef = useRef(null);

  const activeInputRef = useRef(null);

  const MAX_LIN = 0.6; 
  const MAX_ANG = 1.0; 
  const TOPIC_NAME = '/hoverboard_base_controller/cmd_vel';

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

  const pollGamepad = () => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0]; 
    if (gp) {
      const deadzone = 0.1;
      let rawY = -gp.axes[1]; let rawX = -gp.axes[0]; 
      if (Math.abs(rawY) < deadzone) rawY = 0;
      if (Math.abs(rawX) < deadzone) rawX = 0;
      if (rawY !== 0 || rawX !== 0) return { x: rawX, y: rawY };
    }
    return null;
  };

  const computeVelocity = useCallback(() => {
    let newType = null;
    let lin = 0; 
    let ang = 0;

    if (isTouchingRef.current) {
        newType = 'touch';
        lin = linearRef.current;
        ang = angularRef.current;
    } 

    else {
        const gpInput = pollGamepad();
        if (gpInput) {
            newType = 'gamepad';
            lin = gpInput.y * MAX_LIN;
            ang = gpInput.x * MAX_ANG;
        } 

        else {
            const k = keysPressed.current;
            let kLin = 0, kAng = 0;
            if (k.w) kLin += 1; if (k.s) kLin -= 1;
            if (k.a) kAng += 1; if (k.d) kAng -= 1;

            if (kLin !== 0 || kAng !== 0) {
                newType = 'keyboard';
                lin = kLin * MAX_LIN;
                ang = kAng * MAX_ANG;
            }
        }
    }

    if (newType !== activeInputRef.current) {
        activeInputRef.current = newType;
        setInputType(newType);
    }

    return { lin, ang };
  }, []);

  useEffect(() => {
    if (!ros) return;
    const modeListener = new ROSLIB.Topic({
      ros: ros,
      name: '/robot/mode_str',
      messageType: 'std_msgs/String'
    });
    modeListener.subscribe((msg) => setCurrentMode(msg.data.toUpperCase().trim()));
    return () => modeListener.unsubscribe();
  }, [ros]);

  const isAllowed = currentMode === 'MANUAL' || currentMode === 'MAPPING';

  useEffect(() => {
    if (!ros || !isAllowed || !joyRef.current) return;

    console.log("Criando Joystick Verde...");

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
        header: { frame_id: "base_footprint", stamp: { sec: 0, nanosec: 0 } },
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
      console.log("Limpando Joystick...");
      manager.destroy();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ros, isAllowed, computeVelocity]); 

  if (!ros || !isAllowed) return null;

  let borderColor = 'rgba(255,255,255,0.1)';
  if (inputType === 'gamepad') borderColor = '#00e5ff'; 
  if (inputType === 'keyboard') borderColor = '#f6d365'; 
  if (inputType === 'touch') borderColor = '#00d26a'; 

  return (
    <div style={{ 
      position: 'absolute',
      bottom: '50px',
      right: '110px',
      zIndex: 1000, 
      width: '140px', 
      height: '140px', 
      background: 'radial-gradient(circle, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 70%)',
      borderRadius: '50%',
      border: `2px solid ${borderColor}`,
      backdropFilter: 'blur(2px)',
      pointerEvents: 'auto',
      transition: 'border-color 0.3s'
    }}>
      <div ref={joyRef} style={{ width: '100%', height: '100%', position: 'absolute' }} />
    </div>
  );
}

Joystick.propTypes = { ros: PropTypes.object };
