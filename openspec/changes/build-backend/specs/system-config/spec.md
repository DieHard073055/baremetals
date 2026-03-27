## ADDED Requirements

### Requirement: System Configuration Store
The system SHALL maintain a `system_config` key/value store seeded with defaults: `mvr_usd_rate=15.42` and `price_cache_ttl_hours=24`.

#### Scenario: Config seeded on first boot
- **WHEN** the API starts against a fresh database
- **THEN** both default config keys exist with their default values

### Requirement: Config Read
`GET /config` SHALL return all system config values and be accessible to all authenticated roles.

#### Scenario: Read config
- **WHEN** any authenticated user calls `GET /config`
- **THEN** return `{ mvr_usd_rate, price_cache_ttl_hours }` with current values

### Requirement: Config Update
`PATCH /config` SHALL allow admins to update `mvr_usd_rate` and/or `price_cache_ttl_hours`.

#### Scenario: Update MVR rate
- **WHEN** admin patches `{ mvr_usd_rate: 15.50 }`
- **THEN** return HTTP 200 with the updated config; subsequent portfolio valuations use the new rate

#### Scenario: Non-admin update attempt
- **WHEN** an ops user calls `PATCH /config`
- **THEN** return HTTP 403
