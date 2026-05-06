# Technical Concerns

- **Dependencies**: Express 5 is in beta/prerelease territory (v5.1.0 in `package.json`).
- **WebRTC Complexity**: Mediasoup is powerful but complex; debugging production issues might require extensive logging.
- **Testing**: Lack of automated tests for critical meeting flows.
- **Frontend Architecture**: Currently using vanilla JS; as the feature set grows, moving to a framework (React/Next.js) might be beneficial for state management.
- **Error Handling**: Need to verify if robust error boundaries exist for peer connections.
