import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFleetStore } from '../../store/fleetStore';

// Mock useRMFApi to avoid creating a real WebSocket in these tests
vi.mock('../useRMFApi', () => ({
  useRMFApi: () => ({
    createTask:       vi.fn(),
    cancelTask:       vi.fn(),
    getTask:          vi.fn(),
    connectionStatus: 'connected',
  }),
}));

import { useFleetState } from '../useFleetState';

// ── Robot fixtures in rmf_fleet_msgs format (what the adapter actually sends)
const mockRobotRMF = {
  name:            'robot_01',
  battery_percent: 85,
  mode:            { mode: 2 },  // MODE_MOVING
  location:        { x: 1.5, y: 3.2, yaw: 0.78, level_name: 'L1' },
  fleet_name:      'freebotics',
};

const mockRobotAlt = {
  // REST-API format (id / battery / status / location.level)
  id:       'robot_02',
  battery:  62,
  status:   'idle',
  location: { x: 0, y: 0, yaw: 0, level: 'L2' },
  fleet_name: 'freebotics',
};

beforeEach(() => {
  useFleetStore.getState().reset();
  vi.clearAllMocks();
});

describe('useFleetState', () => {

  test('robots retorna array vazio quando store vazia', () => {
    const { result } = renderHook(() => useFleetState());
    expect(result.current.robots).toEqual([]);
  });

  test('robots transforma RobotState para formato UI corretamente', () => {
    useFleetStore.setState({ robots: [mockRobotRMF] });
    const { result } = renderHook(() => useFleetState());
    const r = result.current.robots[0];

    expect(r.id).toBe('robot_01');
    expect(r.x).toBeCloseTo(1.5);
    expect(r.y).toBeCloseTo(3.2);
    expect(r.yaw).toBeCloseTo(0.78);
    expect(r.level).toBe('L1');
    expect(r.fleet).toBe('freebotics');
  });

  test('battery_percent mapeado para battery no robotList', () => {
    useFleetStore.setState({ robots: [mockRobotRMF] });
    const { result } = renderHook(() => useFleetState());

    expect(result.current.robots[0].battery).toBe(85);
  });

  test('tasks retorna tasks do store sem transformação', () => {
    const mockTask = {
      id: 'task_001', category: 'delivery', state: 'pending',
      start: { x: 0, y: 0 }, goal: { x: 1, y: 1 },
      created_at: '2026-04-28T10:00:00Z', updated_at: '2026-04-28T10:00:00Z',
    };
    useFleetStore.setState({ tasks: [mockTask] });
    const { result } = renderHook(() => useFleetState());

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]).toEqual(mockTask);
  });

  test('connectionStatus reflete store', () => {
    useFleetStore.setState({ connectionStatus: 'connected' });
    const { result } = renderHook(() => useFleetState());
    expect(result.current.connectionStatus).toBe('connected');

    useFleetStore.setState({ connectionStatus: 'error' });
    const { result: r2 } = renderHook(() => useFleetState());
    expect(r2.current.connectionStatus).toBe('error');
  });

  test('formato REST-API (id/battery/status) também é suportado', () => {
    useFleetStore.setState({ robots: [mockRobotAlt] });
    const { result } = renderHook(() => useFleetState());
    const r = result.current.robots[0];

    expect(r.id).toBe('robot_02');
    expect(r.battery).toBe(62);
    expect(r.level).toBe('L2');
  });

});
