## ADDED Requirements

### Requirement: Login
The system SHALL authenticate users via `POST /auth/login` using email and password, returning a signed JWT (HS256) on success.

#### Scenario: Valid credentials
- **WHEN** a valid email and password are submitted
- **THEN** return HTTP 200 with `{ access_token, token_type: "bearer" }`

#### Scenario: Invalid credentials
- **WHEN** the email does not exist or the password is wrong
- **THEN** return HTTP 401

#### Scenario: Inactive account
- **WHEN** the account exists but `is_active` is false
- **THEN** return HTTP 401

### Requirement: Current User Profile
The system SHALL expose `GET /auth/me` returning the authenticated user's profile.

#### Scenario: Valid token
- **WHEN** a valid Bearer token is provided
- **THEN** return the account id, name, email, role, and account_type

#### Scenario: Missing or expired token
- **WHEN** no token or an expired token is provided
- **THEN** return HTTP 401

### Requirement: Role-Based Access Control
All protected endpoints SHALL enforce role restrictions. Requests by unauthorized roles SHALL be rejected with HTTP 403.

#### Scenario: Admin-only endpoint accessed by ops
- **WHEN** an ops user calls `POST /vaults`
- **THEN** return HTTP 403

#### Scenario: Client accessing own portfolio
- **WHEN** a client calls `GET /portfolio/{their own account_id}`
- **THEN** return HTTP 200

#### Scenario: Client accessing another client's portfolio
- **WHEN** a client calls `GET /portfolio/{other account_id}`
- **THEN** return HTTP 403
