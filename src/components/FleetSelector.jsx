import PropTypes from 'prop-types';

export function FleetSelector({ robots, activeId, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '5px' }}>
      
      <span style={{ fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
        FLEET ({robots.length})
      </span>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
        gap: '8px'
      }}>
        {robots.map((robot) => {
          // Só afeta o visual do BOTÃO (Borda/Fundo), não a bolinha
          const isSelected = robot.id === activeId;
          
          // Cor da Bolinha: Baseada puramente no estado memorizado
          const dotColor = robot.online ? '#00d26a' : '#ff4b5c';

          return (
            <button
              key={robot.id}
              onClick={() => onSelect(robot.id)}
              style={{
                // Se selecionado: Fundo esverdeado sutil. Se não: Transparente/Cinza
                background: isSelected ? 'rgba(0, 210, 106, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: isSelected ? '1px solid #00d26a' : '1px solid rgba(255,255,255,0.1)',
                
                borderRadius: '8px',
                padding: '12px 8px',
                color: isSelected ? '#fff' : '#aaa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                fontSize: '0.8rem',
                fontWeight: isSelected ? 'bold' : 'normal'
              }}
            >
              {/* Bolinha com brilho se estiver online */}
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: dotColor,
                boxShadow: robot.online ? `0 0 6px ${dotColor}` : 'none',
                transition: 'background-color 0.3s'
              }} />
              
              {robot.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

FleetSelector.propTypes = {
  robots: PropTypes.array,
  activeId: PropTypes.number,
  onSelect: PropTypes.func
};