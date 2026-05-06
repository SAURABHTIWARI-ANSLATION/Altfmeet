# File Structure

- `backend/`: Node.js server and logic.
  - `src/`: Backend source code.
    - `server.js`: Main entry point.
    - `app.js`: Express app configuration.
    - `route.js`: API routing.
    - `chat/`, `config/`, `media/`, `meetings/`, `signaling/`: Feature modules.
  - `package.json`, `.env`: Backend configuration.
- `frontend/`: React + Tailwind source code.
  - `src/`: React components, hooks, and styles.
  - `public/`: Static assets.
  - `tailwind.config.js`, `postcss.config.js`: Tailwind configuration.
  - `package.json`: Frontend dependencies.
- `.planning/`: GSD planning and mapping files.
  - `codebase/`: Static mapping files.
  - `planning.md`: Development roadmap.
