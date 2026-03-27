## ADDED Requirements

### Requirement: Account Creation
The system SHALL allow admins to create accounts via `POST /accounts`. The `role` field determines whether `account_type` is required (required for `client`, null for `admin`/`ops`).

#### Scenario: Create retail client
- **WHEN** admin posts `{ role: "client", account_type: "retail", ... }`
- **THEN** return HTTP 201 with the created account

#### Scenario: Create ops account without account_type
- **WHEN** admin posts `{ role: "ops", ... }` with no `account_type`
- **THEN** return HTTP 201

#### Scenario: Create client without account_type
- **WHEN** admin posts `{ role: "client", ... }` with no `account_type`
- **THEN** return HTTP 422

#### Scenario: Non-admin attempt
- **WHEN** an ops user calls `POST /accounts`
- **THEN** return HTTP 403

### Requirement: Account Listing
`GET /accounts` SHALL return all accounts and be accessible to admin and ops roles.

#### Scenario: Admin lists accounts
- **WHEN** admin calls `GET /accounts`
- **THEN** return all accounts with id, name, email, role, account_type, is_active

### Requirement: Account Detail
`GET /accounts/{id}` SHALL return a single account's full profile.

#### Scenario: Account found
- **WHEN** a valid account id is requested
- **THEN** return HTTP 200 with full account detail

#### Scenario: Account not found
- **WHEN** an unknown id is requested
- **THEN** return HTTP 404

### Requirement: Account Deactivation
`PATCH /accounts/{id}/deactivate` SHALL deactivate an account. The operation SHALL be blocked if the account holds active token balances or active allocated bars.

#### Scenario: Deactivate account with no holdings
- **WHEN** admin deactivates a client with zero balances and no active bars
- **THEN** return HTTP 200 and `is_active` becomes false

#### Scenario: Deactivate account with active holdings
- **WHEN** admin attempts to deactivate a client with a positive token balance
- **THEN** return HTTP 409 with a summary of remaining holdings
