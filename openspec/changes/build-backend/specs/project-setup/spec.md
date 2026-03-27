## ADDED Requirements

### Requirement: Docker Compose Stack
The project SHALL be runnable with a single `docker compose up --build` command that starts the API service and PostgreSQL. Alembic migrations and the admin seed SHALL run automatically on first boot.

#### Scenario: First boot
- **WHEN** `docker compose up --build` is run on a clean environment
- **THEN** the API is reachable at `http://localhost:8000` and the default admin account exists

#### Scenario: Stack teardown
- **WHEN** `docker compose down -v` is run
- **THEN** all containers and the database volume are removed

### Requirement: Environment Configuration
The project SHALL provide a `.env.example` file listing all required and optional variables. The only required variable is `METAL_PRICE_API_KEY`.

#### Scenario: Missing required variable
- **WHEN** `METAL_PRICE_API_KEY` is not set
- **THEN** the API fails to start with a clear configuration error

### Requirement: Test Infrastructure
The project SHALL include a fully configured test suite using `pytest`, `pytest-asyncio`, and `httpx`. A `conftest.py` SHALL provide: an async test client, a test database session with per-test transaction rollback, and token fixtures for each role (admin, ops, retail client, institutional client). Factory-boy factories SHALL exist for all major models. The test suite SHALL run without any external network calls.

#### Scenario: Run full test suite
- **WHEN** `pytest` is run
- **THEN** all tests pass and coverage report is generated; no real network calls are made

#### Scenario: Per-test isolation
- **WHEN** a test writes data to the database
- **THEN** that data is not visible to any other test

### Requirement: Database Migrations
Alembic SHALL manage all schema changes. The initial migration SHALL create all tables defined in the data model.

#### Scenario: Fresh database
- **WHEN** migrations run against an empty database
- **THEN** all tables are created with correct constraints (PKs, FKs, UNIQUEs, ENUMs)
