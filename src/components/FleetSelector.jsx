import PropTypes from 'prop-types';

export function FleetSelector({ robots, activeId, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
      
      <span style={{ fontSize: '0.9rem', textTransform: 'uppercase', fontWeight: 'bold', textAlign: 'center', letterSpacing: '1px' }}>
        FLEET ({robots.length})
      </span>

      {/* Grid que se adapta ao tamanho */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
        gap: '8px'
      }}>
        {robots.map((robot) => {
          const isActive = robot.id === activeId;
          
          // Lógica da cor: Se online=Verde, Se offline=Vermelho
          // (Independente se está selecionado ou não)
          const dotColor = robot.online ? '#00d26a' : 'rgba(73, 87, 97, 0.79)';

          return (
            <button
              key={robot.id}
              onClick={() => onSelect(robot.id)}
              style={{
                // Se ativo: Fundo Verde Claro. Se inativo: Fundo transparente
                background: isActive ? 'rgba(0, 210, 106, 0.15)' : 'rgba(0,0,0,0.3)',
                border: isActive ? '1px solid #00d26a' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '8px',
                color: isActive ? '#fff' : '#aaa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}
            >
              {/* Bolinha sempre colorida */}
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: dotColor,
                boxShadow: `0 0 5px ${dotColor}`
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