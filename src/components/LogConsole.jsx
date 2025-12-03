import { useEffect, useState, useRef } from 'react';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';

export function LogConsole({ ros }) {
  const [logs, setLogs] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!ros) return;

    const logListener = new ROSLIB.Topic({
      ros: ros,
      name: '/rosout',
      messageType: 'rcl_interfaces/msg/Log' // Padrão ROS 2
    });

    logListener.subscribe((msg) => {
      setLogs(prev => {
        // Mantém apenas as últimas 50 mensagens para não travar o site
        const newLogs = [...prev, msg];
        if (newLogs.length > 50) newLogs.shift();
        return newLogs;
      });
    });

    return () => logListener.unsubscribe();
  }, [ros]);

  // Auto-scroll para baixo sempre que chegar mensagem nova
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Função para dar cor dependendo da gravidade do erro
  const getColor = (level) => {
    if (level >= 40) return '#ff4b5c'; // ERROR/FATAL (Vermelho)
    if (level === 30) return '#f6d365'; // WARN (Amarelo)
    return '#ccc'; // INFO/DEBUG (Cinza)
  };

  return (
    <div style={{ 
      background: '#0a0c12', 
      border: '1px solid #333', 
      borderRadius: '6px', 
      height: '150px', 
      overflowY: 'auto',
      padding: '5px',
      fontSize: '0.7rem',
      fontFamily: 'monospace',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px'
    }}>
      <div style={{ position: 'sticky', top: 0, background: '#0a0c12', borderBottom: '1px solid #333', marginBottom: '2px', fontWeight: 'bold', color: '#666' }}>
        {"> SYSTEM LOGS"}
      </div>

      {logs.length === 0 && <span style={{opacity:0.3, fontStyle:'italic'}}>Aguardando logs...</span>}

      {logs.map((log, i) => (
        <div key={i} style={{ color: getColor(log.level), wordBreak: 'break-all' }}>
           <span style={{ opacity: 0.5 }}>[{new Date().toLocaleTimeString()}]</span> {log.msg}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

LogConsole.propTypes = { ros: PropTypes.object };