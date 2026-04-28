/**
 * Runtime type guards for RMF WebSocket data
 * Critical for validating data received via WebSocket (which comes as `unknown`)
 */

/**
 * Type guard for FleetState
 * Validates the complete fleet state object
 */
export function isFleetState(data: unknown): data is FleetState {
  if (!data || typeof data !== 'object') return false;

  const fleetState = data as Record<string, unknown>;

  // Check robots array
  if (!Array.isArray(fleetState.robots)) return false;

  // Validate each robot in the array
  for (const robot of fleetState.robots) {
    if (!isRobotState(robot)) return false;
  }

  // Check tasks array (optional)
  if (fleetState.tasks && !Array.isArray(fleetState.tasks)) return false;
  if (fleetState.tasks) {
    for (const task of fleetState.tasks) {
      if (!isTaskState(task)) return false;
    }
  }

  return true;
}

/**
 * Type guard for RobotState
 * Validates individual robot state
 */
export function isRobotState(data: unknown): data is RobotState {
  if (!data || typeof data !== 'object') return false;

  const robot = data as Record<string, unknown>;

  // Required fields
  if (typeof robot.id !== 'string') return false;
  if (typeof robot.status !== 'string') return false;
  if (typeof robot.fleet_name !== 'string') return false;
  if (typeof robot.battery !== 'number' || robot.battery < 0 || robot.battery > 100) return false;

  // Validate location object
  if (!robot.location || typeof robot.location !== 'object') return false;
  const location = robot.location as Record<string, unknown>;

  if (typeof location.x !== 'number') return false;
  if (typeof location.y !== 'number') return false;
  if (typeof location.yaw !== 'number') return false;
  if (typeof location.level !== 'string') return false;

  return true;
}

/**
 * Type guard for TaskState
 * Validates task state object
 */
export function isTaskState(data: unknown): data is TaskState {
  if (!data || typeof data !== 'object') return false;

  const task = data as Record<string, unknown>;

  // Required fields
  if (typeof task.id !== 'string') return false;
  if (typeof task.category !== 'string') return false;
  if (!['pending', 'executing', 'completed', 'failed', 'cancelled'].includes(task.state)) return false;
  if (typeof task.created_at !== 'string') return false;
  if (typeof task.updated_at !== 'string') return false;

  // Validate start and goal
  if (!task.start || typeof task.start !== 'object') return false;
  const start = task.start as Record<string, unknown>;
  if (typeof start.x !== 'number') return false;
  if (typeof start.y !== 'number') return false;

  if (!task.goal || typeof task.goal !== 'object') return false;
  const goal = task.goal as Record<string, unknown>;
  if (typeof goal.x !== 'number') return false;
  if (typeof goal.y !== 'number') return false;

  // Optional assigned_robot_id
  if (task.assigned_robot_id !== undefined && typeof task.assigned_robot_id !== 'string') {
    return false;
  }

  return true;
}

/**
 * Type guard for RMF WebSocket Event
 * Validates the WebSocket event envelope
 */
export function isRMFWebSocketEvent(data: unknown): data is RMFWebSocketEvent {
  if (!data || typeof data !== 'object') return false;

  const event = data as Record<string, unknown>;

  // Check required fields
  if (typeof event.type !== 'string') return false;
  if (!['fleet_state_update', 'task_update', 'error'].includes(event.type)) return false;
  if (typeof event.timestamp !== 'string') return false;

  // Validate payload based on event type
  switch (event.type) {
    case 'fleet_state_update':
      return isFleetState(event.payload);
    case 'task_update':
      return isTaskState(event.payload);
    case 'error':
      if (typeof event.payload !== 'object') return false;
      const errorPayload = event.payload as Record<string, unknown>;
      return typeof errorPayload.message === 'string';
    default:
      return false;
  }
}

/**
 * Type guard for TaskRequest
 * Validates task request before sending to API
 */
export function isTaskRequest(data: unknown): data is TaskRequest {
  if (!data || typeof data !== 'object') return false;

  const request = data as Record<string, unknown>;

  // Check required fields
  if (!['delivery', 'navigation', 'patrol'].includes(request.category)) return false;
  if (!request.start || typeof request.start !== 'object') return false;
  if (!request.goal || typeof request.goal !== 'object') return false;

  // Validate start position
  const start = request.start as Record<string, unknown>;
  if (typeof start.x !== 'number') return false;
  if (typeof start.y !== 'number') return false;

  // Validate goal position
  const goal = request.goal as Record<string, unknown>;
  if (typeof goal.x !== 'number') return false;
  if (typeof goal.y !== 'number') return false;

  // Optional fields validation
  if (request.priority !== undefined && (typeof request.priority !== 'number' || request.priority < 0)) {
    return false;
  }

  if (request.fleet_name !== undefined && typeof request.fleet_name !== 'string') {
    return false;
  }

  return true;
}