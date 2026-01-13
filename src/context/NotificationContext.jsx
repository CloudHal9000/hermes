import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import PropTypes from 'prop-types';

const NotificationContext = createContext();

export function NotificationProvider({ children, onNotification }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, duration = 4000) => {
    const id = Date.now();
    
    setNotifications(prev => [...prev, { id, message }]);

    // Remove a notificação após o duration
    setTimeout(() => {
      setNotifications(prev => prev.filter(notif => notif.id !== id));
    }, duration);

    return id;
  }, []);

  // Notificar o componente pai quando notificações mudam
  useEffect(() => {
    if (onNotification) {
      onNotification(notifications);
    }
  }, [notifications, onNotification]);

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification deve ser usado dentro de NotificationProvider');
  }
  return context;
}

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
  onNotification: PropTypes.func
};
