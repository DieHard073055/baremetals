## 1. Frontend Setup
- [ ] 1.1 Scaffold Vite + React + TypeScript project
- [ ] 1.2 Configure TailwindCSS and shadcn/ui
- [ ] 1.3 Set up React Router with role-based protected routes
- [ ] 1.4 Configure Axios (or fetch) with base URL and JWT interceptor
- [ ] 1.5 Add Leaflet.js dependency for map components
- [ ] 1.6 Write type definitions matching all backend response shapes

## 2. Auth
- [ ] 2.1 Build login page (email + password form)
- [ ] 2.2 Implement token storage (localStorage) and auth context
- [ ] 2.3 Write `ProtectedRoute` component that checks role and redirects on mismatch
- [ ] 2.4 Implement logout (clear token, redirect to login)

## 3. Admin Dashboard
- [ ] 3.1 Account management table: list, create account modal, deactivate button with holdings warning
- [ ] 3.2 Vault map: Leaflet map of the Maldives, click-to-place marker on creation, per-vault metal totals in popup
- [ ] 3.3 Vault list/detail: inventory breakdown per metal
- [ ] 3.4 System config form: editable MVR rate and price cache TTL
- [ ] 3.5 Reporting view: all deposits and withdrawals table with filters
- [ ] 3.6 Metal prices panel: show current prices, last fetch time, stale warning badge, force refresh button

## 4. Ops Portal
- [ ] 4.1 Deposit form: select client account, vault, metal; toggle between unallocated (gram input) and allocated (add bars UI)
- [ ] 4.2 Withdrawal form: select client account, metal; unallocated (gram input) vs allocated (bar selector)
- [ ] 4.3 Client portfolio viewer: search/select client, show their holdings and history
- [ ] 4.4 Vault inventory viewer: select vault, show pool totals and active bars

## 5. Client Portfolio
- [ ] 5.1 Holdings summary: per-metal cards showing quantity in kg and value in selected currency
- [ ] 5.2 Currency toggle: USD / MVR switcher that recalculates all displayed values client-side
- [ ] 5.3 Deposit history tab: table of own deposits
- [ ] 5.4 Withdrawal history tab: table of own withdrawals
- [ ] 5.5 Bar list (institutional only): table of active bars with serial_number and weight_g
- [ ] 5.6 Stale price warning: display banner when price data is stale
