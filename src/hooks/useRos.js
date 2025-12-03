import { useState, useEffect } from 'react';
import * as ROSLIB from 'roslib';

// Configuração inicial
const ROBOT_IP = "192.168.0.39"; 
const WEBSOCKET_URL = `ws://${ROBOT_IP}:9090`;

export function useRos() {
  const [isConnected, setIsConnected] = useState(false);
  const [ros, setRos] = useState(null);

  useEffect(() => {
    const rosConnection = new ROSLIB.Ros({
      url: WEBSOCKET_URL
    });

    rosConnection.on('connection', () => {
      console.log('Conectado ao robô!');
      setIsConnected(true);
    });

    rosConnection.on('error', () => {
      console.log('Tentando conectar...'); 
      setIsConnected(false);
    });

    rosConnection.on('close', () => {
      setIsConnected(false);
    });

    setRos(rosConnection);

    return () => {
      rosConnection.close();
    };
  }, []);

  return { ros, isConnected, ip: ROBOT_IP };
}