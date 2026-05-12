/**
 * electron/main.js — Hermes Electron main process
 *
 * Responsibilities:
 *   - Create and manage the main BrowserWindow
 *   - Persist window bounds and user settings via electron-store
 *   - Expose settings to renderer via IPC handlers
 *   - Configure CSP to allow ws:// connections to RMF API + rosbridge
 */

import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Persistent user settings ───────────────────────────────────────────────────
const store = new Store({
  defaults: {
    rmfApiUrl:    'http://localhost:7878',
    rosbridgeUrl: 'ws://localhost:9090',
    robotIp:      'localhost',
    windowBounds: { width: 1400, height: 900 },
  },
});

// ── Window factory ────────────────────────────────────────────────────────────
function createWindow() {
  const { width, height } = store.get('windowBounds');

  const win = new BrowserWindow({
    width,
    height,
    minWidth:  1024,
    minHeight: 600,
    title:     'Hermes — Fleet Dashboard',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // renderer cannot access Node.js APIs directly
      nodeIntegration:  false,  // renderer runs as a normal web page
      sandbox:          false,  // required for preload to use contextBridge
    },
  });

  // ── Load page ─────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    // Dev: connect to Vite HMR server
    win.loadURL('http://localhost:5173').catch(() => {
      // If Vite isn't running, fall back to built output
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    });
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // ── Persist window size on close ──────────────────────────────────────────
  win.on('close', () => {
    store.set('windowBounds', win.getBounds());
  });

  // ── External links open in system browser ─────────────────────────────────
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── CSP: allow WebSocket connections to RMF API and rosbridge ─────────────────
// Must be configured before the window loads any content.
app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "connect-src 'self' http: https: ws: wss:; " +
          "img-src 'self' data: blob:; " +
          "font-src 'self' data:; " +
          "worker-src 'self' blob:;"
        ],
      },
    });
  });

  createWindow();
});

app.on('window-all-closed', () => app.quit());

// Re-open window on macOS dock click (not needed for Linux but harmless)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC handlers — settings bridge ────────────────────────────────────────────

// Read all settings
ipcMain.handle('settings:get', () => store.store);

// Write settings (partial update — only provided keys are changed)
ipcMain.handle('settings:set', (_event, newSettings) => {
  Object.entries(newSettings).forEach(([key, value]) => {
    store.set(key, value);
  });
  return store.store;
});

// Reset connection settings to defaults
ipcMain.handle('settings:reset', () => {
  store.reset('rmfApiUrl', 'rosbridgeUrl', 'robotIp');
  return store.store;
});
