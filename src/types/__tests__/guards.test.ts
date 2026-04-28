import { describe, test, expect } from 'vitest';
import {
  isFleetState,
  isTaskState,
  isRMFWebSocketEvent,
} from '../guards';
import {
  mockFleetState1Robot,
  mockFleetState5Robots,
  mockTaskExecuting,
  mockWsFleetStateEvent,
  mockWsTaskUpdateEvent,
} from '../../test/mocks/rmfApi';

describe('isFleetState', () => {
  test('aceita FleetState válido com 1 robô', () => {
    expect(isFleetState(mockFleetState1Robot)).toBe(true);
  });

  test('aceita FleetState válido com 5 robôs', () => {
    expect(isFleetState(mockFleetState5Robots)).toBe(true);
  });

  test('rejeita objeto sem campo robots', () => {
    expect(isFleetState({ tasks: [] })).toBe(false);
    expect(isFleetState({ robots: 'not-an-array' })).toBe(false);
  });

  test('rejeita null e undefined', () => {
    expect(isFleetState(null)).toBe(false);
    expect(isFleetState(undefined)).toBe(false);
    expect(isFleetState(42)).toBe(false);
  });

  test('rejeita FleetState com robot sem id', () => {
    const invalid = {
      robots: [{ status: 'idle', fleet_name: 'x', battery: 50, location: { x: 0, y: 0, yaw: 0, level: 'L1' } }],
      tasks: [],
    };
    expect(isFleetState(invalid)).toBe(false);
  });
});

describe('isTaskState', () => {
  test('aceita TaskState com todos os campos obrigatórios', () => {
    expect(isTaskState(mockTaskExecuting)).toBe(true);
  });

  test('rejeita TaskState com state inválido', () => {
    const invalid = { ...mockTaskExecuting, state: 'running' };
    expect(isTaskState(invalid)).toBe(false);

    const missingState = { ...mockTaskExecuting };
    delete (missingState as Partial<typeof missingState>).state;
    expect(isTaskState(missingState)).toBe(false);
  });
});

describe('isRMFWebSocketEvent', () => {
  test('aceita evento fleet_state_update com payload válido', () => {
    expect(isRMFWebSocketEvent(mockWsFleetStateEvent)).toBe(true);
  });

  test('aceita evento task_update com payload válido', () => {
    expect(isRMFWebSocketEvent(mockWsTaskUpdateEvent)).toBe(true);
  });

  test('rejeita evento com type desconhecido', () => {
    const unknown = { type: 'robot_disconnected', payload: {}, timestamp: '2026-04-28T10:00:00Z' };
    expect(isRMFWebSocketEvent(unknown)).toBe(false);
  });
});
