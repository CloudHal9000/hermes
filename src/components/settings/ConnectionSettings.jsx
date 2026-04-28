/**
 * src/components/settings/ConnectionSettings.jsx — Configuration UI for RMF and rosbridge URLs
 *
 * Modal panel that allows users to configure:
 * - RMF API URL (http://localhost:7878)
 * - rosbridge WebSocket URL (ws://localhost:9090)
 * - Robot IP (legacy fallback)
 *
 * Changes are persisted via electron-store in Electron, or shown as unsaved in browser.
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getSettings, saveSettings, resetSettings, isRunningInElectron } from '../../lib/electronSettings';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: 'rgba(15, 17, 26, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '480px',
    width: '90%',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  },
  title: {
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '20px',
    marginTop: 0,
  },
  section: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '12px',
    fontWeight: 500,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: 'monospace',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
  },
  inputFocus: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    outline: 'none',
  },
  note: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '11px',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  noteWarning: {
    background: 'rgba(255, 165, 0, 0.1)',
    border: '1px solid rgba(255, 165, 0, 0.3)',
    color: 'rgba(255, 165, 0, 0.8)',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    marginTop: '12px',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
    justifyContent: 'flex-end',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  buttonPrimary: {
    background: 'rgba(100, 200, 255, 0.8)',
    color: '#000',
  },
  buttonPrimaryHover: {
    background: 'rgba(100, 200, 255, 1)',
  },
  buttonSecondary: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
  },
  buttonSecondaryHover: {
    background: 'rgba(255, 255, 255, 0.15)',
  },
  buttonDanger: {
    background: 'rgba(255, 100, 100, 0.2)',
    color: 'rgba(255, 100, 100, 0.9)',
  },
  buttonDangerHover: {
    background: 'rgba(255, 100, 100, 0.3)',
  },
};

export const ConnectionSettings = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState({
    rmfApiUrl: 'http://localhost:7878',
    rosbridgeUrl: 'ws://localhost:9090',
    robotIp: 'localhost',
  });

  const [loading, setLoading] = useState(false);
  const isElectron = isRunningInElectron();

  // Load settings on mount or when modal opens
  useEffect(() => {
    if (isOpen) {
      getSettings().then(s => setSettings(s));
    }
  }, [isOpen]);

  const handleInputChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveAndReconnect = async () => {
    setLoading(true);
    try {
      await saveSettings(settings);
      // Trigger a reload/reconnect by dispatching a custom event
      // Components listening to this can reinitialize their connections
      window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));

      if (isElectron) {
        // In Electron, settings are persisted automatically
        console.log('[ConnectionSettings] Settings saved and persisted');
      } else {
        console.log('[ConnectionSettings] Settings updated (not persisted in browser)');
      }
      onClose();
    } catch (error) {
      console.error('[ConnectionSettings] Failed to save settings:', error);
    }
    setLoading(false);
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const resetSettings_result = await resetSettings();
      setSettings(resetSettings_result);
      console.log('[ConnectionSettings] Settings reset to defaults');
    } catch (error) {
      console.error('[ConnectionSettings] Failed to reset settings:', error);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 style={styles.title}>⚙️ Connection Settings</h2>

        <div style={styles.section}>
          <label style={styles.label}>RMF API URL</label>
          <input
            type="text"
            value={settings.rmfApiUrl}
            onChange={e => handleInputChange('rmfApiUrl', e.target.value)}
            placeholder="http://localhost:7878"
            style={{ ...styles.input }}
            onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
            onBlur={e => Object.assign(e.target.style, { background: styles.input.background })}
          />
          <div style={styles.note}>RMF API Server endpoint (REST + WebSocket)</div>
        </div>

        <div style={styles.section}>
          <label style={styles.label}>rosbridge WebSocket URL</label>
          <input
            type="text"
            value={settings.rosbridgeUrl}
            onChange={e => handleInputChange('rosbridgeUrl', e.target.value)}
            placeholder="ws://localhost:9090"
            style={{ ...styles.input }}
            onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
            onBlur={e => Object.assign(e.target.style, { background: styles.input.background })}
          />
          <div style={styles.note}>WebSocket for costmap and LiDAR sensor data (legacy)</div>
        </div>

        <div style={styles.section}>
          <label style={styles.label}>Robot IP (Legacy)</label>
          <input
            type="text"
            value={settings.robotIp}
            onChange={e => handleInputChange('robotIp', e.target.value)}
            placeholder="localhost"
            style={{ ...styles.input }}
            onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
            onBlur={e => Object.assign(e.target.style, { background: styles.input.background })}
          />
          <div style={styles.note}>IP address for legacy rosbridge connections</div>
        </div>

        {!isElectron && (
          <div style={styles.noteWarning}>
            ⚠️ Persistent settings are only available in the Electron app. In browser mode, changes will be lost on refresh.
          </div>
        )}

        <div style={styles.buttons}>
          <button
            style={{ ...styles.button, ...styles.buttonDanger }}
            onMouseEnter={e => Object.assign(e.target.style, styles.buttonDangerHover)}
            onMouseLeave={e => Object.assign(e.target.style, styles.buttonDanger)}
            onClick={handleReset}
            disabled={loading}
          >
            Reset to Defaults
          </button>

          <button
            style={{ ...styles.button, ...styles.buttonSecondary }}
            onMouseEnter={e => Object.assign(e.target.style, styles.buttonSecondaryHover)}
            onMouseLeave={e => Object.assign(e.target.style, styles.buttonSecondary)}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            style={{ ...styles.button, ...styles.buttonPrimary }}
            onMouseEnter={e => Object.assign(e.target.style, styles.buttonPrimaryHover)}
            onMouseLeave={e => Object.assign(e.target.style, styles.buttonPrimary)}
            onClick={handleSaveAndReconnect}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save & Reconnect'}
          </button>
        </div>
      </div>
    </div>
  );
};

ConnectionSettings.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
