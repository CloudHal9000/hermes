/**
 * Tipos para a API open-RMF
 * Baseado em OPENRMF_MIGRATION.md e endpoints do RMF API Server (:7878)
 */

// Robot location with level support
export interface RobotLocation {
  x: number;
  y: number;
  yaw: number;
  level: string;
}

// Individual robot state in fleet
export interface RobotState {
  id: string;
  location: RobotLocation;
  battery: number;          // 0-100
  status: string;           // "idle" | "moving" | "charging" | "error"
  fleet_name: string;
}

// Complete fleet state including robots and tasks
export interface FleetState {
  robots: RobotState[];
  tasks: TaskState[];
}

// Task request body for POST /tasks
export interface TaskRequest {
  category: "delivery" | "navigation" | "patrol";
  start: { x: number; y: number; yaw?: number };
  goal: { x: number; y: number; yaw?: number };
  priority?: number;
  fleet_name?: string;
}

// Task response after creation
export interface TaskResponse {
  task_id: string;
}

// Task state with execution tracking
export interface TaskState {
  id: string;
  category: string;
  state: "pending" | "executing" | "completed" | "failed" | "cancelled";
  assigned_robot_id?: string;
  start: { x: number; y: number };
  goal: { x: number; y: number };
  created_at: string;     // ISO 8601
  updated_at: string;
}

// RMF pose (quaternion representation)
export interface RMFPose {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
}

// WebSocket event envelope for RMF API
export interface RMFWebSocketEvent {
  type: "fleet_state_update" | "task_update" | "error";
  payload: FleetState | TaskState | { message: string };
  timestamp: string;
}

// Verify fields not explicitly documented in OPENRMF_MIGRATION.md:
// - RobotState.battery: inferred from "battery estimation" section
// - RobotState.status: inferred from possible robot states
// - TaskRequest.category: inferred from task types mentioned
// - TaskState.assigned_robot_id: logical field for task assignment