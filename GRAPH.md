# Altfmeet Codebase Graph

Status: Final UI pass complete. This graph was created after reading the app source, backend handlers, frontend pages, services, styles, config, and bundled assets. Tool/vendor directories such as `.git`, `node_modules`, `frontend/dist`, `.agent`, and `.codex` are local/generated metadata and are not part of the shipped app map.

## 1. Component Map

### `frontend/src/App.jsx`
- Purpose: Top-level router.
- Renders: `/` -> `Landing`, `/room/:roomId` -> `Room`.
- Props/state: None.
- UI state: Complete structurally, no visual concerns.
- Logic: Connected to React Router only.

### `frontend/src/pages/Landing.jsx`
- Purpose: Home/create/join page.
- Renders: Hero headline, name input, create meeting card, join meeting card, footer line.
- Props/state: `meetingId`, `title`, `displayName`, `loading`.
- Logic: Anonymous Firebase sign-in, creates meetings through REST API, navigates with `userId` and `name`.
- Current look: Complete. Full-viewport premium hero, startup-grade copy, name/title/code inputs, CTAs, mock meeting window, animated mesh/noise background, feature grid, how-it-works section, and footer.
- UI debt: Done.

### `frontend/src/pages/Room.jsx`
- Purpose: Pre-join and in-meeting experience.
- Internal UI components/functions:
  - `VideoTile`: video/avatar tile with name overlay, mic indicator, screen-share badge, speaking border.
  - `cleanName`, `initialsFor`, `colorForName`, `formatTime`: identity/display utilities.
  - `renderMessages`: grouped chat row renderer.
- Props/state: Reads route/search params. Manages `preJoinName`, `hasJoined`, `localStream`, socket id, meeting details, participants, messages, remote streams, chat/sidebar open state, unread count, media state, speaking IDs.
- Logic: Local media acquisition, RTCPeerConnection creation, offer/answer exchange, ICE buffering, one-time ICE restart, screen track replacement, audio analyser speaking detection, chat send/receive, participant/media state subscription, cleanup on leave/unmount.
- Current look: Complete. Split pre-join with live preview and setup controls, premium meeting shell, copyable invite badge, duration timer, participant count, autohiding labeled control bar, toast notifications, loading/error states, solo invite state, polished chat and participant panels, responsive mobile overlays.
- UI debt: Done.

### `frontend/src/services/socket.js`
- Purpose: Socket.IO client singleton and event emit helpers.
- Exports: `initiateSocketConnection`, `disconnectSocket`, `getSocket`, `joinMeeting`, `leaveMeeting`, `sendMessage`, `sendMediaState`.
- UI rendering: None.
- Logic state: Real meeting socket flow; hardcoded `http://localhost:5000`.
- UI debt: None directly, but connection state/errors must be surfaced in Room UI.

### `frontend/src/services/api.js`
- Purpose: REST API wrapper.
- Exports: `createMeeting`, `joinMeeting`, `getMeetingDetails`.
- Logic state: Connected to backend `/api/meetings`; hardcoded API base.
- UI debt: None directly.

### `frontend/src/services/firebase.js`
- Purpose: Firebase app/auth/firestore initialization.
- Logic state: Uses Vite env vars. Analytics created browser-side.
- UI debt: None.

### `frontend/src/services/chat.firebase.js`
- Purpose: Legacy Firestore chat service.
- Logic state: Not used by current `Room`; replaced by socket chat.
- UI debt: None. Technical debt: can be removed later if socket chat remains canonical.

### `frontend/src/index.css`
- Purpose: Tailwind v4 theme and component classes.
- Current look: Complete design system. Near-black palette, teal-blue accent, Inter typography, consistent surfaces/buttons/inputs/tiles/panels/toasts, motion tokens, responsive behavior, reduced-motion handling.
- UI debt: Done.

### Removed template files
- `frontend/src/App.css`, `frontend/src/assets/react.svg`, `frontend/src/assets/vite.svg`, `frontend/src/assets/hero.png`, and `frontend/public/icons.svg` were unused template or stale visual assets and were deleted so the shipped app has one visual language.

### Assets
- `frontend/public/favicon.svg`: Vite-style lightning mark, usable as product logo seed.
- Unused template assets were removed.

## 2. Page Map

### `/`
- Current UI state: Full startup-grade landing page with hero, CTAs, product mockup, feature cards, how-it-works, and footer.
- Working logic: Firebase anonymous auth, meeting creation, local name persistence, join navigation.
- Missing visually: Nothing known after this pass.

### `/room/:roomId` pre-join state
- Current UI state: Split desktop pre-join with live tile preview, room badge, name form, setup controls, and permission/error messaging.
- Working logic: Name validation by disabling button; starts media/socket on join.
- Missing visually: Nothing known after this pass.

### `/room/:roomId` in-meeting state
- Current UI state: Premium meeting room with branded top bar, copy invite pill, timer, participant count, responsive video grid, empty state, toasts, loading/error overlays, autohiding controls, chat, and participants panels.
- Working logic: Local/remote streams, participant list, socket chat, media state updates, speaking detection, screen share track replacement, leave cleanup.
- Missing visually: Nothing known after this pass.

## 3. Data Flow Map

### Meeting creation/join navigation
1. `Landing` stores display name in localStorage.
2. Create path calls `api.createMeeting(hostId, title)`.
3. Join path uses typed meeting ID.
4. Both navigate to `/room/:roomId?userId=...&name=...`.

### Room connection
1. `Room.startMeeting` obtains local media.
2. `socket.initiateSocketConnection` opens Socket.IO connection.
3. On socket `connect`, `joinMeeting({ meetingId, userId, name, media })` emits `JOIN_MEETING`.
4. Backend `signaling.gateway` writes participant into `room-state`.
5. Backend emits `room:participants`, `CHAT_HISTORY`, `USER_JOINED`, and `room:existing-participants`.

### Participant UI re-rendering
1. `room:participants` sets `participants`.
2. `USER_JOINED` appends participant and existing peers create offers.
3. `USER_LEFT` removes participant and `cleanupPeer` removes streams.
4. `participant:media-state` merges mic/camera/screen state.
5. `visibleParticipants` memo recalculates local-first ordering.
6. `VideoTile`, participants sidebar, top count, and grid classes re-render.

### WebRTC media flow
1. Existing participant sees `USER_JOINED` and runs `createOffer(newSocketId)`.
2. Offers/answers are relayed through backend `OFFER`/`ANSWER`.
3. ICE candidates are relayed through backend `ICE_CANDIDATE`.
4. Client buffers incoming ICE until remote description exists, then flushes.
5. `ontrack` stores `remoteStreams[peerId]`.
6. `VideoTile` receives stream prop and attaches it to `<video>`.
7. Connection/ICE failure triggers one `restartIce()` offer attempt.

### Chat flow
1. Chat input sends `sendMessage({ meetingId, content })`.
2. Backend validates participant identity, rate-limits 10 messages / 5 seconds, enriches with `senderId`, `senderName`, `timestamp`.
3. Backend stores in in-memory room history and emits `CHAT_MESSAGE`.
4. Room appends to `messages`, increments unread if panel closed, and either autoscrolls or shows "New message".
5. `renderMessages` groups same sender within one minute.

### Media control flow
1. Mic toggles local audio track `.enabled` and emits `media:state`.
2. Camera off stops/removes local video track and emits `camOn: false`; camera on reacquires video and `replaceTrack`s peers.
3. Screen share uses `getDisplayMedia`, `replaceTrack`s peer senders, emits `screenSharing: true`, and restores camera on stop.
4. Backend broadcasts `participant:media-state`.
5. Remote tiles and participant rows update mic/camera/screen indicators.

## 4. UI Debt List

1. Done: `Room` pre-join screen now has live preview, name overlay, setup controls, and permission/error messaging.
2. Done: `Room` meeting shell now has premium top bar, copy invite, timer, labeled/autohiding controls, solo invite empty state, and toasts.
3. Done: Chat and participants panels now slide in, use better headers, textarea input, unread badge, and mobile overlay behavior.
4. Done: `Landing` now has funded-product hero, mockup, feature cards, how-it-works, footer, and entrance animation.
5. Done: `index.css` now defines one cohesive dark professional system with one teal-blue accent.
6. Done: Stale template CSS and unused template assets were removed.
7. Done: `index.html` title is `Alt+F Meet`.

## 5. Style System Audit

- Framework: React 19 + Vite + Tailwind CSS v4 via `@import "tailwindcss"` and `@theme`.
- Icons: `lucide-react`.
- Current tokens: `app-bg`, `app-surface`, `app-surface-2`, `app-surface-3`, `app-border`, `app-text`, `app-muted`, `app-faint`, `primary`, `primary-dark`, `primary-soft`, `danger`, `success`.
- Current palette quality: Cohesive dark professional theme with a single teal-blue brand accent and restrained success/destructive states.
- Typography: Inter imported globally; consistent `.h1`, `.h2`, `.h3`, `.body-lg`, and label styles.
- Spacing: Uses Tailwind utilities on a 4px grid.
- Radius: Panels/cards use 12-16px, video tiles 12px, controls 10-12px, pills full radius.
- Motion: 200-300ms microinteractions, 300ms panels, feature entrance animation, tile entrance, speaker pulse, reduced-motion handling.
- Shadows/glow: Standard surfaces, active controls, focus rings, active speaker glow, and toasts all use the design system.

## Completion Tracker

- [x] Phase 1 - Codebase mapping
- [x] Phase 2 - Design system foundation
- [x] Phase 3 - Landing page
- [x] Phase 4 - Pre-join screen
- [x] Phase 5 - Meeting room UI
- [x] Phase 6 - Micro-interactions and polish
- [x] Phase 7 - Responsive behavior
- [x] Final verification
