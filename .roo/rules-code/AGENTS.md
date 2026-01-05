# Code Mode Rules

## Project-Specific Coding Guidelines

### React Component Conventions
- Always use functional components with React Hooks
- Prefer destructuring for props and state
- Use descriptive, action-oriented function names

### ROS Integration Specifics
- Always use `useRos` hook for ROS connections
- Wrap ROS-related operations in try-catch blocks
- Use `useExternalScript` for loading ROS libraries

### Error Handling
- Implement comprehensive error handling
- Use `NotificationContext` for error reporting
- Gracefully handle external script and API failures

### Performance Considerations
- Avoid inline styles for complex components
- Consider memoization for performance-critical renders
- Be cautious of periodic polling intervals

### Utility Patterns
- Utilize custom hooks in `src/hooks/`
- Leverage utility functions in `src/utils/`
- Prefer composition over inheritance

### Critical Code Patterns
- Always check ROS and script readiness before operations
- Use `useRef` for non-rendering state tracking
- Implement multiple fallback mechanisms for critical operations