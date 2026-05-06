# Altfmeet Frontend Graph

Status: White-and-blue SaaS transformation complete. All shipped source/config/asset files were read before UI changes. Local tool metadata (`.agent/`, `.codex/`), `.git`, `node_modules`, and build output are excluded from the shipped app map.

## Component Map

### `frontend/src/App.jsx`
- Role: React Router shell.
- Renders: `/` -> `Landing`, `/room/:roomId` -> `Room`.
- Props/state: None.
- Current UI: Structural only, no visual styling of its own.
- Planned change: None beyond inheriting the new global design system.

### `frontend/src/pages/Landing.jsx`
- Role: Marketing/start page and meeting entry point.
- State: `meetingId`, `title`, `displayName`, `loading`.
- Logic: Firebase anonymous sign-in, `api.createMeeting`, local name persistence, navigation to room with `userId` and `name`.
- Current UI: Complete white/blue SaaS landing page with sticky navbar, scroll shadow/shrink behavior, mobile hamburger, animated light hero mesh, beta badge, gradient headline words, gradient and secondary CTAs, social proof, premium floating browser mockup, feature cards, how-it-works, count-up stats, final gradient CTA, and white footer.
- UI debt: Done.

### `frontend/src/pages/Room.jsx`
- Role: Pre-join and meeting room.
- Internal component/functions:
  - `VideoTile`: renders local/remote video tile, avatar initials, name overlay, mic state, screen share state, speaking highlight.
  - Utility functions: `cleanName`, `initialsFor`, `colorForName`, `formatTime`, `formatDuration`.
  - `renderMessages`: grouped chat message renderer.
- State: route/search params, `preJoinName`, `hasJoined`, `localStream`, `localSocketId`, meeting details, participants, messages, remote streams, chat/participants panel state, unread count, media state, speaking IDs, connection state, timer, controls visibility, toasts, copy state.
- Logic: Media preview/acquisition, WebRTC peer creation, offer/answer/ICE relay, ICE buffering/restart, screen share track replacement, Web Audio speaking detection, Socket.IO room/chat/media events, participant cleanup, copy invite, toast notifications.
- Current UI: Complete white/blue meeting experience. Pre-join is a white two-column card with live preview. Meeting chrome uses white/blue top and bottom bars, dark video grid, white chat/participants panels, blue copy/timer/count affordances, and SaaS-grade toasts/loading/error/empty states.
- UI debt: Done.

### `frontend/src/services/socket.js`
- Role: Socket.IO client singleton and emit helpers.
- Exports: `initiateSocketConnection`, `disconnectSocket`, `getSocket`, `joinMeeting`, `leaveMeeting`, `sendMessage`, `sendMediaState`.
- UI: None.
- Current state: Working real-time connection helpers.
- Planned change: None unless UI needs additional event hooks.

### `frontend/src/services/api.js`
- Role: REST API wrapper for meeting creation/join/details.
- UI: None.
- Current state: Working helper with hardcoded local backend.
- Planned change: None.

### `frontend/src/services/firebase.js`
- Role: Firebase app/auth/firestore initialization.
- UI: None.
- Current state: Used by landing auth.
- Planned change: None.

### `frontend/src/services/chat.firebase.js`
- Role: Legacy Firestore chat service.
- UI: None.
- Current state: Not used by current room socket chat.
- Planned change: None in this UI pass.

### `frontend/src/index.css`
- Role: Single global design system and component style layer.
- Current state: Complete white/blue token set, Inter typography scale, light SaaS components, blue-tinted shadows, gradient CTA, motion primitives, navbar, cards, mockups, stats, prejoin, meeting shell, panels, toasts, responsive breakpoints.

### `frontend/index.html`
- Role: HTML shell.
- Current state: Title already `Alt+F Meet`.
- Planned change: None.

### `frontend/public/favicon.svg`
- Role: Browser favicon.
- Current state: Purple/blue Vite-like mark.
- Planned change: Optional; leave unless needed because it is the only remaining public visual asset.

## Page Map

### `/`
- Current logic: Create/join meeting works through REST and route navigation.
- Current visual debt for this brief: Done.
- Current state: Top-tier white/blue SaaS landing page.

### `/room/:roomId` pre-join
- Current logic: Preview media, mic/camera toggles, name validation, join socket.
- Current visual debt for this brief: Done.
- Current state: Full-height white page with centered two-column card, live preview on left, setup form on right, blue focus/gradient button states.

### `/room/:roomId` meeting room
- Current logic: WebRTC, chat, participants, media controls, toasts, timer, copy invite, cleanup.
- Current visual debt for this brief: Done.
- Current state: White top bar, dark video grid, white bottom control bar, white chat/participants drawers, blue status treatments, mobile full-screen overlays.

## Data Flow Map

### Meeting creation and navigation
1. `Landing` captures name/title/code.
2. Create uses `api.createMeeting(hostId, title)`.
3. Join uses typed meeting ID.
4. Both persist `altfmeet:name` and navigate to `/room/:roomId?userId=...&name=...`.

### Room connection and participant state
1. `Room.startPreview` obtains local media before joining.
2. `Room.startMeeting` opens Socket.IO and emits `JOIN_MEETING`.
3. Backend room state emits `room:participants`, `room:existing-participants`, `USER_JOINED`, `USER_LEFT`.
4. React state updates `participants`, `remoteStreams`, `visibleParticipants`; grid, sidebar, top count, and tiles re-render.

### WebRTC media
1. Existing users create offers for new participant socket IDs.
2. Offers/answers/ICE relay through backend signaling.
3. ICE candidates buffer until remote description is set.
4. `ontrack` stores remote media in `remoteStreams`.
5. `VideoTile` attaches stream to `<video>` and shows avatar when camera is off.

### Chat
1. Chat textarea emits `CHAT_MESSAGE`.
2. Backend enriches messages with sender metadata, rate limits, stores room history, and broadcasts.
3. Room appends messages, groups same sender within one minute, manages unread badge and autoscroll/new-message button.

### Media controls
1. Mic toggles track `.enabled` and emits media state.
2. Camera stops/reacquires video track and emits media state.
3. Screen share uses `getDisplayMedia` and `sender.replaceTrack`.
4. Remote clients update tile/sidebar indicators from `participant:media-state`.

## UI Debt List For This Pass

1. Done: Replaced dark design system with white/blue professional SaaS system.
2. Done: Rebuilt landing navbar, hero, features, how-it-works, stats, final CTA, footer.
3. Done: Converted pre-join to white two-column card with blue focus and gradient CTA.
4. Done: Converted meeting chrome to white top/bottom bars while preserving dark video grid.
5. Done: Restyled chat and participants as white SaaS drawers.
6. Done: Added/adjusted animations: navbar scroll, hero blobs, mockup float, cards/steps/stats entrance, shimmer CTA, pulsing active speaker, unread pop, toast progress.
7. Done: Added responsive states at desktop, tablet, 768px, and 480px.
8. Done: Updated this graph to mark completion after verification.

## Style System Audit

- Framework: React 19, Vite, Tailwind CSS v4, CSS component layer.
- Icons: `lucide-react`.
- Font: Inter loaded via CSS import.
- Current design: White and very light blue backgrounds, brand blue primary, blue/violet gradient accents, slate text, subtle blue-tinted shadows, consistent 4px spacing, card/button/input/tile radii, accessible focus rings.

## Completion Tracker

- [x] Phase 1 - Read and map codebase
- [x] Phase 2 - White/blue design system foundation
- [x] Phase 3 - Landing page transformation
- [x] Phase 4 - Pre-join screen transformation
- [x] Phase 5 - Meeting room transformation
- [x] Phase 6 - Micro-interactions and toast polish
- [x] Phase 7 - Responsive pass
- [x] Phase 8 - Final verification
