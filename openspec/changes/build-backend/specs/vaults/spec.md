## ADDED Requirements

### Requirement: Vault Creation
`POST /vaults` SHALL create a vault with a name and geographic coordinates (latitude, longitude). Only admins may create vaults.

#### Scenario: Create vault
- **WHEN** admin posts `{ name, latitude, longitude }`
- **THEN** return HTTP 201 with vault id and all fields

#### Scenario: Non-admin attempt
- **WHEN** an ops user calls `POST /vaults`
- **THEN** return HTTP 403

### Requirement: Vault Listing with Metal Totals
`GET /vaults` SHALL return all vaults, each with aggregated totals of tokens held per metal (unallocated) and total bar weight per metal (allocated).

#### Scenario: Vaults with holdings
- **WHEN** vaults have deposits
- **THEN** each vault in the list includes `{ gold_tokens, silver_tokens, platinum_tokens }` and bar weight totals

### Requirement: Vault Detail and Inventory
`GET /vaults/{id}` SHALL return the vault's full inventory: unallocated pool totals and a list of all active allocated bars grouped by metal.

#### Scenario: Vault found
- **WHEN** a valid vault id is requested
- **THEN** return HTTP 200 with full inventory breakdown

#### Scenario: Vault not found
- **WHEN** an unknown id is requested
- **THEN** return HTTP 404

### Requirement: Vault Deactivation
`PATCH /vaults/{id}/deactivate` SHALL deactivate a vault. The operation SHALL be blocked if the vault holds any active unallocated tokens or allocated bars.

#### Scenario: Deactivate empty vault
- **WHEN** admin deactivates a vault with no active holdings
- **THEN** return HTTP 200 and `is_active` becomes false

#### Scenario: Deactivate vault with active pool
- **WHEN** admin attempts to deactivate a vault where `unallocated_pools.total_tokens > 0`
- **THEN** return HTTP 409
