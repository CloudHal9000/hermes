import { useState, useEffect } from 'react';
import * as ROSLIB from 'roslib';

// Removemos a constante fixa daqui. O IP virá de fora.
export function useRos(robotIp) { // <--- Agora recebe o IP
  const [isConnected, setIsConnected] = useState(false);
  const [ros, setRos] = useState(null);

  useEffect(() => {
    // Se não tiver IP selecionado, não conecta
    if (!robotIp) return;

    const url = `ws://${robotIp}:9090`;
    console.log(`Tentando conectar em: ${url}`);

    const rosConnection = new ROSLIB.Ros({ url });

    rosConnection.on('connection', () => {
      console.log(`Conectado ao robô ${robotIp}!`);
      setIsConnected(true);
    });

    rosConnection.on('error', () => {
      // console.log('Tentando reconectar...'); // Opcional
      setIsConnected(false);
    });

    rosConnection.on('close', () => {
      setIsConnected(false);
    });

    setRos(rosConnection);

    // Limpeza: Ao trocar de robô, desconecta o anterior
    return () => {
      rosConnection.close();
    };
  }, [robotIp]); // <--- O array de dependência garante a reconexão ao mudar o IP

  return { ros, isConnected };
}