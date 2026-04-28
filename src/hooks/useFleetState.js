/**
 * useFleetState — Fleet state selector hook
 *
 * Reads from the Zustand fleetStore (never calls the API directly) and
 * transforms RobotState to a UI-friendly shape. Also exposes createTask /
 * cancelTask from useRMFApi so callers only need one import.
 *
 * Field mapping handles both the rmf_fleet_msgs format (name, battery_percent,
 * mode.mode, location.level_name) produced by the real adapter, and the
 * src/types/rmf.d.ts format (id, battery, status, location.level) used by
 * the type guards and test mocks.
 */

import { useMemo } from 'react';
import { useFleetStore } from '../store/fleetStore';
import { useRMFApi } from './useRMFApi';

function normalizeRobot(r) {
  return {
    // identity — prefer rmf_fleet_msgs name, fall back to REST-API id
    id:      r.name   ?? r.id,
    // location
    x:       r.location?.x   ?? 0,
    y:       r.location?.y   ?? 0,
    yaw:     r.location?.yaw ?? 0,
    level:   r.location?.level_name ?? r.location?.level ?? 'L1',
    // battery — rmf_fleet_msgs uses battery_percent (0-100), types use battery
    battery: r.battery_percent ?? r.battery ?? 0,
    // mode — rmf_fleet_msgs: mode.mode (uint32), types: status (string)
    status:  r.mode?.mode ?? r.status ?? 0,
    fleet:   r.fleet_name ?? 'freebotics',
  };
}

export function useFleetState() {
  const robots = useFleetStore(state => state.robots);
  const tasks  = useFleetStore(state => state.tasks);
  const connectionStatus = useFleetStore(state => state.connectionStatus);
  const { createTask, cancelTask } = useRMFApi();

  const robotList = useMemo(() => robots.map(normalizeRobot), [robots]);
  const taskList  = useMemo(() => tasks, [tasks]);

  return {
    robots:           robotList,
    tasks:            taskList,
    connectionStatus,
    createTask,
    cancelTask,
  };
}
