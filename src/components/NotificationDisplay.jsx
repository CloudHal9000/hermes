import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

export function NotificationDisplay({ notifications }) {
  const [fadingOut, setFadingOut] = useState(new Set());

  useEffect(() => {
    if (notifications.length === 0) {
      setFadingOut(new Set());
    }
  }, [notifications]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
        zIndex: 9999
      }}
    >
      {notifications.map(notif => (
        <div
          key={notif.id}
          style={{
            background: 'rgba(30, 32, 44, 0.95)',
            border: '1px solid rgba(0, 210, 106, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#fff',
            fontSize: '0.9rem',
            fontFamily: 'monospace',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            animation: fadingOut.has(notif.id)
              ? 'fadeOut 0.3s ease-out forwards'
              : 'fadeIn 0.3s ease-out',
            pointerEvents: 'auto',
            maxWidth: '300px',
            wordWrap: 'break-word'
          }}
        >
          {notif.message}
        </div>
      ))}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(10px);
          }
        }
      `}</style>
    </div>
  );
}

NotificationDisplay.propTypes = {
  notifications: PropTypes.array.isRequired
};
