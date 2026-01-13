import { useState } from 'react';
import PropTypes from 'prop-types';

export function FleetSelector({ robots, activeId, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  // --- TABELA DE CORES (Baseada no image_8521ec.png) ---
  const COLORS = {
    RED: '#ff4b5c',      // Erro / Alerta
    GREEN: '#00d26a',    // Disponível (Auto + Idle)
    BLUE: '#00e5ff',     // Ocupado (Auto + Busy)
    YELLOW: '#f6d365',   // Manual
    ORANGE: '#ff9f43',   // Mapping
    GRAY: '#666'         // Manutenção / Offline
  };

  const getRobotVisualState = (robot) => {
    // 1. OFFLINE (Visual Imagem 85847e.png - QDD48)
    if (!robot.online) {
      return { 
        containerColor: COLORS.RED,
        priority: 1,
        isPulsing: true,
        badges: [
          { text: '⚠️ ALERT', color: COLORS.YELLOW, bg: 'rgba(246, 211, 101, 0.15)', border: COLORS.YELLOW }, // Topo
          { text: 'OFF', color: '#999', bg: 'rgba(0,0,0,0.2)', border: '#666' } // Fundo
        ]
      };
    }

    // 2. LOW BATTERY (Visual Imagem 07301e.png - QDD47 - Badge Único Grande)
    if (robot.battery_level !== null && robot.battery_level < 20) {
      return { 
        containerColor: COLORS.RED,
        priority: 1,
        isPulsing: true,
        badges: [
          { text: '⚠️ LOW BAT', color: COLORS.YELLOW, bg: 'rgba(246, 211, 101, 0.15)', border: COLORS.YELLOW, fullWidth: true }
        ]
      };
    }

    // 3. BLOCKED (Similar a Low Bat)
    if (robot.status === 'BLOCKED' || robot.hasError) {
      return { 
        containerColor: COLORS.RED,
        priority: 1,
        isPulsing: true,
        badges: [
          { text: '⚠️ BLOCKED', color: COLORS.YELLOW, bg: 'rgba(246, 211, 101, 0.15)', border: COLORS.YELLOW, fullWidth: true }
        ]
      };
    }

    const mode = robot.mode ? robot.mode.toUpperCase() : '';

    // 4. MANUAL (Amarelo)
    if (mode === 'MANUAL') {
      return { 
        containerColor: COLORS.GREEN, // Imagem mostra container verde para manual (MUTLEY)
        priority: 4,
        isPulsing: false,
        badges: [
          { text: '● BUSY', color: COLORS.BLUE, bg: 'rgba(0, 229, 255, 0.15)', border: 'rgba(0, 229, 255, 0.3)' },
          { text: 'MANU', color: COLORS.GREEN, bg: 'rgba(0, 210, 106, 0.1)', border: COLORS.GREEN }
        ]
      };
    }

    // 5. MAPPING (Laranja/Azul na imagem)
    if (mode === 'MAPPING') {
      return { 
        containerColor: COLORS.GREEN, // Imagem QDD50
        priority: 5,
        isPulsing: false,
        badges: [
          { text: '● BUSY', color: COLORS.BLUE, bg: 'rgba(0, 229, 255, 0.15)', border: 'rgba(0, 229, 255, 0.3)' },
          { text: 'MAP', color: COLORS.BLUE, bg: 'rgba(0, 229, 255, 0.1)', border: COLORS.BLUE } // Imagem mostra MAP azul
        ]
      };
    }

    // AUTONOMOUS
    if (mode === 'AUTONOMOUS') {
      if (robot.isBusy) {
        // OCUPADO
        return { 
          containerColor: COLORS.GREEN,
          priority: 3,
          isPulsing: false,
          badges: [
            { text: '● BUSY', color: COLORS.BLUE, bg: 'rgba(0, 229, 255, 0.15)', border: 'rgba(0, 229, 255, 0.3)' },
            { text: 'AUTO', color: COLORS.YELLOW, bg: 'rgba(246, 211, 101, 0.1)', border: COLORS.YELLOW } // Imagem QDD46
          ]
        };
      } else {
        // DISPONÍVEL (IDLE)
        return { 
          containerColor: COLORS.GREEN,
          priority: 2,
          isPulsing: false,
          badges: [
            { text: 'IDLE', color: '#888', bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.1)' },
            { text: 'AUTO', color: COLORS.YELLOW, bg: 'rgba(246, 211, 101, 0.1)', border: COLORS.YELLOW } // Imagem QDD45
          ]
        };
      }
    }

    // DEFAULT
    return { 
      containerColor: COLORS.GRAY,
      priority: 6,
      isPulsing: false,
      badges: [{ text: '---', color: '#666', bg: 'transparent', border: '#666' }]
    };
  };

  // --- FILTRAGEM (Remove o robô ativo da lista) ---
  const visibleRobots = robots.filter(r => r.id !== activeId);

  const filteredRobots = visibleRobots.filter(robot => {
    return robot.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // --- ORDENAÇÃO ---
  const sortedRobots = [...filteredRobots].sort((a, b) => {
    const visualA = getRobotVisualState(a);
    const visualB = getRobotVisualState(b);
    if (visualA.priority !== visualB.priority) return visualA.priority - visualB.priority;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* CSS DA ANIMAÇÃO PULSE (Restaurada) */}
      <style>
        {`
          @keyframes pulse-red {
            0% { box-shadow: 0 0 0 0 rgba(255, 75, 92, 0.4); border-color: rgba(255, 75, 92, 0.8); }
            70% { box-shadow: 0 0 0 6px rgba(255, 75, 92, 0); border-color: rgba(255, 75, 92, 0.3); }
            100% { box-shadow: 0 0 0 0 rgba(255, 75, 92, 0); border-color: rgba(255, 75, 92, 0.8); }
          }
          .fleet-list::-webkit-scrollbar { width: 4px; }
          .fleet-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
          .fleet-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        `}
      </style>

      {/* CABEÇALHO */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ccc', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>FLEET CONTROL</span>
          <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{sortedRobots.length}</span>
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

      {/* LISTA DE ROBÔS */}
      <div className="fleet-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '70vh', paddingRight: '4px' }}>
        {sortedRobots.length === 0 && <div style={{ textAlign: 'center', color: '#666', fontSize: '0.8rem', padding: '20px' }}>No other robots.</div>}

        {sortedRobots.map((robot) => {
          const visual = getRobotVisualState(robot);
          
          return (
            <button key={robot.id} onClick={() => onSelect(robot.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                background: `${visual.containerColor}08`, // Fundo muito sutil
                border: `1px solid ${visual.containerColor}50`, 
                borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', 
                minHeight: '60px',
                // Animação de pulso se for crítico
                animation: visual.isPulsing ? 'pulse-red 2s infinite' : 'none',
                boxShadow: visual.isPulsing ? 'none' : '0 2px 5px rgba(0,0,0,0.2)'
              }}
            >
              {/* LED E NOME */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: visual.containerColor, boxShadow: `0 0 8px ${visual.containerColor}`, flexShrink: 0 }}></div>
                <span style={{ color: '#eee', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {robot.name}
                </span>
              </div>

              {/* BADGES (Dinâmico: 1 ou 2 badges) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', minWidth: '70px' }}>
                  
                  {visual.badges.map((badge, idx) => (
                    <div key={idx} style={{ 
                        fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '3px',
                        background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                        width: badge.fullWidth ? 'auto' : '100%', // Se for badge único, auto largura fica melhor ou full? Imagem 47 tem largura fixa
                        minWidth: '60px', textAlign: 'center',
                        marginTop: (visual.badges.length === 1 && idx === 0) ? '0' : '0' // Centraliza se for 1? Não, flex lida com isso
                    }}>
                        {badge.text}
                    </div>
                  ))}

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