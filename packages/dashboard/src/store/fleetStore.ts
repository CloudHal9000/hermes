/**
 * Central Zustand store for fleet state.
 *
 * Replaces scattered prop-drilling of `robots` and `ros` across the component
 * tree. Designed to be populated by useFleetState (open-RMF) once it replaces
 * useFleetPolling, but works standalone and is safe to use before that migration.
 *
 * Usage outside React (e.g. Three.js callbacks, Web Workers):
 *   import { useFleetStore } from './fleetStore';
 *   const { robots } = useFleetStore.getState();  // no Provider required
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { FleetState, RobotState, TaskState } from '../types/rmf';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface FleetStore {
  // State
  robots: RobotState[];
  tasks: TaskState[];
  connectionStatus: ConnectionStatus;
  lastUpdated: string | null;

  // Actions
  setFleetState: (state: FleetState) => void;
  updateRobot: (robotId: string, update: Partial<RobotState>) => void;
  addTask: (task: TaskState) => void;
  updateTask: (taskId: string, update: Partial<TaskState>) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  reset: () => void;
}

const initialState = {
  robots: [] as RobotState[],
  tasks: [] as TaskState[],
  connectionStatus: 'disconnected' as ConnectionStatus,
  lastUpdated: null as string | null,
};

export const useFleetStore = create<FleetStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setFleetState: (state) =>
        set(
          { robots: state.robots, tasks: state.tasks, lastUpdated: new Date().toISOString() },
          false,
          'setFleetState'
        ),

      updateRobot: (robotId, update) =>
        set(
          (s) => ({ robots: s.robots.map((r) => (r.id === robotId ? { ...r, ...update } : r)) }),
          false,
          'updateRobot'
        ),

      addTask: (task) =>
        set((s) => ({ tasks: [...s.tasks, task] }), false, 'addTask'),

      updateTask: (taskId, update) =>
        set(
          (s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...update } : t)) }),
          false,
          'updateTask'
        ),

      setConnectionStatus: (status) =>
        set({ connectionStatus: status }, false, 'setConnectionStatus'),

      reset: () => set(initialState, false, 'reset'),
    }),
    { name: 'HermesFleetStore' }
  )
);
