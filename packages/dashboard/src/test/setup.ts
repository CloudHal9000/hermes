import '@testing-library/jest-dom';

// Mock window.ROSLIB — not needed for store/guard tests, but required when testing
// hooks that call `new window.ROSLIB.Topic(...)` (useRos, useTfGraph, useRobotModel, etc.).
// Uncomment and expand when those hooks get test coverage:
//
// import { vi } from 'vitest';
// Object.defineProperty(window, 'ROSLIB', {
//   value: {
//     Ros: vi.fn(() => ({ on: vi.fn(), close: vi.fn() })),
//     Topic: vi.fn(() => ({
//       subscribe: vi.fn(),
//       unsubscribe: vi.fn(),
//       publish: vi.fn(),
//     })),
//   },
//   writable: true,
// });
