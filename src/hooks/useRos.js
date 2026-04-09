import { useState, useEffect, useRef } from 'react';

export function useRos(robotIp) {
  const [ros, setRos] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Clear any pending reconnection attempts when IP changes
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (!robotIp) {
      if (ros) {
        ros.close();
        setRos(null);
        setIsConnected(false);
      }
      return;
    }

    let rosConnection = null;

    const connect = () => {
      // Avoid creating multiple connections or connecting if component unmounted
      if (!isMountedRef.current) return;
      if (rosConnection && rosConnection.isConnected) return;

      const url = `ws://${robotIp}:9090`;
      console.log(`Attempting to connect to: ${url}`);

      if (!window.ROSLIB) {
        console.error("window.ROSLIB is not loaded!");
        // Retry later if library not loaded yet
        reconnectTimeoutRef.current = setTimeout(connect, 3000); 
        return;
      }

      rosConnection = new window.ROSLIB.Ros({ url });

      rosConnection.on('connection', () => {
        if (!isMountedRef.current) return;
        console.log(`Connected to robot at ${robotIp}!`);
        setIsConnected(true);
        setRos(rosConnection);
      });

      rosConnection.on('error', (error) => {
        if (!isMountedRef.current) return;
        console.error(`Error connecting to ${robotIp}:`, error);
        setIsConnected(false);
        // Retry logic is handled in 'close' event usually, but safety check:
        // Some roslib versions might not fire close after error immediately
      });

      rosConnection.on('close', () => {
        if (!isMountedRef.current) return;
        console.log(`Connection to ${robotIp} closed. Retrying in 3s...`);
        setIsConnected(false);
        setRos(null);
        
        // Automatic Reconnection Logic
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      });
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (rosConnection) {
        // Remove listeners to prevent zombie callbacks
        rosConnection.removeAllListeners();
        rosConnection.close();
      }
    };
  }, [robotIp]);

  return { ros, isConnected };
}
