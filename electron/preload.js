/**
 * electron/preload.js — Context Bridge for secure Electron ↔ Renderer communication
 *
 * Exposes electronAPI to the renderer process via contextBridge.
 * This is the ONLY way renderer can access Electron features.
 *
 * ALSO: Inject external libraries (roslib, eventemitter2) before React loads.
 * This is necessary because:
 *   1. roslib/eventemitter2 are ESM bundles that expect to be loaded early
 *   2. Electron + Vite relative paths (base='./') can cause module resolution issues
 *   3. Preload runs before main.jsx, ensuring window.ROSLIB is available
 */

import { contextBridge, ipcRenderer } from 'electron';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(import.meta.url).replace(/\/[^/]+$/, '');

// Inject roslib and eventemitter2 into the window before React initializes
function injectExternalLibraries() {
  // Determine where dist/lib files are located
  const distLibPath = resolve(__dirname, '../dist/lib');

  // Helper to safely inject a script
  const injectScript = (filename) => {
    try {
      const filePath = resolve(distLibPath, filename);
      const code = readFileSync(filePath, 'utf-8');
      const script = document.createElement('script');
      script.textContent = code;
      document.head.appendChild(script);
      console.log(`[preload] Injected ${filename} into window`);
    } catch (error) {
      console.warn(`[preload] Failed to inject ${filename}:`, error.message);
    }
  };

  // Inject in order (eventemitter2 first, then roslib which depends on it)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectScript('eventemitter2.min.js');
      injectScript('roslib.js');
    });
  } else {
    // Already loaded (unlikely but safe)
    injectScript('eventemitter2.min.js');
    injectScript('roslib.js');
  }
}

// Run injection before contextBridge setup
injectExternalLibraries();

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Settings (persistent across app restarts) ──────────────────────────────
  // Read current settings from electron-store
  getSettings: () => ipcRenderer.invoke('settings:get'),

  // Save settings (partial update via newSettings object)
  saveSettings: (settings) => ipcRenderer.invoke('settings:set', settings),

  // Reset connection settings to defaults
  resetSettings: () => ipcRenderer.invoke('settings:reset'),

  // ── Environment info ──────────────────────────────────────────────────────
  // Platform string ('linux', 'darwin', 'win32')
  platform: process.platform,

  // Signal that the app is running in Electron (not browser)
  isElectron: true,
});
