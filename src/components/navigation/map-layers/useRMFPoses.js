/**
 * useRMFPoses — Convert fleet robots to Three.js-compatible poses
 *
 * Replaces useTfGraph for the multi-robot case: no BFS, no ROS /tf
 * subscriptions. Poses come directly from the Zustand fleetStore
 * (populated by useRMFApi → RMF API Server → freebotics_rmf_adapter → robot TF).
 *
 * Returns: { [robotName]: { position: {x,y,z}, quaternion: {x,y,z,w} } }
 */

import { useMemo } from 'react';
import { useFleetStore } from '../../../store/fleetStore';

function yawToQuaternion(yaw) {
  const half = (yaw ?? 0) / 2;
  return { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) };
}

export function useRMFPoses() {
  const robots = useFleetStore(state => state.robots);

  return useMemo(() =>
    robots.reduce((acc, robot) => {
      // Support both rmf_fleet_msgs (name) and REST-API (id) formats
      const key = robot.name ?? robot.id;
      if (!key) return acc;
      acc[key] = {
        position: {
          x: robot.location?.x   ?? 0,
          y: robot.location?.y   ?? 0,
          z: 0,
        },
        quaternion: yawToQuaternion(robot.location?.yaw),
      };
      return acc;
    }, {}),
  [robots]);
}
