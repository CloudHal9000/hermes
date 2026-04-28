/**
 * electron/preload.js — Context Bridge for secure Electron ↔ Renderer communication
 *
 * Exposes electronAPI to the renderer process via contextBridge.
 * This is the ONLY way renderer can access Electron features.
 */

import { contextBridge, ipcRenderer } from 'electron';

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
