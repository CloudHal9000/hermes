/**
 * src/lib/electronSettings.js — Abstraction layer for persistent settings
 *
 * Provides a unified interface to read/save settings in both Electron and browser.
 * In browser: env vars are used as fallback (immutable at runtime)
 * In Electron: electron-store persists across app restarts
 */

const DEFAULT_SETTINGS = {
  rmfApiUrl:    import.meta.env.VITE_RMF_API_URL ?? 'http://localhost:7878',
  rosbridgeUrl: import.meta.env.VITE_RMF_WS_URL ?? 'ws://localhost:9090',
  robotIp:      import.meta.env.VITE_ROBOT_IP ?? 'localhost',
};

/**
 * Get current settings (from Electron store or env vars)
 */
export async function getSettings() {
  if (window.electronAPI?.getSettings) {
    return window.electronAPI.getSettings();
  }
  // Fallback: return env var defaults (browser mode)
  return DEFAULT_SETTINGS;
}

/**
 * Save settings (only works in Electron; no-op in browser)
 */
export async function saveSettings(settings) {
  if (window.electronAPI?.saveSettings) {
    return window.electronAPI.saveSettings(settings);
  }
  // Fallback: warn user that settings are not persistent
  console.warn('[electronSettings] saveSettings: not in Electron, settings will not persist');
  return settings;
}

/**
 * Reset settings to defaults (only works in Electron)
 */
export async function resetSettings() {
  if (window.electronAPI?.resetSettings) {
    return window.electronAPI.resetSettings();
  }
  console.warn('[electronSettings] resetSettings: not in Electron, cannot reset');
  return DEFAULT_SETTINGS;
}

/**
 * Detect if running in Electron
 */
export function isRunningInElectron() {
  return window.electronAPI?.isElectron === true;
}
