import PropTypes from 'prop-types';
import { useFleetState } from '../../hooks/useFleetState';

const STATUS_COLOR = {
  pending:   '#f59e0b',
  executing: '#3b82f6',
  completed: '#10b981',
  failed:    '#ef4444',
  cancelled: '#6b7280',
};

const STATUS_LABEL = {
  pending:   'Pendente',
  executing: 'Executando',
  completed: 'Concluída',
  failed:    'Falha',
  cancelled: 'Cancelada',
};

export default function TaskCard({ task }) {
  const { cancelTask } = useFleetState();
  const color = STATUS_COLOR[task.state] ?? '#6b7280';
  const canCancel = task.state === 'pending' || task.state === 'executing';
  const shortId = task.id ? `${task.id.slice(0, 8)}…` : '—';

  const handleCancel = () => {
    if (!window.confirm(`Cancelar tarefa ${shortId}?`)) return;
    cancelTask(task.id).catch(err =>
      console.error('[TaskCard] cancelTask error:', err)
    );
  };

  return (
    <>
      {/* Pulse keyframe injected once — minimal inline style supplement */}
      {task.state === 'executing' && (
        <style>{`@keyframes rmf-pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
      )}

      <div style={{
        background:    'rgba(255,255,255,0.05)',
        border:        `1px solid ${color}40`,
        borderRadius:  8,
        padding:       '10px 14px',
        marginBottom:  8,
        display:       'flex',
        alignItems:    'center',
        gap:           10,
        fontSize:      13,
        color:         'rgba(255,255,255,0.85)',
      }}>

        {/* Status badge */}
        <span style={{
          background:    `${color}22`,
          color:         color,
          border:        `1px solid ${color}60`,
          borderRadius:  4,
          padding:       '2px 7px',
          fontSize:      11,
          fontWeight:    600,
          whiteSpace:    'nowrap',
          animation:     task.state === 'executing' ? 'rmf-pulse 1.5s ease-in-out infinite' : 'none',
        }}>
          {STATUS_LABEL[task.state] ?? task.state}
        </span>

        {/* Task info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.6, marginBottom: 2 }}>
            {shortId}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ opacity: 0.7, textTransform: 'capitalize' }}>{task.category}</span>
            {task.goal && (
              <span style={{ opacity: 0.55, fontSize: 12 }}>
                → ({Number(task.goal.x).toFixed(2)}, {Number(task.goal.y).toFixed(2)})
              </span>
            )}
          </div>
        </div>

        {/* Cancel button */}
        {canCancel && (
          <button
            onClick={handleCancel}
            style={{
              background:   'rgba(239,68,68,0.15)',
              border:       '1px solid rgba(239,68,68,0.4)',
              borderRadius: 4,
              color:        '#ef4444',
              cursor:       'pointer',
              fontSize:     11,
              fontWeight:   600,
              padding:      '3px 9px',
              whiteSpace:   'nowrap',
            }}
          >
            Cancelar
          </button>
        )}
      </div>
    </>
  );
}

TaskCard.propTypes = {
  task: PropTypes.shape({
    id:       PropTypes.string.isRequired,
    state:    PropTypes.string.isRequired,
    category: PropTypes.string,
    goal:     PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }),
  }).isRequired,
};
