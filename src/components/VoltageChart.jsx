import { useEffect, useState } from 'react';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';

export function VoltageChart({ ros }) {
  const [voltage, setVoltage] = useState(null);
  const [percentage, setPercentage] = useState(null);

  useEffect(() => {
    if (!ros) return;

    // 1. Assina a Voltagem (Número Preciso)
    const voltListener = new ROSLIB.Topic({
      ros: ros,
      name: '/battery_voltage', 
      messageType: 'std_msgs/Float32'
    });

    voltListener.subscribe((msg) => {
      setVoltage(msg.data);
    });

    // 2. Assina a Porcentagem (Para a Barra)
    const batListener = new ROSLIB.Topic({
      ros: ros,
      name: '/battery_state',
      messageType: 'sensor_msgs/BatteryState'
    });

    batListener.subscribe((msg) => {
      // Converte 0.5 para 50
      setPercentage(Math.round(msg.percentage * 100));
    });

    return () => {
      voltListener.unsubscribe();
      batListener.unsubscribe();
    };
  }, [ros]);

  // Cor baseada na porcentagem (Barra e Texto)
  const getColor = (pct) => {
    if (pct === null) return '#666';
    if (pct < 20) return '#ff4b5c'; 
    if (pct < 40) return '#f6d365';
    return '#00d26a';
  };

  return (
    <div style={{ 
      background: '#161822', 
      borderRadius: '8px', 
      border: '1px solid #333',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      height: '120px' 
    }}>
      
      {/* Título e Porcentagem */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <span style={{ fontSize: '0.9rem', opacity: 0.6, letterSpacing: '1px' }}>BATTERY VOLTAGE</span>
        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: getColor(percentage) }}>
          {voltage !== null ? voltage.toFixed(1) : '--.-'}
        </span>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <span style={{ fontSize: '0.9rem', letterSpacing: '1px', fontWeight: 'bold' }}>BATTERY CHARGE</span>
      </div>

      {/* Valor da Voltagem (Destaque) */}
      <div style={{ 
        fontSize: '2rem', 
        fontWeight: 'bold', 
        color: '#fff', 
        fontFamily: 'monospace',
        textAlign: 'center',
        lineHeight: '1'
      }}>
        {percentage !== null ? percentage + '%' : '--'}
      </div>
    </div>
  );
}

VoltageChart.propTypes = {
  ros: PropTypes.object
};