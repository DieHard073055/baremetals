## ADDED Requirements

### Requirement: Frontend Stack
The frontend SHALL be a Vite + React + TypeScript SPA using TailwindCSS for styling and shadcn/ui for component primitives. Leaflet.js SHALL be used for map rendering.

#### Scenario: Development server starts
- **WHEN** `npm run dev` is run inside the frontend directory
- **THEN** the app is reachable at `http://localhost:5173`

### Requirement: Role-Based Routing
The app SHALL redirect unauthenticated users to `/login`. Authenticated users SHALL be routed to their role-appropriate view; accessing a route for a different role SHALL redirect to their own home.

#### Scenario: Unauthenticated access
- **WHEN** a user visits any protected route without a token
- **THEN** they are redirected to `/login`

#### Scenario: Wrong role route
- **WHEN** a client visits `/admin`
- **THEN** they are redirected to `/portfolio`

### Requirement: JWT Auth Context
The app SHALL store the JWT in localStorage, decode it to derive the current user's role, and expose auth state via a React context. The JWT interceptor SHALL attach `Authorization: Bearer <token>` to all API requests.

#### Scenario: Token present on load
- **WHEN** the app loads and a valid token is in localStorage
- **THEN** the user is not redirected to login
