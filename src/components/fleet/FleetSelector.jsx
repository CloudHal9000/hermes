import { useState } from 'react';
import PropTypes from 'prop-types';

// ── RMF mode helpers ──────────────────────────────────────────────────────────

const RMF_MODE_LABELS = { 0: 'IDLE', 1: 'CHARGING', 2: 'MOVING', 3: 'PAUSED', 5: 'EMERGENCY', 8: 'ERROR' };
const RMF_MODE_COLORS = { 0: '#6b7280', 1: '#f59e0b', 2: '#3b82f6', 3: '#f59e0b', 5: '#ef4444', 8: '#ef4444' };

function BatteryBar({ level }) {
  const pct = Math.max(0, Math.min(100, level ?? 0));
  const color = pct > 50 ? '#10b981' : pct > 20 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', minWidth: 28, textAlign: 'right' }}>{Math.round(pct)}%</span>
    </div>
  );
}

BatteryBar.propTypes = { level: PropTypes.number };

function RMFRobotCard({ robot }) {
  const modeNum  = robot.status ?? 0;
  const modeLabel = RMF_MODE_LABELS[modeNum] ?? String(modeNum);
  const modeColor = RMF_MODE_COLORS[modeNum] ?? '#6b7280';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${modeColor}40`,
      borderRadius: 8,
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#eee', letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {robot.id}
          </span>
          {robot.protocol === 'vda5050' && (
            <span style={{
              fontSize: '8px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              color: '#a855f7',
              border: '1px solid #a855f7',
              borderRadius: '3px',
              padding: '1px 4px',
              opacity: 0.85,
              flexShrink: 0,
            }}>
              VDA5050
            </span>
          )}
        </div>
        <span style={{
          fontSize: 9, fontWeight: 600, padding: '1px 5px',
          borderRadius: 3, background: `${modeColor}22`,
          color: modeColor, border: `1px solid ${modeColor}50`,
          flexShrink: 0,
        }}>
          {modeLabel}
        </span>
      </div>
      <BatteryBar level={robot.battery} />
      {robot.fleet && (
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{robot.fleet}</span>
      )}
    </div>
  );
}

RMFRobotCard.propTypes = {
  robot: PropTypes.shape({
    id:      PropTypes.string,
    battery: PropTypes.number,
    status:  PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    fleet:   PropTypes.string,
  }).isRequired,
};

// ── Legacy mode (useFleetPolling format) ──────────────────────────────────────

const COLORS = { RED: '#ff4b5c', GREEN: '#00d26a', BLUE: '#00e5ff', YELLOW: '#f6d365', GRAY: '#666' };

function getLegacyVisual(robot) {
  if (!robot.online) return { color: COLORS.RED, label: 'OFF', pulse: true };
  if (robot.battery_level !== null && robot.battery_level < 20) return { color: COLORS.RED, label: 'LOW BAT', pulse: true };
  if (robot.hasError) return { color: COLORS.RED, label: 'ERROR', pulse: true };
  const mode = (robot.mode ?? '').toUpperCase();
  if (mode === 'AUTONOMOUS') return { color: COLORS.GREEN, label: robot.isBusy ? 'BUSY' : 'IDLE', pulse: false };
  if (mode === 'MANUAL') return { color: COLORS.GREEN, label: 'MANU', pulse: false };
  return { color: COLORS.GRAY, label: '---', pulse: false };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FleetSelector({ robots, activeId, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Detect mode: RMF robots have a `fleet` field; legacy robots have `ip` or `online`
  const isRMFMode = robots.length > 0 && robots[0].fleet !== undefined;

  if (isRMFMode) {
    const filtered = robots.filter(r => (r.id ?? '').toLowerCase().includes(searchTerm.toLowerCase()));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <style>{`.fleet-list::-webkit-scrollbar{width:4px}.fleet-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:4px}`}</style>

        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#ccc', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 5, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
          <span>FROTA ({robots.length} robô{robots.length !== 1 ? 's' : ''})</span>
        </div>

        <input
          type="text"
          placeholder="🔍 Buscar robô..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 8px', color: '#fff', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box' }}
        />

        <div className="fleet-list" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: '#555', fontSize: '0.75rem', padding: 16 }}>
              {robots.length === 0 ? 'Aguardando dados do RMF…' : 'Nenhum robô encontrado.'}
            </div>
          )}
          {filtered.map(robot => (
            <RMFRobotCard key={robot.id} robot={robot} />
          ))}
        </div>
      </div>
    );
  }

  // ── Legacy mode ──────────────────────────────────────────────────────────────
  const visibleRobots = robots.filter(r => r.id !== activeId);
  const filtered = visibleRobots.filter(r => r.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        @keyframes pulse-red{0%{box-shadow:0 0 0 0 rgba(255,75,92,.4)}70%{box-shadow:0 0 0 6px rgba(255,75,92,0)}100%{box-shadow:0 0 0 0 rgba(255,75,92,0)}}
        .fleet-list::-webkit-scrollbar{width:4px}.fleet-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:4px}
      `}</style>

      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ccc', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 5, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>FLEET CONTROL</span>
          <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>{filtered.length}</span>
        </div>
        <input type="text" placeholder="🔍 Search robot..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 8, color: '#fff', fontSize: '0.8rem', marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div className="fleet-list" style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: '70vh', paddingRight: 4 }}>
        {filtered.length === 0 && <div style={{ textAlign: 'center', color: '#666', fontSize: '0.8rem', padding: 20 }}>No other robots.</div>}
        {filtered.map(robot => {
          const v = getLegacyVisual(robot);
          return (
            <button key={robot.id} onClick={() => onSelect(robot.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: `${v.color}08`, border: `1px solid ${v.color}50`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', minHeight: 60, animation: v.pulse ? 'pulse-red 2s infinite' : 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, boxShadow: `0 0 8px ${v.color}` }} />
                <span style={{ color: '#eee', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>{robot.name}</span>
              </div>
              <span style={{ fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: 3, background: 'rgba(255,255,255,0.1)', color: v.color }}>{v.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

FleetSelector.propTypes = {
  robots:   PropTypes.array.isRequired,
  activeId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSelect: PropTypes.func.isRequired,
};
