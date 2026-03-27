# Bare Metals — Digital Asset Custody Platform

A minimal custody platform for Bare Metals Pvt, digitizing the management of precious metal storage across multiple vaults. Built for the Maldives Securities Depository assessment.

---

## Table of Contents

- [Overview](#overview)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [User Roles](#user-roles)
- [Use Cases](#use-cases)
- [Edge Cases](#edge-cases)
- [Setup Instructions](#setup-instructions)
- [API Reference](#api-reference)
- [Assumptions & Design Decisions](#assumptions--design-decisions)

---

## Overview

Bare Metals provides physical custody of precious metals (gold, silver, platinum) across multiple vaults. This platform manages:

- Customer accounts (retail and institutional)
- Deposits and withdrawals across vaults
- Two storage models: unallocated (pooled) and allocated (bar-level)
- Live asset valuation via market price feed
- Multi-currency display (USD / MVR)
- Vault management with geographic mapping

---

## Screenshots

### Admin

**Accounts** — create and manage client and ops accounts, deactivate with holdings guard

![Admin Accounts](screenshots/admin/Screenshot%202026-03-27%20at%209.23.33%E2%80%AFPM.png)

**Vaults** — interactive Leaflet map (dark theme, centred on Malé), click to create a vault, view inventory per vault

![Admin Vaults](screenshots/admin/Screenshot%202026-03-27%20at%209.23.50%E2%80%AFPM.png)

**Reports** — system-wide deposit and withdrawal ledger

![Admin Reports](screenshots/admin/Screenshot%202026-03-27%20at%209.24.00%E2%80%AFPM.png)

**Prices** — current metal prices with last-fetch timestamp and stale warning

![Admin Prices](screenshots/admin/Screenshot%202026-03-27%20at%209.24.10%E2%80%AFPM.png)

**Config** — MVR/USD rate and price cache TTL

![Admin Config](screenshots/admin/Screenshot%202026-03-27%20at%209.24.17%E2%80%AFPM.png)

---

### Ops

**New Deposit** — unallocated or allocated, select vault, metal, and quantity or bars

![Ops Deposit](screenshots/ops/Screenshot%202026-03-27%20at%209.25.48%E2%80%AFPM.png)

**New Withdrawal (allocated)** — bar selection UI for institutional clients

![Ops Withdrawal](screenshots/ops/Screenshot%202026-03-27%20at%209.26.02%E2%80%AFPM.png)

**Client Portfolios — Holdings** — view any client's holdings from the ops portal

![Ops Client Holdings](screenshots/ops/Screenshot%202026-03-27%20at%209.26.17%E2%80%AFPM.png)

**Client Portfolios — Deposits** — deposit history including type and amount

![Ops Client Deposits](screenshots/ops/Screenshot%202026-03-27%20at%209.26.28%E2%80%AFPM.png)

**Client Portfolios — Deposits (institutional)** — allocated bar count visible

![Ops Institutional Deposits](screenshots/ops/Screenshot%202026-03-27%20at%209.26.40%E2%80%AFPM.png)

**Vault Inventory — Unallocated** — pool balances per metal per vault

![Ops Vault Unallocated](screenshots/ops/Screenshot%202026-03-27%20at%209.27.02%E2%80%AFPM.png)

**Vault Inventory — Allocated Bars** — individual bar serial numbers and weights

![Ops Vault Bars](screenshots/ops/Screenshot%202026-03-27%20at%209.26.55%E2%80%AFPM.png)

---

### Institutional Client

**Portfolio — Deposits** — deposit history without internal storage type details

![Institutional Deposits](screenshots/institutional/Screenshot%202026-03-27%20at%209.39.29%E2%80%AFPM.png)

**Portfolio — Withdrawals (MVR)** — withdrawal history with WDR reference numbers, toggled to MVR

![Institutional Withdrawals MVR](screenshots/institutional/Screenshot%202026-03-27%20at%209.39.39%E2%80%AFPM.png)

**Portfolio — Bars** — individually tracked bar serials and weights

![Institutional Bars](screenshots/institutional/Screenshot%202026-03-27%20at%209.39.47%E2%80%AFPM.png)

---

### Retail Client

**Portfolio (USD)** — multi-metal holdings with total value, deposit history

![Retail USD](screenshots/retail/Screenshot%202026-03-27%20at%209.27.44%E2%80%AFPM.png)

**Portfolio (MVR) — Withdrawals** — currency toggled to MVR, withdrawal history with WDR reference numbers

![Retail MVR Withdrawals](screenshots/retail/Screenshot%202026-03-27%20at%209.27.58%E2%80%AFPM.png)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Frontend                        │
│              React + TypeScript + Tailwind          │
│                                                     │
│   Admin Dashboard   Ops Portal   Client Portfolio  │
└───────────────────────┬─────────────────────────────┘
                        │ REST / JSON
┌───────────────────────▼─────────────────────────────┐
│                   Backend (FastAPI)                 │
│                                                     │
│  Auth   Accounts   Deposits   Withdrawals   Prices  │
│                 Vaults   Config                     │
└───────────────────────┬─────────────────────────────┘
                        │ SQLAlchemy ORM
┌───────────────────────▼─────────────────────────────┐
│                      PostgreSQL                     │
└─────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│            Metal Price API (metalpriceapi.com)      │
│         Cached in DB · TTL configurable             │
└─────────────────────────────────────────────────────┘
```

**Stack:**
- **Backend:** Python, FastAPI, SQLAlchemy, Alembic
- **Frontend:** React, TypeScript, TailwindCSS, shadcn/ui, Leaflet.js
- **Database:** PostgreSQL (via Docker)
- **Auth:** JWT (HS256), role-based

---

## Data Model

```
accounts
  id, name, email, password_hash
  role          ENUM(admin, ops, client)
  account_type  ENUM(retail, institutional)   -- null for admin/ops
  is_active, created_by, created_at

vaults
  id, name, latitude, longitude
  is_active, created_by, created_at

metal_prices
  id, metal     ENUM(gold, silver, platinum)
  price_usd_per_troy_oz
  fetched_at, raw_response (JSON)

system_config
  key (unique), value, updated_by, updated_at
  -- keys: "mvr_usd_rate", "price_cache_ttl_hours"

deposits
  id, deposit_number, account_id, vault_id
  metal         ENUM(gold, silver, platinum)
  storage_type  ENUM(allocated, unallocated)
  token_amount  INTEGER   -- retail only (1 token = 0.1g), null for allocated
  created_by (ops user), created_at

allocated_bars
  id, deposit_id
  serial_number (unique), weight_g (DECIMAL)

unallocated_pools
  vault_id, metal  -- composite PK
  total_tokens     INTEGER

token_balances
  account_id, metal  -- composite PK
  balance            INTEGER  -- maintained cache, always >= 0

withdrawals
  id, withdrawal_number (unique, e.g. WDR-FD73DA9B7274)
  account_id, vault_id, metal
  storage_type, token_amount (retail only)
  created_by (ops user), created_at

withdrawal_bars   -- institutional only
  withdrawal_id, bar_id
```

**Token unit:** `1 token = 0.1g`. All retail quantities stored and computed as integers.
Conversion on frontend: `kg = tokens / 10000`, `g = tokens / 10`.

---

## User Roles

| Role | Description |
|---|---|
| `admin` | Full system access. Manages accounts, vaults, and configuration. |
| `ops` | Operational access. Processes deposits and withdrawals on behalf of clients. |
| `client` | Read-only portfolio access for their own holdings. |

---

## Use Cases

### Admin

**Account Management**
- Create ops accounts
- Create client accounts (retail or institutional)
- View all accounts
- Deactivate accounts (blocked if account has active holdings)

**Vault Management**
- Add a vault by placing a marker on a map of the Maldives
- View all vaults with metal totals per vault
- Deactivate a vault (blocked if vault has active holdings)

**System Configuration**
- Set MVR/USD conversion rate (default: 15.42)
- Set price cache TTL in hours (default: 24)

**Reporting**
- Dashboard: all vaults on map, total metals per vault per metal type
- View all deposits and withdrawals across the system
- View current metal prices and last fetch time

---

### Ops

**Deposits**
- Create unallocated deposit: select client account, vault, metal, quantity in grams
- Create allocated deposit: select client account, vault, metal, add bars (serial number + weight per bar)

**Withdrawals**
- Process unallocated withdrawal: select client account, metal, quantity in grams
- Process allocated withdrawal: select client account, select specific bars to release

**Visibility**
- View any client's portfolio
- View vault inventory (total metals held per vault)

---

### Client

**Portfolio**
- View holdings per metal (displayed in kg + USD or MVR value)
- Toggle display currency between USD and MVR
- View deposit history
- View withdrawal history
- Institutional clients: view their bars (serial number, weight in grams)

---

## Edge Cases

### 1. Withdrawal exceeds available balance
**Retail:** `token_balances.balance` is checked before processing. If `requested_tokens > balance`, the withdrawal is rejected with HTTP 422.

**Institutional:** Each bar is validated to belong to the requesting account and be not yet withdrawn. Any mismatch rejects the entire withdrawal.

### 2. Vault pool insufficient for withdrawal
Even if a retail client's token balance is sufficient, the specific vault's pool (`unallocated_pools.total_tokens`) must also cover the withdrawal. A client's tokens are tied to the vault their deposit was made into. If the vault pool is short, the withdrawal is rejected. This prevents a scenario where pool-level funds are over-committed.

### 3. Vault deactivation with active holdings
A vault cannot be deactivated if:
- Any `unallocated_pools` row for that vault has `total_tokens > 0`
- Any `allocated_bars` linked to a deposit in that vault are active (not withdrawn)

Vaults are **never hard deleted** — all historical deposit and withdrawal records reference vault IDs and must remain intact for audit purposes.

### 4. Duplicate bar serial number
`allocated_bars.serial_number` has a `UNIQUE` constraint at the database level. Attempting to deposit a bar with a serial number already in the system returns HTTP 409 Conflict, regardless of vault or account.

### 5. Non-multiple of 0.1g deposit or withdrawal
The API accepts `token_amount` as an integer — since 1 token = 0.1g, any integer is inherently a valid multiple of 0.1g. The frontend is responsible for converting the user's gram/kg input to tokens before sending the request. A `token_amount` of zero or below is rejected at the validation layer before any database write occurs.

### 6. Price feed unavailable
If the external price API is unreachable, the system serves the most recently cached price from `metal_prices` with a `stale: true` flag in the response. Valuations will display with a warning indicator on the frontend. If no cached price exists at all, valuation endpoints return an error and the portfolio is shown without USD/MVR values.

### 7. Concurrent withdrawals on the same pool
Simultaneous withdrawal requests targeting the same vault+metal pool are handled by acquiring a row-level lock on the `unallocated_pools` row (`SELECT ... FOR UPDATE`) inside the transaction. This prevents two concurrent requests from both passing the balance check and together over-drawing the pool.

### 8. Account type and storage type mismatch
- Retail accounts (`account_type=retail`) cannot use allocated storage
- Institutional accounts (`account_type=institutional`) cannot use unallocated storage

This is enforced at the service layer on every deposit request, not just at account creation.

### 9. Deactivating an account with active holdings
An account cannot be deactivated if they hold any active token balance or any active allocated bars. The admin is shown a summary of remaining holdings before the action is blocked.

### 10. Allocated bar weight not a multiple of 0.1g
Physical bars may have stamped weights that do not align to 0.1g precision (e.g., 12,441.36g). In this case, `weight_g` stores the exact physical weight as a decimal for the legal record. The bar is not assigned tokens — allocated storage does not use the token system. Bar weights are displayed as-is on the institutional client's portfolio.

---

## Setup Instructions

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) (included with Docker Desktop)

### Running the stack

```bash
git clone https://github.com/your-username/bare-metals.git
cd bare-metals

cp .env.example .env
# Edit .env and set your METAL_PRICE_API_KEY

docker compose up --build
```

That's it. The following services will start:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 (internal) |

Database migrations and the initial admin seed run automatically on first boot.

### Stopping the stack

```bash
docker compose down
```

To also wipe the database volume:

```bash
docker compose down -v
```

### Environment Variables

Copy `.env.example` to `.env` and set the following:

```
# Required
METAL_PRICE_API_KEY=your-api-key-here

# Optional — defaults shown
SECRET_KEY=changeme-use-a-long-random-string-in-production
POSTGRES_PASSWORD=baremetals
PRICE_CACHE_TTL_HOURS=24
MVR_USD_RATE=15.42
```

### Default Admin Credentials
```
email:    admin@baremetals.mv
password: changeme123
```

> Change the admin password immediately after first login.

---

## API Reference

### Auth
```
POST   /auth/login              → { access_token, token_type }
GET    /auth/me                 → current user profile
```

### Accounts
```
POST   /accounts                → create account (admin only)
GET    /accounts                → list all accounts (admin/ops)
GET    /accounts/{id}           → get account detail
PATCH  /accounts/{id}/deactivate
```

### Vaults
```
POST   /vaults                  → create vault (admin only)
GET    /vaults                  → list all vaults with metal totals
GET    /vaults/{id}             → vault detail + inventory
PATCH  /vaults/{id}/deactivate
```

### Deposits
```
POST   /deposits                → create deposit (ops only)
GET    /deposits                → list deposits (admin/ops)
GET    /deposits/{id}           → deposit detail
```

**Unallocated deposit payload:**
```json
{
  "account_id": 1,
  "vault_id": 2,
  "metal": "gold",
  "storage_type": "unallocated",
  "token_amount": 10000
}
```

**Allocated deposit payload:**
```json
{
  "account_id": 3,
  "vault_id": 2,
  "metal": "gold",
  "storage_type": "allocated",
  "bars": [
    { "serial_number": "GB-001", "weight_g": 1000.0 },
    { "serial_number": "GB-002", "weight_g": 1000.0 }
  ]
}
```

> `weight_g` on bars is a physical record only — it is stored as a decimal for legal accuracy and displayed to the client, but never used in any computation.

### Withdrawals
```
POST   /withdrawals             → process withdrawal (ops only)
GET    /withdrawals             → list withdrawals (admin/ops)
```

**Unallocated withdrawal payload:**
```json
{
  "account_id": 1,
  "metal": "gold",
  "storage_type": "unallocated",
  "token_amount": 5000
}
```

**Allocated withdrawal payload:**
```json
{
  "account_id": 3,
  "storage_type": "allocated",
  "bar_ids": [1, 2]
}
```

### Portfolio
```
GET    /portfolio/{account_id}  → holdings + valuations (client: own only)
```

### Prices
```
GET    /prices                  → current cached prices + stale flag
POST   /prices/refresh          → force refresh (admin only)
```

### Config
```
GET    /config                  → get system config values
PATCH  /config                  → update config (admin only)
```

**Config payload:**
```json
{
  "mvr_usd_rate": 15.42,
  "price_cache_ttl_hours": 24
}
```

---

## Assumptions & Design Decisions

**Token system (retail only)**
The internal unit of account for unallocated (retail) holdings is a token, where `1 token = 0.1g`. All quantities are stored as integers to avoid floating point precision issues. Tokens are never exposed to clients — the UI always displays quantities in kg and values in USD or MVR.

**Allocated storage does not use tokens**
Institutional clients hold specific physical bars tracked by serial number and weight. The token system is not applicable to allocated storage. Bar weights are stored as decimals for legal accuracy.

**Deposits are immutable**
Deposit records are never modified after creation. Withdrawals are separate records. The current balance for a retail client is always `SUM(deposits.token_amount) - SUM(withdrawals.token_amount)` for that account and metal. `token_balances` is a maintained cache of this value, updated atomically in the same transaction as every deposit or withdrawal.

**Pools are per vault per metal**
Each vault maintains an independent pool per metal type for unallocated storage. A retail client's holding is always tied to the vault their deposit was made into. Cross-vault transfers are acknowledged as an operational need but are out of scope for this prototype.

**Vault and account soft deletes only**
Neither vaults nor accounts are ever hard deleted. All historical records retain their foreign key references. Deactivation is the only supported operation, and it is blocked if active holdings exist.

**Price caching**
Metal prices are fetched from metalpriceapi.com at most once per configurable TTL window (default 24 hours). The API returns rates in troy oz; the backend converts to per-kg for internal use. The last successful fetch is always cached — the system never serves zero prices if the API is temporarily unavailable.

**MVR conversion**
The MVR/USD rate is stored in `system_config` and defaults to 15.42. Currency conversion is performed client-side using the rate fetched at page load. There is no live MVR rate feed — the rate is updated manually by the admin.

**Partial withdrawals for unallocated storage**
Retail clients may withdraw any quantity that is a multiple of 0.1g, regardless of the size of their original deposit. A deposit of 10kg can be partially withdrawn in increments as small as 0.1g. This is possible because unallocated metals are held in a pooled bulk at the facility and can be physically broken down to 0.1g precision. The original deposit record is not modified — the withdrawal is recorded as a separate entry and the difference remains as the client's active balance.

**No client-facing auth self-service**
Clients cannot register themselves. All accounts are created by the admin. Password reset flows are out of scope for this prototype.

**Platinum support**
The system is designed to support gold, silver, and platinum equally. All metal-specific logic uses an enum — adding a new metal type requires only a migration to extend the enum and no business logic changes.
