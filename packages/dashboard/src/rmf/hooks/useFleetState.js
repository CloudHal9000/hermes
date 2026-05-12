/**
 * useFleetState
 * Substitui useFleetPolling — consome dados reais do RMF API Server.
 * Polling REST como fallback enquanto Socket.IO events não chegam.
 */
import { useState, useEffect, useRef } from 'react';
import { fetchFleets, fetchFleetState } from '../api/rmfClient';

/**
 * Normaliza RobotState do RMF para o formato que o dashboard já consome.
 * Mantém compatibilidade com Map3D, DashboardPanel, FleetSelector.
 */
function normalizeRobot(robot, fleetName, index) {
  return {
    id: index + 1,
    name: robot.name || `robot_${index + 1}`,
    fleet: fleetName,
    online: true,
    status: robot.status?.status ?? 'unknown',
    battery_level: robot.battery ? Math.round(robot.battery.percent) : null,
    mode: robot.status?.status ?? 'moving',
    isBusy: robot.status?.status === 'working',
    hasError: false,
    // posição para Map3D
    position: robot.location ? {
      x: robot.location.x,
      y: robot.location.y,
      yaw: robot.location.yaw,
      level: robot.location.map,
    } : null,
  };
}

export function useFleetState(addNotification) {
  const [robots, setRobots] = useState([]);
  const [fleets, setFleets] = useState([]);
  const notifiedRef = useRef(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    async function poll() {
      try {
        const fleetList = await fetchFleets();
        setFleets(fleetList);

        const allRobots = [];
        let idx = 0;

        for (const fleet of fleetList) {
          const name = fleet.name ?? fleet;
          try {
            const state = await fetchFleetState(name);
            const robots = state.robots ?? {};
            for (const [, robotState] of Object.entries(robots)) {
              allRobots.push(normalizeRobot(robotState, name, idx++));
            }
          } catch {
            // frota sem state ainda — ignora silenciosamente
          }
        }

        setRobots(allRobots);

        if (!notifiedRef.current && allRobots.length > 0) {
          addNotification?.(`✅ ${allRobots.length} robô(s) via RMF`);
          notifiedRef.current = true;
        }
      } catch (err) {
        addNotification?.(`❌ RMF API: ${err.message}`);
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => clearInterval(intervalRef.current);
  }, [addNotification]);

  return { robots, fleets };
}