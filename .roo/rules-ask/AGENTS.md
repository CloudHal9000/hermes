# Ask Mode Rules

## Documentation and Context Guidelines

### Project Structure Insights
- Dashboard is a React-based robot control interface
- Focuses on ROS (Robot Operating System) integration
- Utilizes dynamic script loading for external libraries

### Key Documentation Locations
- `src/hooks/useRos.js`: ROS connection management
- `src/hooks/useExternalScript.js`: Script loading mechanism
- `src/components/`: Individual UI component implementations
- `src/utils/`: Utility functions and helpers

### Non-Obvious Project Details
- Periodic API polling every 5 seconds for robot status
- Hardcoded initial robot list with fallback mechanisms
- Manual quaternion calculations for robot positioning
- Context API used for global notifications

### ROS Integration Notes
- External ROS libraries loaded dynamically
- Custom hooks abstract complex ROS interactions
- Automatic initial pose sending on connection

### Component Interaction Patterns
- Centralized state management in main App component
- Cross-component communication via Context API
- Extensive use of React Hooks for state and side effects

### Performance and Architectural Considerations
- Inline styles used extensively
- No apparent memoization of complex calculations
- Fixed-interval API polling strategy