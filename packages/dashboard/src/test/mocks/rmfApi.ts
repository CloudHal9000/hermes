/**
 * Fixtures for RMF API types.
 *
 * Use in tests that need realistic fleet/task data without a real RMF server.
 * All fixtures satisfy the corresponding type guards (isFleetState, isTaskState, etc.).
 */

import type { FleetState, RobotState, TaskState, RMFWebSocketEvent } from '../../types/rmf';

// ─── Robot fixtures ───────────────────────────────────────────────────────────

export const mockRobot1: RobotState = {
  id: 'robot_01',
  status: 'idle',
  fleet_name: 'freebotics',
  battery: 85,
  location: { x: 1.0, y: 2.0, yaw: 0.0, level: 'L1' },
};

export const mockRobot2: RobotState = {
  id: 'robot_02',
  status: 'moving',
  fleet_name: 'freebotics',
  battery: 62,
  location: { x: 5.5, y: 3.1, yaw: 1.57, level: 'L1' },
};

// ─── Task fixtures ────────────────────────────────────────────────────────────

export const mockTaskPending: TaskState = {
  id: 'task_001',
  category: 'delivery',
  state: 'pending',
  start: { x: 0, y: 0 },
  goal: { x: 10, y: 5 },
  created_at: '2026-04-28T10:00:00Z',
  updated_at: '2026-04-28T10:00:00Z',
};

export const mockTaskExecuting: TaskState = {
  id: 'task_002',
  category: 'navigation',
  state: 'executing',
  assigned_robot_id: 'robot_01',
  start: { x: 1, y: 1 },
  goal: { x: 8, y: 4 },
  created_at: '2026-04-28T10:01:00Z',
  updated_at: '2026-04-28T10:02:30Z',
};

export const mockTaskCompleted: TaskState = {
  id: 'task_000',
  category: 'patrol',
  state: 'completed',
  assigned_robot_id: 'robot_02',
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 3 },
  created_at: '2026-04-28T09:00:00Z',
  updated_at: '2026-04-28T09:45:00Z',
};

// ─── FleetState fixtures ──────────────────────────────────────────────────────

export const mockFleetState1Robot: FleetState = {
  robots: [mockRobot1],
  tasks: [mockTaskExecuting],
};

export const mockFleetState5Robots: FleetState = {
  robots: [
    mockRobot1,
    mockRobot2,
    { id: 'robot_03', status: 'charging', fleet_name: 'freebotics', battery: 12, location: { x: 0, y: 0, yaw: 0, level: 'L1' } },
    { id: 'robot_04', status: 'error',    fleet_name: 'freebotics', battery: 45, location: { x: 2, y: 8, yaw: 3.14, level: 'L2' } },
    { id: 'robot_05', status: 'idle',     fleet_name: 'freebotics', battery: 99, location: { x: 7, y: 1, yaw: 0.78, level: 'L1' } },
  ],
  tasks: [mockTaskPending, mockTaskExecuting, mockTaskCompleted],
};

// ─── WebSocket event fixtures ─────────────────────────────────────────────────

export const mockWsFleetStateEvent: RMFWebSocketEvent = {
  type: 'fleet_state_update',
  payload: mockFleetState1Robot,
  timestamp: '2026-04-28T10:05:00Z',
};

export const mockWsTaskUpdateEvent: RMFWebSocketEvent = {
  type: 'task_update',
  payload: mockTaskExecuting,
  timestamp: '2026-04-28T10:05:30Z',
};

// ─── Error simulation helpers ─────────────────────────────────────────────────

/** Simulates a 401 response from rmfFetch */
export function mockUnauthorizedResponse(): Response {
  return new Response(JSON.stringify({ detail: 'Not authenticated' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Simulates a network-level failure */
export function mockNetworkError(): Promise<never> {
  return Promise.reject(new TypeError('Failed to fetch'));
}
