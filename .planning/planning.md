# Project Planning - Online Meeting App

## Overview
This project is being restructured to use a React + TailwindCSS frontend and a Node.js (Mediasoup/Socket.io) backend. The codebase is organized into separate `frontend/` and `backend/` directories.

## Development Phases

### Phase 1: Reorganization & Setup [IN PROGRESS]
- [x] Separate `frontend/` and `backend/` folders.
- [x] Move existing backend logic to `backend/`.
- [x] Initialize React + Vite project in `frontend/`.
- [x] Setup TailwindCSS.
- [ ] Establish communication between Frontend and Backend (Proxy/CORS).

### Phase 2: Frontend Migration
- [ ] Migrate `media.js` logic to React Hooks (e.g., `useMediasoup`).
- [ ] Migrate `signaling.js` to a Socket context or hook.
- [ ] Build UI components using TailwindCSS:
    - Meeting Room layout.
    - Video controls (Mic, Camera, Screen share).
    - Chat sidebar.
    - Participant list.

### Phase 3: Backend Refinement
- [ ] Audit Mediasoup worker/router management.
- [ ] Ensure Redis is correctly handling room state for scalability.
- [ ] Implement JWT authentication flows in the new structure.

### Phase 4: Integration & Optimization
- [ ] End-to-end testing of audio/video streams.
- [ ] Responsive design for mobile devices.
- [ ] Error handling and reconnection logic.

## Technical Specifications

### Frontend
- **Framework**: React 18+ (Vite)
- **Styling**: TailwindCSS
- **State Management**: React Context / Hooks
- **Media**: Mediasoup-client

### Backend
- **Framework**: Express 5
- **Signaling**: Socket.io
- **Media SFU**: Mediasoup
- **Database**: PostgreSQL
- **Cache**: Redis

## Folder Structure
```text
.
├── backend/
│   ├── src/
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   ├── tailwind.config.js
│   └── package.json
└── .planning/
    ├── codebase/
    └── planning.md
```
