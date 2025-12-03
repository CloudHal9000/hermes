import { useEffect, useState } from 'react';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';
import { Speedometer } from './Speedometer';
import { ModeSwitcher } from './ModeSwitcher';
import { VoltageChart } from './VoltageChart'; // O novo componente turbinado
export function Telemetry({ ros }) {
  // Apenas velocidade aqui (Bateria foi para o VoltageChart)
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
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'flex' }}>
      
      {/* 1. Velocímetro */}
      <div style={{ marginTop: '-10px', marginBottom: '-5px' }}>
         <Speedometer value={velocityKmh} />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #333', width: '100%', margin: 0 }} />

      {/* 2. Switcher de Modo */}
      <ModeSwitcher ros={ros} />

      {/* 3. Energia (Voltagem + Barra de Bateria Juntos) */}
      <VoltageChart ros={ros} />

    </div>
  );
}

Telemetry.propTypes = { ros: PropTypes.object };