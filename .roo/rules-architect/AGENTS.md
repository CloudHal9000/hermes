# Architect Mode Rules

## Architectural Considerations and Design Principles

### System Architecture Overview
- Single-page React application for robot dashboard
- ROS (Robot Operating System) integration core
- Dynamic, modular component-based design

### Key Architectural Patterns
- Centralized state management
- Context API for cross-component communication
- Custom hooks for complex logic abstraction
- Dynamic external script loading

### Component Design Principles
- Functional components with React Hooks
- Separation of concerns
- Reusable, modular component structure
- Flexible navigation and control interfaces

### State Management Strategy
- Centralized state in main App component
- Context API for global notifications
- `useRef` for non-rendering state tracking
- Periodic API polling for real-time updates

### Integration and Extensibility
- Flexible robot fleet management
- Abstracted ROS connection mechanism
- Extensible navigation and control interfaces

### Performance Considerations
- Inline styles (potential performance impact)
- No apparent memoization strategies
- Fixed-interval API polling

### Critical Design Constraints
- External ROS script loading order
- Automatic initial pose sending
- Multiple redundant stop mechanisms
- Hardcoded initial robot list with fallback

### Potential Architectural Improvements
- Implement memoization for complex renders
- Consider adaptive polling strategies
- Explore more efficient state management
- Optimize external script loading

### Unique Architectural Decisions
- Manual quaternion calculation for robot positioning
- Notification-based error handling
- Flexible view modes and navigation tools