import GaugeComponent from 'react-gauge-component';
import PropTypes from 'prop-types';

export function Speedometer({ value }) {
  // O valor entra em km/h
  
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '4px' }}>
        SPEED (km/h)
      </div>
      
      <GaugeComponent
        value={value}
        type="grafana"
        
        // --- AQUI ESTÁ O SEGREDO DO 0 a 2 km/h ---
        minValue={0}
        maxValue={2} 
        
        // Estilo do Arco
        arc={{
          width: 0.2, // Espessura do arco
          padding: 0.01,
          cornerRadius: 10,
          subArcs: [
            { limit: 1.2, color: '#00d26a', showTick: true },
            { limit: 1.8, color: '#f6d365', showTick: true },
            { limit: 2.0, color: '#ff4b5c', showTick: true }
          ]
        }}
        
        // Estilo do Ponteiro
        pointer={{
          color: '#ffffff',
          length: 0.80,
          width: 12,
          elastic: true,
        }}
        
        // Estilo do Texto Central
        labels={{
          valueLabel: {
            formatTextValue: (val) => val.toFixed(1), // Mostra 1 casa decimal (ex: 1.4)
            style: { fill: '#ffffff', textShadow: 'none', fontSize: '35px' }
          },
          tickLabels: {
            type: 'outer',
            ticks: [
                { value: 0 }, 
                { value: 0.5 },
                { value: 1.0 }, 
                { value: 1.5 },
                { value: 2.0 }
            ],
            defaultTickValueConfig: { 
               formatTextValue: (val) => val % 1 === 0 ? val : val.toFixed(1)
            }
          }
        }}
      />
    </div>
  );
}

Speedometer.propTypes = {
  value: PropTypes.number
};