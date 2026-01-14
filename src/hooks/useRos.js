import { useState, useEffect } from 'react';
import * as ROSLIB from 'roslib';

export function useRos(robotIp) {
  const [ros, setRos] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!robotIp) {
      if (ros) {
        ros.close();
        setRos(null);
        setIsConnected(false);
      }
      return;
    }

    const url = `ws://${robotIp}:9090`;
    console.log(`Attempting to connect to: ${url}`);

    const rosConnection = new ROSLIB.Ros({ url });

    rosConnection.on('connection', () => {
      console.log(`Connected to robot at ${robotIp}!`);
      setIsConnected(true);
    });

    rosConnection.on('error', (error) => {
      console.error(`Error connecting to ${robotIp}:`, error);
      setIsConnected(false);
    });

    rosConnection.on('close', () => {
      console.log(`Connection to ${robotIp} closed.`);
      setIsConnected(false);
    });

    setRos(rosConnection);

    return () => {
      console.log(`Closing connection to ${robotIp}`);
      rosConnection.close();
    };
  }, [robotIp]); 

  return { ros, isConnected };
}
