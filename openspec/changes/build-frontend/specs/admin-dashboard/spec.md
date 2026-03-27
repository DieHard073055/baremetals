## ADDED Requirements

### Requirement: Account Management UI
The admin dashboard SHALL provide a table of all accounts with the ability to create new accounts via a modal form and deactivate existing ones.

#### Scenario: Create account
- **WHEN** admin fills in name, email, password, role, and account_type (if client) and submits
- **THEN** the new account appears in the table

#### Scenario: Deactivate account with holdings
- **WHEN** admin clicks deactivate on an account with active holdings
- **THEN** a warning modal shows the remaining holdings before blocking the action

### Requirement: Vault Map
The admin dashboard SHALL display all vaults on a Leaflet.js map of the Maldives. Clicking on a vault marker SHALL show a popup with the vault name and per-metal totals. New vaults SHALL be created by clicking on the map to place a marker.

#### Scenario: Place new vault
- **WHEN** admin clicks on the map and fills in the vault name
- **THEN** the vault is created and its marker appears on the map

#### Scenario: Vault popup
- **WHEN** admin clicks an existing vault marker
- **THEN** a popup shows gold/silver/platinum totals for that vault

### Requirement: System Configuration Panel
The admin dashboard SHALL expose a form to update `mvr_usd_rate` and `price_cache_ttl_hours`.

#### Scenario: Update config
- **WHEN** admin changes the MVR rate and saves
- **THEN** the new value is persisted and reflected in subsequent valuations

### Requirement: Admin Reporting
The admin dashboard SHALL display a paginated/filtered table of all deposits and withdrawals across the system, and a metal prices panel showing current prices, last fetch time, stale warning, and a force refresh button.

#### Scenario: Stale price warning
- **WHEN** the price data has `stale: true`
- **THEN** a warning badge is shown next to the price values
