/**
 * Centralised RMF API client — injects auth on every request.
 *
 * REST:      rmfFetch(path, options)   → adds Authorization: Bearer <token>
 * WebSocket: rmfWebSocket(path)        → adds ?token=<token> to URL
 *
 * Both surface 401/403 via a dispatched 'rmf:auth-error' CustomEvent so any
 * component can react (show a toast, redirect, etc.) without coupling to this
 * module's internals.
 *
 * See docs/auth-spec.md for security considerations and roadmap.
 */

// Cache for dynamically fetched URLs (Electron mode)
let cachedUrls = null;
let urlsFetchInProgress = false;

// Default URLs (env vars or hardcoded fallback)
const DEFAULT_RMF_BASE_URL = import.meta.env.VITE_RMF_API_URL ?? 'http://localhost:7878';
const DEFAULT_RMF_WS_URL   = import.meta.env.VITE_RMF_WS_URL  ?? 'ws://localhost:7878';
const RMF_TOKEN            = import.meta.env.VITE_RMF_TOKEN    ?? '';

// Synchronous getter for RMF base URL (uses cache to avoid async overhead)
function getRMFBaseUrlSync() {
  if (cachedUrls) return cachedUrls.rmfApiUrl;
  return DEFAULT_RMF_BASE_URL;
}

// Synchronous getter for RMF WebSocket URL
function getRMFWsUrlSync() {
  if (cachedUrls) return cachedUrls.rosbridgeUrl;
  return DEFAULT_RMF_WS_URL;
}

// Async function to fetch URLs from electronSettings (called once on app init)
export async function initRMFUrls() {
  if (urlsFetchInProgress) return;
  urlsFetchInProgress = true;

  try {
    if (window.electronAPI?.getSettings) {
      const settings = await window.electronAPI.getSettings();
      cachedUrls = settings;
      console.info('[rmfClient] Loaded dynamic RMF URLs from Electron store');
    }
  } catch (error) {
    console.warn('[rmfClient] Failed to load dynamic URLs:', error);
  }

  urlsFetchInProgress = false;
}

// Warn at startup — visible in browser console, not in production builds
// when the variable is empty (a misconfigured env is caught early).
if (!RMF_TOKEN) {
  console.warn(
    '[rmfClient] VITE_RMF_TOKEN não definida — requests vão sem auth.\n' +
    'Copie .env.example para .env.local e preencha o token.'
  );
} else {
  // Log expiry from JWT payload so devs notice an expired stub token.
  try {
    const payload = JSON.parse(atob(RMF_TOKEN.split('.')[1]));
    if (payload.exp) {
      const exp = new Date(payload.exp * 1000);
      console.info(`[rmfClient] Token configurado (JWT, exp: ${exp.toISOString()})`);
    }
  } catch {
    // Not a decodable JWT — treat as opaque token (plain API key fallback).
    console.info('[rmfClient] Token configurado (opaque)');
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function authHeaders() {
  return RMF_TOKEN ? { Authorization: `Bearer ${RMF_TOKEN}` } : {};
}

function emitAuthError(status, path) {
  window.dispatchEvent(
    new CustomEvent('rmf:auth-error', {
      detail: { status, path },
      bubbles: true,
    })
  );
}

// ─── REST client ──────────────────────────────────────────────────────────────

/**
 * Drop-in wrapper around fetch() that:
 *   - Resolves `path` against VITE_RMF_API_URL
 *   - Injects Authorization: Bearer header
 *   - Throws on 401/403 and emits 'rmf:auth-error'
 *   - Throws on other non-ok responses (caller handles HTTP errors)
 *
 * @param {string} path  — e.g. '/fleet_states' or '/tasks'
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export async function rmfFetch(path, options = {}) {
  const baseUrl = getRMFBaseUrlSync();
  const url = `${baseUrl}${path}`;

  const mergedOptions = {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
  };

  const response = await fetch(url, mergedOptions);

  if (response.status === 401 || response.status === 403) {
    emitAuthError(response.status, path);
    throw new RMFAuthError(response.status, path);
  }

  if (!response.ok) {
    throw new RMFResponseError(response.status, path, response);
  }

  return response;
}

// ─── WebSocket client ─────────────────────────────────────────────────────────

/**
 * Opens a WebSocket to the RMF API Server with auth injected as a query param.
 *
 * WebSocket browser API does not support custom headers on the upgrade request,
 * so the token is passed as `?token=<jwt>` — the open-RMF server validates it
 * during the HTTP handshake.
 *
 * @param {string} path  — e.g. '/fleet_states'
 * @returns {WebSocket}
 */
export function rmfWebSocket(path) {
  const wsUrl = getRMFWsUrlSync();
  const tokenParam = RMF_TOKEN ? `?token=${encodeURIComponent(RMF_TOKEN)}` : '';
  const url = `${wsUrl}${path}${tokenParam}`;

  const ws = new WebSocket(url);

  // Surface auth failures: the server may close with code 1008 (policy
  // violation) or 4001 (custom auth error). Check onclose to emit the event.
  ws.addEventListener('close', (evt) => {
    if (evt.code === 1008 || evt.code === 4001) {
      emitAuthError(401, path);
    }
  });

  return ws;
}

// ─── Error types ─────────────────────────────────────────────────────────────

export class RMFAuthError extends Error {
  constructor(status, path) {
    super(`RMF auth error ${status} on ${path}`);
    this.name = 'RMFAuthError';
    this.status = status;
    this.path = path;
  }
}

export class RMFResponseError extends Error {
  constructor(status, path, response) {
    super(`RMF response error ${status} on ${path}`);
    this.name = 'RMFResponseError';
    this.status = status;
    this.path = path;
    this.response = response;
  }
}
