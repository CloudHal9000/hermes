# Debug Mode Rules

## Debugging Strategies for Robot Dashboard

### ROS Integration Debugging
- Use `console.log` extensively with ROS connection states
- Monitor external script loading via `useExternalScript`
- Verify ROS library initialization sequence

### API and Network Debugging
- Log all API fetch attempts and responses
- Track periodic polling intervals
- Capture and log network-related errors

### Performance Debugging
- Profile rendering performance of complex components
- Monitor state updates and re-renders
- Check for unnecessary re-renders in hooks

### Error Tracking
- Analyze notification system for error propagation
- Inspect `NotificationContext` for hidden errors
- Verify error handling in async operations

### Critical Debugging Points
- Check ROS connection readiness before operations
- Validate robot state transitions
- Investigate periodic polling mechanism
- Examine quaternion calculations for robot positioning

### Logging Recommendations
- Use browser developer tools
- Enable verbose logging in development
- Capture and log all unexpected state changes