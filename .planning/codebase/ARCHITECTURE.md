# Architecture

## System Overview
The application is a real-time online meeting platform using a Client-Server architecture with a focus on low-latency media streaming via WebRTC.

## Backend Layers
- **Signaling Server**: Socket.io handles the initial handshake and peer coordination.
- **Media Server**: Mediasoup handles the routing of audio/video streams (SFU pattern).
- **API Layer**: Express handles REST endpoints for user management and room creation.
- **Data Layer**: PostgreSQL for persistence and Redis for volatile real-time state.

## Frontend Structure
- **Client-side Signaling**: Manages socket connections and WebRTC negotiation.
- **Media Management**: Handles local stream acquisition and remote stream rendering.
- **UI Components**: Simple HTML/CSS/JS for chat and video layout.

## Key Flows
1. **Joining**: User connects via Socket.io -> joins a room -> negotiates WebRTC transports via Mediasoup.
2. **Media**: User produces a stream -> Mediasoup SFU forwards it to other consumers in the room.
3. **Chat**: Real-time messaging via Socket.io.
