import { useState } from 'react';
import PropTypes from 'prop-types';

const CATEGORIES = ['delivery', 'navigation', 'patrol'];

const inputStyle = {
  background:   'rgba(255,255,255,0.07)',
  border:       '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6,
  color:        'rgba(255,255,255,0.9)',
  fontSize:     13,
  outline:      'none',
  padding:      '6px 10px',
  width:        '100%',
  boxSizing:    'border-box',
};

const labelStyle = {
  color:        'rgba(255,255,255,0.5)',
  display:      'block',
  fontSize:     11,
  fontWeight:   600,
  letterSpacing: '0.05em',
  marginBottom: 4,
  textTransform: 'uppercase',
};

export default function TaskForm({ onSubmit, disabled }) {
  const [category, setCategory] = useState('navigation');
  const [goalX, setGoalX]       = useState('');
  const [goalY, setGoalY]       = useState('');
  const [goalYaw, setGoalYaw]   = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const handleSubmit = async () => {
    const x = parseFloat(goalX);
    const y = parseFloat(goalY);
    if (isNaN(x) || isNaN(y)) {
      setError('Goal X e Y são obrigatórios e devem ser números.');
      return;
    }
    const goal = { x, y };
    if (goalYaw !== '') {
      const yaw = parseFloat(goalYaw);
      if (!isNaN(yaw)) goal.yaw = yaw;
    }

    setBusy(true);
    setError('');
    try {
      await onSubmit({ category, goal });
      setGoalX('');
      setGoalY('');
      setGoalYaw('');
    } catch (err) {
      setError(err?.message ?? 'Erro ao enviar tarefa');
    } finally {
      setBusy(false);
    }
  };

  const isDisabled = disabled || busy;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Category */}
      <div>
        <label style={labelStyle}>Categoria</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          disabled={isDisabled}
          style={{ ...inputStyle, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c} style={{ background: '#1a1f2e' }}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Goal coordinates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={labelStyle}>Goal X</label>
          <input
            type="number"
            step="0.1"
            placeholder="0.0"
            value={goalX}
            onChange={e => setGoalX(e.target.value)}
            disabled={isDisabled}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Goal Y</label>
          <input
            type="number"
            step="0.1"
            placeholder="0.0"
            value={goalY}
            onChange={e => setGoalY(e.target.value)}
            disabled={isDisabled}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Optional yaw */}
      <div>
        <label style={labelStyle}>Goal Yaw <span style={{ opacity: 0.4 }}>(opcional, rad)</span></label>
        <input
          type="number"
          step="0.01"
          placeholder="0.0 (rad)"
          value={goalYaw}
          onChange={e => setGoalYaw(e.target.value)}
          disabled={isDisabled}
          style={inputStyle}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: '#ef4444', fontSize: 12, padding: '4px 0' }}>
          {error}
        </div>
      )}

      {/* Submit button — div + onClick pattern, not HTML form (project convention) */}
      <div
        onClick={isDisabled ? undefined : handleSubmit}
        style={{
          background:    isDisabled
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(59,130,246,0.2)',
          border:        `1px solid ${isDisabled ? 'rgba(255,255,255,0.1)' : 'rgba(59,130,246,0.5)'}`,
          borderRadius:  6,
          color:         isDisabled ? 'rgba(255,255,255,0.3)' : '#93c5fd',
          cursor:        isDisabled ? 'not-allowed' : 'pointer',
          fontSize:      13,
          fontWeight:    600,
          padding:       '8px 0',
          textAlign:     'center',
          userSelect:    'none',
          transition:    'background 0.15s, border-color 0.15s',
        }}
      >
        {busy ? 'Enviando…' : 'Enviar Tarefa'}
      </div>
    </div>
  );
}

TaskForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

TaskForm.defaultProps = {
  disabled: false,
};
