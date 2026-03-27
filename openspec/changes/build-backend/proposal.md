## Why
Bare Metals is a greenfield project with no implementation yet. The backend must be built from scratch to serve as the data and business logic layer for the custody platform.

## What Changes
- Scaffold FastAPI project with Docker, PostgreSQL, and Alembic migrations
- Implement JWT-based authentication with role-based access control (admin, ops, client)
- Build account management (create, list, deactivate) with retail/institutional types
- Build vault management (create, list, deactivate) with geographic coordinates
- Implement deposit processing for unallocated (token-based) and allocated (bar-level) storage
- Implement withdrawal processing for both storage types with concurrency safety
- Expose portfolio endpoint with live USD/MVR valuations per client
- Integrate metalpriceapi.com with DB-cached prices and stale-flag fallback
- Expose system config endpoints for MVR rate and price cache TTL

## Impact
- Affected specs: project-setup, auth, accounts, vaults, deposits, withdrawals, portfolio, metal-prices, system-config
- Affected code: entire backend (new project)
