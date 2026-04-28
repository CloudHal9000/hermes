import PropTypes from 'prop-types';
import TaskCard from './TaskCard';

const STATE_ORDER = { executing: 0, pending: 1 };

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const ao = STATE_ORDER[a.state] ?? 2;
    const bo = STATE_ORDER[b.state] ?? 2;
    if (ao !== bo) return ao - bo;
    // Within same group, most recently updated first
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  });
}

export default function TaskList({ tasks, emptyMessage }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div style={{
        textAlign:  'center',
        padding:    '24px 12px',
        color:      'rgba(255,255,255,0.3)',
        fontSize:   13,
      }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>☑</div>
        {emptyMessage ?? 'Nenhuma tarefa'}
      </div>
    );
  }

  return (
    <div style={{
      overflowY: tasks.length > 5 ? 'auto' : 'visible',
      maxHeight: tasks.length > 5 ? 300 : 'none',
      paddingRight: tasks.length > 5 ? 4 : 0,
    }}>
      {sortTasks(tasks).map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}

TaskList.propTypes = {
  tasks:        PropTypes.array.isRequired,
  emptyMessage: PropTypes.string,
};
