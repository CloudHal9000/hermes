import React from 'react';
import PropTypes from 'prop-types';

export function FleetSelector({ robots, activeId, onSelect }) {
  
  // Função para checar se está ocupado
  const isRobotBusy = (mode) => {
    if (!mode) return false;
    const m = mode.toUpperCase();
    return m === 'AUTONOMOUS' || m === 'MAPPING' || m === 'NAVIGATING';
  };

  // Função para checar se tem erro (Adapte conforme sua API envia o erro)
  // Assumindo que pode vir robot.status = 'ERROR' ou robot.hasError = true
  const isRobotError = (robot) => {
    return robot.status === 'ERROR' || robot.hasError === true;
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      
      {/* Injeção de CSS para animação de Alerta */}
      <style>
        {`
          @keyframes pulse-red {
            0% { box-shadow: 0 0 0 0 rgba(255, 75, 92, 0.7); border-color: rgba(255, 75, 92, 1); }
            70% { box-shadow: 0 0 0 10px rgba(255, 75, 92, 0); border-color: rgba(255, 75, 92, 0.5); }
            100% { box-shadow: 0 0 0 0 rgba(255, 75, 92, 0); border-color: rgba(255, 75, 92, 1); }
          }
        `}
      </style>

      {/* Cabeçalho */}
      <div style={{ 
        fontSize: '0.9rem', 
        fontWeight: 'bold', 
        color: '#ccc', 
        textTransform: 'uppercase', 
        borderBottom: '1px solid rgba(255,255,255,0.1)', 
        paddingBottom: '5px',
        marginBottom: '5px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>FLEET CONTROL</span>
        <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
          {robots.length}
        </span>
      </div>

      {/* Lista de Robôs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {robots.map((robot) => {
          const isActive = robot.id === activeId;
          const isBusy = isRobotBusy(robot.mode);
          const hasError = isRobotError(robot); // Verifica erro
          
          return (
            <button
              key={robot.id}
              onClick={() => onSelect(robot.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                // Lógica de Cor de Fundo
                background: hasError 
                  ? 'rgba(255, 75, 92, 0.1)' // Fundo vermelho leve se erro
                  : (isActive ? 'rgba(0, 210, 106, 0.08)' : 'rgba(255, 255, 255, 0.03)'),
                
                // Lógica de Borda (Vermelha se erro, Verde se ativo)
                border: hasError
                  ? '1px solid #ff4b5c'
                  : (isActive ? '1px solid #00d26a' : '1px solid rgba(255, 255, 255, 0.1)'),
                
                borderRadius: '8px',
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'visible', // Visible para a sombra sair da caixa
                
                // APLICA ANIMAÇÃO SE TIVER ERRO
                animation: hasError ? 'pulse-red 2s infinite' : 'none'
              }}
            >
              
              {/* LADO ESQUERDO: Led + Nome */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: hasError ? '#ff4b5c' : (robot.online ? '#00d26a' : '#666'),
                  boxShadow: robot.online && !hasError ? '0 0 8px #00d26a' : 'none'
                }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ 
                    color: isActive ? '#fff' : '#aaa', 
                    fontWeight: 'bold', 
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    {robot.name}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#666', fontFamily: 'monospace' }}>
                    {robot.ip}
                  </span>
                </div>
              </div>

              {/* LADO DIREITO: Badge de Status (BUSY / IDLE / ALERT) */}
              <div style={{
                fontSize: '0.65rem',
                fontWeight: 'bold',
                padding: '4px 8px',
                borderRadius: '4px',
                
                // Cores dinâmicas do Badge
                background: hasError 
                   ? 'rgba(255, 75, 92, 0.2)' 
                   : (isBusy ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'),
                
                color: hasError 
                   ? '#ff4b5c' 
                   : (isBusy ? '#00e5ff' : '#666'),
                
                border: hasError
                   ? '1px solid rgba(255, 75, 92, 0.5)'
                   : (isBusy ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)'),

                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                minWidth: '65px',
                justifyContent: 'center'
              }}>
                {/* Ícone ou Dot baseado no estado */}
                {hasError && <span>⚠️</span>}
                {!hasError && isBusy && (
                  <span style={{ display: 'block', width: '4px', height: '4px', borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 4px #00e5ff' }}></span>
                )}
                
                {/* Texto do Badge */}
                {hasError ? 'ALERT' : (isBusy ? 'BUSY' : 'IDLE')}
              </div>

            </button>
          );
        })}
      </div>
    </div>
  );
}

FleetSelector.propTypes = {
  robots: PropTypes.array.isRequired,
  activeId: PropTypes.number.isRequired,
  onSelect: PropTypes.func.isRequired
};