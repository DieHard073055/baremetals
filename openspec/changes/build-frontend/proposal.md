## Why
The backend API needs a web interface for all three user roles. The frontend provides role-specific views: an admin dashboard, an ops portal, and a client portfolio — all served from the same React SPA.

## What Changes
- Scaffold React + TypeScript + Vite project with TailwindCSS and shadcn/ui
- Implement JWT auth flow (login page, token storage, route guards by role)
- Build admin dashboard: account management, vault map (Leaflet.js), system config, reporting
- Build ops portal: deposit and withdrawal forms, client portfolio viewer, vault inventory
- Build client portfolio view: holdings in kg/USD/MVR, history tabs, institutional bar list

## Impact
- Affected specs: frontend-setup, admin-dashboard, ops-portal, client-portfolio
- Affected code: entire frontend (new project)
- Depends on: build-backend (all API endpoints must exist)
