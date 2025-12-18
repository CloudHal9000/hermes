import { useEffect, useState } from 'react';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';
import { VoltageChart } from './VoltageChart';
import { Speedometer } from './Speedometer';
import { ModeSwitcher } from './ModeSwitcher';

export function Telemetry({ ros }) {
  const [velocityKmh, setVelocityKmh] = useState(0.0);

  useEffect(() => {
    if (!ros) return;
    const odomListener = new ROSLIB.Topic({
      ros: ros,
      name: '/hoverboard_base_controller/odom',
      messageType: 'nav_msgs/Odometry'
    });
    odomListener.subscribe((msg) => {
      const linearMs = msg.twist.twist.linear.x;
      setVelocityKmh(Math.abs(linearMs * 3.6));
    });
    return () => odomListener.unsubscribe();
  }, [ros]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      
      {/* Velocímetro */}
      <div style={{ marginTop: '-10px', marginBottom: '-5px' }}>
          <Speedometer value={velocityKmh} />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', width: '100%', margin: 0 }} />

      {/* Mode Switcher */}
      <div style={{ 
            background: 'rgba(255,255,255,0.03)', 
            borderRadius: '12px', padding: '12px', 
            border: '1px solid rgba(255,255,255,0.08)' 
        }}>
           <ModeSwitcher ros={ros} />
      </div>

      {/* Bateria */}
      <VoltageChart ros={ros} />

    </div>
  );
}

Telemetry.propTypes = {
  ros: PropTypes.object
};