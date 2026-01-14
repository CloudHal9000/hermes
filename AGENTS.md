# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Overview
- **Framework**: React 18.3 with Vite 5.4
- **Language**: JavaScript (ES2020+)
- **Primary Purpose**: Robot Dashboard and Control Interface

## Build & Development Commands
- `npm run dev`: Start development server
- `npm run build`: Create production build
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint checks

## Non-Obvious Project Patterns

### ROS Integration
- Dynamic external script loading for ROS libraries
- Custom `useRos` hook manages ROS connection state
- Periodic API polling for robot status (every 5 seconds)

### State Management
- Centralized state in main App component
- Context API for global notifications
- `useRef` used for non-rendering state tracking

### Unique Conventions
- Inline styles preferred over CSS files
- Hardcoded initial robot list with fallback mechanisms
- Manual quaternion calculation for robot positioning
- Multiple redundant stop mechanisms for robot navigation

### Critical Gotchas
- External ROS scripts must load in specific order
- API error handling relies on notification system
- Robot connection state managed through periodic polling
- Initial robot pose sent automatically on connection

### Performance Notes
- Inline styles may impact rendering performance
- No evident memoization of complex calculations
- Fixed-interval API polling without adaptive strategies

## Development Guidelines
- Use functional components with React Hooks
- Prefer descriptive, action-oriented function names
- Implement comprehensive error handling
- Use Context API for cross-component communication

## Testing Considerations
- No explicit testing framework configuration visible
- Manual testing recommended for ROS integration points