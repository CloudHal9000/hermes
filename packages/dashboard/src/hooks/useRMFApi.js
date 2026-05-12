/**
 * useRMFApi — RMF API Server connection hook
 *
 * Manages the WebSocket connection to /fleet_states and exposes REST helpers.
 * Never calls fetch() or the WebSocket constructor directly — all I/O goes through
 * src/lib/rmfClient.js (which injects JWT Bearer auth).
 *
 * WebSocket events are validated with isRMFWebSocketEvent() + isFleetState()
 * before being dispatched to the Zustand fleetStore.
 *
 * Usage:
 *   const { connectionStatus, createTask, cancelTask } = useRMFApi();
 *   const { robots, tasks } = useFleetStore(); // populated by this hook
 */

import { useEffect, useRef, useCallback } from 'react';
import { rmfFetch, rmfWebSocket } from '../lib/rmfClient';
import { isFleetState, isRMFWebSocketEvent } from '../types/guards';
import { useFleetStore } from '../store/fleetStore';

const MAX_BACKOFF_MS = 30_000;

function backoffMs(attempt) {
  return Math.min(1000 * 2 ** (attempt - 1), MAX_BACKOFF_MS);
}

export function useRMFApi() {
  const wsRef             = useRef(null);
  const reconnectTimerRef = useRef(null);
  const attemptsRef       = useRef(0);
  const unmountedRef      = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      const ws = rmfWebSocket('/fleet_states');
      wsRef.current = ws;

      useFleetStore.getState().setConnectionStatus('connecting');

      ws.onopen = () => {
        if (unmountedRef.current) return;
        attemptsRef.current = 0;
        useFleetStore.getState().setConnectionStatus('connected');
      };

      ws.onmessage = ({ data }) => {
        if (unmountedRef.current) return;
        try {
          const parsed = JSON.parse(data);
          if (!isRMFWebSocketEvent(parsed)) return;
          if (parsed.type === 'fleet_state_update' && isFleetState(parsed.payload)) {
            useFleetStore.getState().setFleetState(parsed.payload);
          }
        } catch {
          // invalid JSON — silently discard
        }
      };

      ws.onerror = () => {
        if (unmountedRef.current) return;
        useFleetStore.getState().setConnectionStatus('error');
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        useFleetStore.getState().setConnectionStatus('disconnected');
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (reconnectTimerRef.current) return;
      attemptsRef.current += 1;
      const delay = backoffMs(attemptsRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!unmountedRef.current) connect();
      }, delay);
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on explicit close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // ── REST helpers ────────────────────────────────────────────────────────────

  const createTask = useCallback(async (taskRequest) => {
    const res = await rmfFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskRequest),
    });
    return res.json();
  }, []);

  const cancelTask = useCallback(async (taskId) => {
    await rmfFetch(`/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
  }, []);

  const getTask = useCallback(async (taskId) => {
    const res = await rmfFetch(`/tasks/${encodeURIComponent(taskId)}`);
    return res.json();
  }, []);

  const connectionStatus = useFleetStore(state => state.connectionStatus);

  return { connectionStatus, createTask, cancelTask, getTask };
}
