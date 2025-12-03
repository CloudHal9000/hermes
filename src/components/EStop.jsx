import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';

export function EStop({ ros }) {
  
  const handleStop = () => {
    if (!ros) return;

    const cmdVel = new ROSLIB.Topic({
      ros: ros,
      name: '/hoverboard_base_controller/cmd_vel_raw',
      messageType: 'geometry_msgs/TwistStamped'
    });

    // Envia 5 mensagens seguidas de PARADA TOTAL para garantir
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const stopMsg = {
                header: { frame_id: "base_link", stamp: { sec: 0, nanosec: 0 } },
                twist: { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } }
            };
            cmdVel.publish(stopMsg);
        }, i * 50);
    }
    console.warn("🛑 EMERGÊNCIA ACIONADA!");
  };

  return (
    <button 
      onClick={handleStop}
      style={{
        background: '#ff4b5c',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        padding: '15px',
        fontWeight: 'bold',
        fontSize: '1rem',
        cursor: 'pointer',
        boxShadow: '0 4px 10px rgba(255, 75, 92, 0.4)',
        width: '100%',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        transition: 'all 0.1s'
      }}
      onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
      onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
    >
      STOP 🛑
    </button>
  );
}

EStop.propTypes = { ros: PropTypes.object };