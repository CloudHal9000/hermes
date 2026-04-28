import { describe, test, expect, beforeEach } from 'vitest';
import { useFleetStore } from '../fleetStore';
import {
  mockFleetState1Robot,
  mockFleetState5Robots,
  mockTaskPending,
  mockTaskExecuting,
} from '../../test/mocks/rmfApi';

// Reset store to initial state before every test — the store is a singleton
// and state leaks between tests in the same file without this.
beforeEach(() => {
  useFleetStore.getState().reset();
});

describe('fleetStore', () => {
  test('inicia com arrays vazios e status disconnected', () => {
    const { robots, tasks, connectionStatus, lastUpdated } = useFleetStore.getState();
    expect(robots).toEqual([]);
    expect(tasks).toEqual([]);
    expect(connectionStatus).toBe('disconnected');
    expect(lastUpdated).toBeNull();
  });

  test('setFleetState com 1 robô atualiza robots[] e tasks[]', () => {
    useFleetStore.getState().setFleetState(mockFleetState1Robot);
    const { robots, tasks, lastUpdated } = useFleetStore.getState();
    expect(robots).toHaveLength(1);
    expect(robots[0].id).toBe('robot_01');
    expect(tasks).toHaveLength(1);
    expect(lastUpdated).not.toBeNull();
  });

  test('setFleetState com 5 robôs atualiza robots[] corretamente', () => {
    useFleetStore.getState().setFleetState(mockFleetState5Robots);
    const { robots, tasks } = useFleetStore.getState();
    expect(robots).toHaveLength(5);
    expect(tasks).toHaveLength(3);
    expect(robots.map((r) => r.id)).toContain('robot_03');
  });

  test('updateRobot atualiza battery sem sobrescrever outros campos', () => {
    useFleetStore.getState().setFleetState(mockFleetState1Robot);
    useFleetStore.getState().updateRobot('robot_01', { battery: 42 });
    const robot = useFleetStore.getState().robots.find((r) => r.id === 'robot_01');
    expect(robot?.battery).toBe(42);
    // Outros campos permanecem intactos
    expect(robot?.id).toBe('robot_01');
    expect(robot?.status).toBe('idle');
    expect(robot?.location).toEqual({ x: 1.0, y: 2.0, yaw: 0.0, level: 'L1' });
  });

  test('updateTask muda estado de pending para executing', () => {
    useFleetStore.getState().addTask(mockTaskPending);
    useFleetStore.getState().updateTask('task_001', {
      state: 'executing',
      assigned_robot_id: 'robot_01',
    });
    const task = useFleetStore.getState().tasks.find((t) => t.id === 'task_001');
    expect(task?.state).toBe('executing');
    expect(task?.assigned_robot_id).toBe('robot_01');
    // Campos imutáveis não mudaram
    expect(task?.category).toBe('delivery');
    expect(task?.goal).toEqual({ x: 10, y: 5 });
  });

  test('reset retorna ao estado inicial e apaga dados populados', () => {
    // Popular o store
    useFleetStore.getState().setFleetState(mockFleetState5Robots);
    useFleetStore.getState().setConnectionStatus('connected');
    // Verificar que foi populado
    expect(useFleetStore.getState().robots).toHaveLength(5);
    expect(useFleetStore.getState().connectionStatus).toBe('connected');
    // Reset
    useFleetStore.getState().reset();
    const { robots, tasks, connectionStatus, lastUpdated } = useFleetStore.getState();
    expect(robots).toEqual([]);
    expect(tasks).toEqual([]);
    expect(connectionStatus).toBe('disconnected');
    expect(lastUpdated).toBeNull();
  });

  test('setConnectionStatus transiciona entre todos os estados válidos', () => {
    const { setConnectionStatus } = useFleetStore.getState();

    setConnectionStatus('connecting');
    expect(useFleetStore.getState().connectionStatus).toBe('connecting');

    setConnectionStatus('connected');
    expect(useFleetStore.getState().connectionStatus).toBe('connected');

    setConnectionStatus('error');
    expect(useFleetStore.getState().connectionStatus).toBe('error');

    setConnectionStatus('disconnected');
    expect(useFleetStore.getState().connectionStatus).toBe('disconnected');
  });
});
