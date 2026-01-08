import { useState } from 'react';
import PropTypes from 'prop-types';

export function FleetSelector({ robots, activeId, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, IDLE, BUSY, ERROR

  // --- 1. LÓGICA DE DIAGNÓSTICO DO ROBÔ ---
  const getRobotDiagnosis = (robot) => {
    // CASO 1: ERRO (Perda de Comunicação)
    if (!robot.online) {
      return { status: 'ERROR', label: 'OFF', color: '#ff4b5c', type: 'COMM_LOSS' };
    }

    // CASO 2: ALERTAS
    if (robot.battery_level !== null && robot.battery_level < 20) {
      return { status: 'ALERT', label: 'LOW BAT', color: '#ff9f43', type: 'WARNING' };
    }
    if (robot.status === 'BLOCKED' || (robot.mode && robot.mode.toUpperCase() === 'ERROR')) {
       return { status: 'ALERT', label: 'BLOCKED', color: '#ff9f43', type: 'WARNING' };
    }

    // CASO 3: NORMAL
    const mode = robot.mode ? robot.mode.toUpperCase() : '';
    const isBusy = ['MANUAL', 'MAPPING', 'CHARGING', 'NAVIGATING'].includes(mode) || 
                   (mode === 'AUTONOMOUS' && robot.isBusy);
    
    return { 
      status: isBusy ? 'BUSY' : 'IDLE', 
      label: formatModeLabel(mode),
      color: isBusy ? '#00e5ff' : '#666',
      type: 'NORMAL'
    };
  };

  const formatModeLabel = (mode) => {
    if (!mode) return '---';
    const m = mode.toUpperCase();
    if (m === 'CHARGING') return '⚡ CHRG';
    if (m === 'AUTONOMOUS') return 'AUTO';
    if (m === 'MAPPING') return 'MAP';
    if (m === 'MANUAL') return 'MANU';
    return m.slice(0, 4).toLowerCase(); 
  };

  // --- 2. FILTRAGEM ---
  const filteredRobots = robots.filter(robot => {
    const matchesSearch = robot.name.toLowerCase().includes(searchTerm.toLowerCase());
    const diagnosis = getRobotDiagnosis(robot);
    
    if (filterType === 'ALL') return matchesSearch;
    if (filterType === 'ERROR') return matchesSearch && diagnosis.status === 'ERROR';
    if (filterType === 'ALERT') return matchesSearch && diagnosis.status === 'ALERT';
    if (filterType === 'BUSY') return matchesSearch && diagnosis.status === 'BUSY';
    if (filterType === 'IDLE') return matchesSearch && diagnosis.status === 'IDLE';
    
    return matchesSearch;
  });

  // --- 3. ORDENAÇÃO ---
  const sortedRobots = [...filteredRobots].sort((a, b) => {
    const getPriority = (r) => {
      const diag = getRobotDiagnosis(r);
      if (diag.status === 'ERROR') return 0; // Prioridade Máxima
      if (diag.status === 'ALERT') return 1;
      if (diag.status === 'IDLE') return 2;
      return 3; 
    };
    const pA = getPriority(a);
    const pB = getPriority(b);
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });

  const getModeStyle = (mode) => {
    const m = mode ? mode.toUpperCase() : '';
    if (m === 'AUTONOMOUS') return { color: '#f6d365', border: '#f6d365', bg: 'rgba(246, 211, 101, 0.1)' };
    if (m === 'MANUAL') return { color: '#00d26a', border: '#00d26a', bg: 'rgba(0, 210, 106, 0.1)' };
    if (m === 'MAPPING') return { color: '#00e5ff', border: '#00e5ff', bg: 'rgba(0, 229, 255, 0.1)' };
    if (m === 'CHARGING') return { color: '#ff9f43', border: '#ff9f43', bg: 'rgba(255, 159, 67, 0.1)' };
    return { color: '#666', border: '#666', bg: 'rgba(255,255,255,0.05)' };
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>
        {`
          @keyframes pulse-red {
            0% { box-shadow: 0 0 0 0 rgba(255, 75, 92, 0.7); border-color: rgba(255, 75, 92, 1); }
            70% { box-shadow: 0 0 0 10px rgba(255, 75, 92, 0); border-color: rgba(255, 75, 92, 0.5); }
            100% { box-shadow: 0 0 0 0 rgba(255, 75, 92, 0); border-color: rgba(255, 75, 92, 1); }
          }
          .fleet-list::-webkit-scrollbar { width: 4px; }
          .fleet-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
          .fleet-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); borderRadius: 4px; }
        `}
      </style>

      {/* CABEÇALHO */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ccc', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>FLEET CONTROL</span>
          <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{robots.length}</span>
        </div>
        <input type="text" placeholder="🔍 Search robot..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '0.8rem', marginBottom: '8px', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          {['ALL', 'IDLE', 'BUSY', 'ERROR'].map(type => (
            <button key={type} onClick={() => setFilterType(type)}
              style={{ flex: 1, background: filterType === type ? 'rgba(255,255,255,0.15)' : 'transparent', border: filterType === type ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent', color: filterType === type ? '#fff' : '#666', fontSize: '0.65rem', fontWeight: 'bold', padding: '4px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}>
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* LISTA */}
      <div className="fleet-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '70vh', paddingRight: '4px' }}>
        {sortedRobots.length === 0 && <div style={{ textAlign: 'center', color: '#666', fontSize: '0.8rem', padding: '20px' }}>No robots found.</div>}

        {sortedRobots.map((robot) => {
          const isActive = robot.id === activeId;
          const diag = getRobotDiagnosis(robot);
          const modeStyle = getModeStyle(robot.mode);
          const isCritical = diag.status === 'ERROR' || diag.status === 'ALERT';

          return (
            <button key={robot.id} onClick={() => onSelect(robot.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                background: isCritical ? 'rgba(255, 75, 92, 0.1)' : (isActive ? 'rgba(0, 210, 106, 0.08)' : 'rgba(255, 255, 255, 0.03)'),
                border: isCritical ? '1px solid #ff4b5c' : (isActive ? '1px solid #00d26a' : '1px solid rgba(255, 255, 255, 0.1)'),
                borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', overflow: 'visible',
                animation: isCritical ? 'pulse-red 2s infinite' : 'none', 
                minHeight: '58px' // Garante a altura do botão mesmo com 1 badge
              }}
            >
              {/* ESQUERDA: Led + Nome */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isCritical ? '#ff4b5c' : '#00d26a', boxShadow: !isCritical ? '0 0 8px #00d26a' : 'none', flexShrink: 0 }}></div>
                <span style={{ color: isActive ? '#fff' : '#aaa', fontWeight: 'bold', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '95px' }}>
                  {robot.name}
                </span>
              </div>

              {/* DIREITA: Badges */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', justifyContent: 'center' }}>
                
                {/* LÓGICA PADRONIZADA: ERRO E ALERTA AGORA SÃO IGUAIS VISUALMENTE */}
                {(diag.status === 'ERROR' || diag.status === 'ALERT') ? (
                   // VISUAL PADRÃO DE ALERTA (Amarelo, 1 badge único)
                   <div style={{ fontSize: '0.65rem', fontWeight: 'bold', padding: '4px 8px', borderRadius: '3px', 
                      background: 'rgba(255, 159, 67, 0.2)', color: '#ff9f43', border: '1px solid #ff9f43', 
                      textAlign: 'center', minWidth: '60px' 
                   }}>
                      ⚠️ {diag.label}
                   </div>
                ) : (
                  // NORMAL (2 badges: Status + Mode)
                  <>
                    <div style={{ fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '3px', 
                        background: diag.status === 'BUSY' ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: diag.status === 'BUSY' ? '#00e5ff' : '#666',
                        border: diag.status === 'BUSY' ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', minWidth: '55px'
                    }}>
                        {diag.status === 'BUSY' && <span style={{ display: 'block', width: '3px', height: '3px', borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 4px #00e5ff' }}></span>}
                        {diag.status}
                    </div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '3px', background: modeStyle.bg, color: modeStyle.color, border: `1px solid ${modeStyle.border}`, opacity: 0.8, textAlign: 'center', minWidth: '55px' }}>
                        {diag.label}
                    </div>
                  </>
                )}
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