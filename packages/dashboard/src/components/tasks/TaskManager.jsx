import { useState } from 'react';
import { useFleetState } from '../../hooks/useFleetState';
import { useNotification } from '../../context/NotificationContext';
import TaskForm from './TaskForm';
import TaskList from './TaskList';

const STATUS_CONFIG = {
  connected:    { color: '#10b981', label: 'Conectado' },
  connecting:   { color: '#f59e0b', label: 'Conectando…' },
  disconnected: { color: '#6b7280', label: 'Desconectado' },
  error:        { color: '#ef4444', label: 'Erro' },
};

export default function TaskManager() {
  const { tasks, createTask, connectionStatus } = useFleetState();
  const { addNotification } = useNotification();
  const [submitting, setSubmitting] = useState(false);

  const status = STATUS_CONFIG[connectionStatus] ?? STATUS_CONFIG.disconnected;
  const formDisabled = connectionStatus !== 'connected' || submitting;

  const handleSubmit = async (taskRequest) => {
    setSubmitting(true);
    try {
      const result = await createTask({
        category: taskRequest.category,
        start:    { x: 0, y: 0 },
        goal:     taskRequest.goal,
      });
      const shortId = (result?.task_id ?? 'task').slice(0, 8);
      addNotification(`✅ Tarefa ${shortId} enviada`);
    } catch (err) {
      addNotification(`❌ Erro ao enviar tarefa: ${err?.message ?? 'desconhecido'}`);
      throw err; // re-throw so TaskForm shows inline error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      background:    'rgba(15, 17, 26, 0.75)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border:        '1px solid rgba(255,255,255,0.08)',
      borderRadius:  12,
      padding:       16,
      width:         280,
      color:         'rgba(255,255,255,0.9)',
      fontFamily:    'inherit',
    }}>

      {/* Header */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>
          TAREFAS
        </span>
        <span style={{
          background:    `${status.color}22`,
          border:        `1px solid ${status.color}50`,
          borderRadius:  4,
          color:         status.color,
          fontSize:      10,
          fontWeight:    600,
          padding:       '2px 7px',
        }}>
          {status.label}
        </span>
      </div>

      {/* Disconnected notice */}
      {connectionStatus !== 'connected' && (
        <div style={{
          background:   'rgba(239,68,68,0.08)',
          border:       '1px solid rgba(239,68,68,0.2)',
          borderRadius: 6,
          color:        'rgba(239,68,68,0.8)',
          fontSize:     11,
          marginBottom: 12,
          padding:      '7px 10px',
        }}>
          Sem conexão com o RMF API Server. Tarefas indisponíveis.
        </div>
      )}

      {/* Task form */}
      <TaskForm onSubmit={handleSubmit} disabled={formDisabled} />

      {/* Divider */}
      <div style={{
        borderTop:    '1px solid rgba(255,255,255,0.07)',
        margin:       '14px 0 10px',
      }} />

      {/* Task list */}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 600 }}>
        {tasks.length > 0 ? `${tasks.length} tarefa(s)` : 'Histórico vazio'}
      </div>
      <TaskList
        tasks={tasks}
        emptyMessage="Nenhuma tarefa enviada ainda"
      />
    </div>
  );
}
