## 0. Test Infrastructure
- [x] 0.1 Add `pytest`, `pytest-asyncio`, `httpx`, `factory-boy`, and `coverage` to dev dependencies
- [x] 0.2 Configure `pytest.ini` / `pyproject.toml`: asyncio mode, test DB URL, coverage thresholds
- [x] 0.3 Write `conftest.py`: async test client, test DB engine, per-test transaction rollback fixture
- [x] 0.4 Write fixtures for each role: `admin_token`, `ops_token`, `retail_client_token`, `institutional_client_token`
- [x] 0.5 Write model factories (factory-boy) for Account, Vault, Deposit, AllocatedBar, Withdrawal

## 1. Project Setup
- [x] 1.1 Scaffold FastAPI app structure (`app/`, `alembic/`, `tests/`)
- [x] 1.2 Write `docker-compose.yml` (api, postgres services)
- [x] 1.3 Write `Dockerfile` for the API service
- [x] 1.4 Write `.env.example` with all required variables
- [x] 1.5 Configure SQLAlchemy async engine and session factory
- [x] 1.6 Write Alembic `env.py` and initial migration for all tables
- [x] 1.7 Write DB seed script to create default admin account on first boot

## 2. Auth
- [x] 2.1 Write tests: login success, wrong password → 401, inactive account → 401, `/auth/me` with valid/invalid token
- [x] 2.2 Write tests: role guard — ops on admin-only endpoint → 403, client on own vs other portfolio → 403
- [x] 2.3 Implement password hashing (bcrypt)
- [x] 2.4 Implement JWT creation and verification (HS256)
- [x] 2.5 `POST /auth/login` — validate credentials, return access token
- [x] 2.6 `GET /auth/me` — return current user profile from token
- [x] 2.7 Write `get_current_user` dependency with role guards (`require_admin`, `require_ops`, `require_client`)

## 3. Accounts
- [x] 3.1 Write tests: create retail/institutional/ops accounts, create client without account_type → 422, non-admin create → 403
- [x] 3.2 Write tests: deactivate account with no holdings → 200, deactivate with active balance → 409
- [x] 3.3 Define `Account` SQLAlchemy model and Pydantic schemas
- [x] 3.4 `POST /accounts` — create account (admin only); enforce account_type rules for client role
- [x] 3.5 `GET /accounts` — list all accounts (admin/ops)
- [x] 3.6 `GET /accounts/{id}` — get account detail; unknown id → 404
- [x] 3.7 `PATCH /accounts/{id}/deactivate` — deactivate; block if active holdings exist

## 4. Vaults
- [x] 4.1 Write tests: create vault success, non-admin → 403, list vaults includes metal totals, vault not found → 404
- [x] 4.2 Write tests: deactivate empty vault → 200, deactivate vault with active pool → 409, deactivate vault with active bars → 409
- [x] 4.3 Define `Vault`, `UnallocatedPool` models and schemas
- [x] 4.4 `POST /vaults` — create vault with lat/lng (admin only)
- [x] 4.5 `GET /vaults` — list all vaults with per-metal totals
- [x] 4.6 `GET /vaults/{id}` — vault detail + full inventory breakdown
- [x] 4.7 `PATCH /vaults/{id}/deactivate` — deactivate; block if active holdings exist

## 5. Deposits
- [ ] 5.1 Write tests: unallocated deposit increments pool and balance, token_amount ≤ 0 → 422, institutional on unallocated → 422
- [ ] 5.2 Write tests: allocated deposit inserts bars, duplicate serial → 409, retail on allocated → 422
- [ ] 5.3 Write tests: deposit detail includes bars for allocated type
- [ ] 5.4 Define `Deposit`, `AllocatedBar` models and schemas
- [ ] 5.5 Validate storage_type vs account_type at service layer
- [ ] 5.6 Implement unallocated deposit: increment `unallocated_pools` and `token_balances` atomically
- [ ] 5.7 Implement allocated deposit: insert bars with unique serial constraint (HTTP 409 on conflict)
- [ ] 5.8 `POST /deposits` — dispatch to correct handler (ops only)
- [ ] 5.9 `GET /deposits` — list all deposits (admin/ops)
- [ ] 5.10 `GET /deposits/{id}` — deposit detail including bars if allocated

## 6. Withdrawals
- [ ] 6.1 Write tests: unallocated withdrawal decrements pool and balance, insufficient balance → 422, insufficient pool → 422
- [ ] 6.2 Write tests: concurrent unallocated withdrawals — only one succeeds when pool would be overdrawn
- [ ] 6.3 Write tests: allocated withdrawal marks bars as withdrawn, bar belongs to wrong account → 422, already-withdrawn bar → 422
- [ ] 6.4 Define `Withdrawal`, `WithdrawalBar` models and schemas
- [ ] 6.5 Implement unallocated withdrawal: `SELECT ... FOR UPDATE` on pool row, validate pool + balance, decrement both atomically
- [ ] 6.6 Implement allocated withdrawal: validate bars belong to account and are not already withdrawn, mark bars as withdrawn
- [ ] 6.7 `POST /withdrawals` — dispatch to correct handler (ops only)
- [ ] 6.8 `GET /withdrawals` — list all withdrawals (admin/ops)

## 7. Portfolio
- [ ] 7.1 Write tests: retail portfolio returns token balance in kg, institutional returns active bar list
- [ ] 7.2 Write tests: valuations correct in USD and MVR, stale flag propagated, no-cache → holdings returned without values
- [ ] 7.3 Write tests: client accessing own portfolio → 200, client accessing other → 403
- [ ] 7.4 Aggregate retail holdings from `token_balances` per metal
- [ ] 7.5 Aggregate institutional holdings from active `allocated_bars` per metal
- [ ] 7.6 Fetch current price from `metal_prices` cache; attach `stale` flag if TTL exceeded or API unreachable
- [ ] 7.7 Compute USD and MVR valuations using price and `system_config.mvr_usd_rate`
- [ ] 7.8 `GET /portfolio/{account_id}` — return holdings + valuations (client: own only; ops/admin: any)

## 8. Metal Prices
- [ ] 8.1 Write tests: price within TTL served from cache (no external call), cache expired triggers fetch and persist
- [ ] 8.2 Write tests: API unreachable with cache → stale: true, API unreachable no cache → 503
- [ ] 8.3 Write tests: force refresh updates cache, non-admin force refresh → 403
- [ ] 8.4 Write metalpriceapi.com HTTP client (fetch gold, silver, platinum in USD/troy oz) — mock in tests
- [ ] 8.5 Implement price cache logic: serve DB cache if within TTL, else fetch and persist
- [ ] 8.6 On fetch failure: return last cached price with `stale: true`; if no cache exists, return HTTP 503
- [ ] 8.7 `GET /prices` — return cached prices with stale flag and last fetch time
- [ ] 8.8 `POST /prices/refresh` — force immediate refresh (admin only)

## 9. System Config
- [ ] 9.1 Write tests: config seeded with defaults on first boot, read config → 200, update MVR rate → reflected in subsequent reads, non-admin update → 403
- [ ] 9.2 Define `SystemConfig` model with `key`/`value` pairs and seed defaults (`mvr_usd_rate=15.42`, `price_cache_ttl_hours=24`)
- [ ] 9.3 `GET /config` — return all config key/value pairs
- [ ] 9.4 `PATCH /config` — update `mvr_usd_rate` and/or `price_cache_ttl_hours` (admin only)
