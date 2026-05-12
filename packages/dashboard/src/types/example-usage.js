/**
 * Exemplo de uso dos tipos RMF nos hooks futuros
 * Este arquivo é apenas para demonstração - não será compilado
 */

import { isFleetState, isTaskRequest } from './guards';

// Exemplo de uso no hook useRMFApi (futuro)
export const exampleUseRMFApi = () => {
  // WebSocket message handling
  const handleWebSocketMessage = (rawData) => {
    // rawData vem como `unknown` do WebSocket
    if (isFleetState(rawData)) {
      // TypeScript reconhece que aqui é FleetState
      console.log('Robôs na frota:', rawData.robots.length);
      console.log('Tarefas ativas:', rawData.tasks.filter(t => t.state === 'executing'));
    }
  };

  // Request validation before API call
  const createTask = (taskData) => {
    if (!isTaskRequest(taskData)) {
      throw new Error('Task request inválido');
    }

    // Agora podemos enviar com segurança para a API
    return fetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
  };

  return { handleWebSocketMessage, createTask };
};

// Exemplo de transformação de dados
export const exampleDataTransformation = (fleetState) => {
  // Se isFleetState(fleetState) for true, TypeScript sabe que:
  // - fleetState.robots é RobotState[]
  // - fleetState.tasks é TaskState[]

  return {
    robots: fleetState.robots.map(robot => ({
      id: robot.id,
      name: robot.id.split('_')[1], // ex: "freebotics_001" → "001"
      position: robot.location,
      battery: robot.battery,
      status: robot.status,
      isMoving: robot.status === 'moving'
    })),

    tasks: fleetState.tasks.map(task => ({
      id: task.id,
      title: `${task.category} #${task.id.slice(-4)}`,
      status: task.state,
      assignedTo: task.assigned_robot_id,
      progress: task.state === 'completed' ? 100 :
                task.state === 'failed' ? 0 : 50
    }))
  };
};