import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFleetStore } from '../../store/fleetStore';
import { mockFleetState1Robot, mockWsFleetStateEvent } from '../../test/mocks/rmfApi';

// Mock rmfClient before importing the hook (Vitest hoists vi.mock)
vi.mock('../../lib/rmfClient', () => ({
  rmfWebSocket: vi.fn(),
  rmfFetch:     vi.fn(),
  RMFAuthError:    class extends Error { constructor(...a) { super(...a); this.name = 'RMFAuthError'; } },
  RMFResponseError: class extends Error { constructor(...a) { super(...a); this.name = 'RMFResponseError'; } },
}));

// Import AFTER vi.mock so we get the mocked versions
import { rmfWebSocket, rmfFetch } from '../../lib/rmfClient';
import { useRMFApi } from '../useRMFApi';

// ── Mock WebSocket factory ─────────────────────────────────────────────────────
function makeMockWs() {
  return {
    onopen:    null,
    onclose:   null,
    onerror:   null,
    onmessage: null,
    readyState: 0,   // CONNECTING
    close: vi.fn(function() {
      if (this.onclose) this.onclose({ code: 1000 });
    }),
  };
}

let mockWs;

beforeEach(() => {
  useFleetStore.getState().reset();
  vi.clearAllMocks();
  mockWs = makeMockWs();
  rmfWebSocket.mockReturnValue(mockWs);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('useRMFApi', () => {

  test('setConnectionStatus connected quando WebSocket abre', () => {
    renderHook(() => useRMFApi());

    act(() => { mockWs.onopen?.(); });

    expect(useFleetStore.getState().connectionStatus).toBe('connected');
  });

  test('setConnectionStatus disconnected quando WebSocket fecha', () => {
    const { unmount } = renderHook(() => useRMFApi());
    act(() => { mockWs.onopen?.(); });

    // Prevent auto-reconnect triggering in this test
    const ws = mockWs;
    ws.close = vi.fn(); // override to avoid recursive close call
    act(() => { ws.onclose?.({ code: 1006 }); });

    expect(useFleetStore.getState().connectionStatus).toBe('disconnected');
    unmount();
  });

  test('chama setFleetState quando recebe evento válido', () => {
    renderHook(() => useRMFApi());
    act(() => { mockWs.onopen?.(); });

    act(() => {
      mockWs.onmessage?.({ data: JSON.stringify(mockWsFleetStateEvent) });
    });

    expect(useFleetStore.getState().robots).toHaveLength(
      mockFleetState1Robot.robots.length
    );
  });

  test('ignora eventos inválidos (isRMFWebSocketEvent falha)', () => {
    renderHook(() => useRMFApi());
    act(() => { mockWs.onopen?.(); });

    act(() => {
      mockWs.onmessage?.({ data: JSON.stringify({
        type: 'unknown_event', payload: {}, timestamp: '2026-04-28T10:00:00Z'
      }) });
    });

    expect(useFleetStore.getState().robots).toHaveLength(0);
  });

  test('ignora JSON malformado sem lançar erro', () => {
    renderHook(() => useRMFApi());
    act(() => { mockWs.onopen?.(); });

    expect(() => {
      act(() => { mockWs.onmessage?.({ data: 'not-valid-json' }); });
    }).not.toThrow();

    expect(useFleetStore.getState().robots).toHaveLength(0);
  });

  test('createTask chama rmfFetch com payload correto', async () => {
    rmfFetch.mockResolvedValueOnce({ json: async () => ({ task_id: 'task_abc123' }) });
    const { result } = renderHook(() => useRMFApi());

    const taskRequest = { category: 'navigation', start: { x: 0, y: 0 }, goal: { x: 5, y: 5 } };
    let response;
    await act(async () => { response = await result.current.createTask(taskRequest); });

    expect(rmfFetch).toHaveBeenCalledWith('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskRequest),
    });
    expect(response.task_id).toBe('task_abc123');
  });

  test('createTask retorna task_id em sucesso', async () => {
    rmfFetch.mockResolvedValueOnce({ json: async () => ({ task_id: 'task_xyz999' }) });
    const { result } = renderHook(() => useRMFApi());

    let response;
    await act(async () => {
      response = await result.current.createTask({
        category: 'delivery', start: { x: 0, y: 0 }, goal: { x: 1, y: 1 },
      });
    });

    expect(response.task_id).toBe('task_xyz999');
  });

  test('cancelTask chama rmfFetch com DELETE e taskId correto', async () => {
    rmfFetch.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useRMFApi());

    await act(async () => { await result.current.cancelTask('task_abc123'); });

    expect(rmfFetch).toHaveBeenCalledWith('/tasks/task_abc123', { method: 'DELETE' });
  });

  test('reconecta após desconexão com backoff', async () => {
    vi.useFakeTimers();

    const firstWs = mockWs;
    const secondWs = makeMockWs();
    // Second call to rmfWebSocket (after reconnect) returns a new mock
    rmfWebSocket.mockReturnValueOnce(firstWs).mockReturnValueOnce(secondWs);

    const { unmount } = renderHook(() => useRMFApi());
    act(() => { firstWs.onopen?.(); });

    // Disconnect without triggering the close mock (avoid recursive)
    firstWs.close = vi.fn();
    act(() => { firstWs.onclose?.({ code: 1006 }); });
    expect(useFleetStore.getState().connectionStatus).toBe('disconnected');

    // Advance past first backoff interval (1000ms for attempt #1)
    await act(async () => { vi.advanceTimersByTime(1100); });

    // Second WebSocket should have been created
    expect(rmfWebSocket).toHaveBeenCalledTimes(2);
    unmount();
  });

});
