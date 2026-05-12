/**
 * Hermes RMF API Client
 * Wrapper para HTTP REST + Socket.IO contra o RMF API Server
 */
import { io } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_RMF_API_URL || 'http://localhost:8000';
const TOKEN = import.meta.env.VITE_RMF_TOKEN || '';

const authHeaders = () => ({
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
});

// --- REST ---

export async function fetchFleets() {
  const res = await fetch(`${BASE_URL}/fleets`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`fetchFleets failed: ${res.status}`);
  return res.json(); // array de fleet names
}

export async function fetchFleetState(fleetName) {
  const res = await fetch(`${BASE_URL}/fleets/${fleetName}/state`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`fetchFleetState failed: ${res.status}`);
  return res.json();
}

export async function fetchTasks() {
  const res = await fetch(`${BASE_URL}/tasks`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`fetchTasks failed: ${res.status}`);
  return res.json();
}

export async function dispatchTask(taskPayload) {
  const res = await fetch(`${BASE_URL}/tasks/dispatch_task`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(taskPayload),
  });
  if (!res.ok) throw new Error(`dispatchTask failed: ${res.status}`);
  return res.json();
}

// --- Socket.IO ---

let socketInstance = null;

export function getRmfSocket() {
  if (!socketInstance) {
    socketInstance = io(BASE_URL, {
      path: '/socket.io',
      auth: { token: TOKEN },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      console.log('[Hermes] Socket.IO conectado ao RMF API Server');
    });

    socketInstance.on('disconnect', (reason) => {
      console.warn('[Hermes] Socket.IO desconectado:', reason);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('[Hermes] Socket.IO erro:', err.message);
    });
  }

  return socketInstance;
}