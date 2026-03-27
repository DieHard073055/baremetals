## ADDED Requirements

### Requirement: Unallocated Deposit
`POST /deposits` with `storage_type: "unallocated"` SHALL create a deposit for a retail client, incrementing `unallocated_pools` and `token_balances` atomically in the same transaction.

#### Scenario: Valid unallocated deposit
- **WHEN** ops posts a valid unallocated deposit with `token_amount > 0`
- **THEN** return HTTP 201, pool and balance are incremented by `token_amount`

#### Scenario: token_amount zero or negative
- **WHEN** ops posts `token_amount <= 0`
- **THEN** return HTTP 422 before any DB write

#### Scenario: Institutional account uses unallocated storage
- **WHEN** ops attempts an unallocated deposit for an institutional account
- **THEN** return HTTP 422

### Requirement: Allocated Deposit
`POST /deposits` with `storage_type: "allocated"` SHALL create a deposit for an institutional client, inserting all provided bars. Each bar must have a globally unique `serial_number`.

#### Scenario: Valid allocated deposit
- **WHEN** ops posts an allocated deposit with one or more bars
- **THEN** return HTTP 201 with the created deposit and all bar records

#### Scenario: Duplicate bar serial number
- **WHEN** ops posts a bar with a serial_number already in the system
- **THEN** return HTTP 409 and no records are inserted

#### Scenario: Retail account uses allocated storage
- **WHEN** ops attempts an allocated deposit for a retail account
- **THEN** return HTTP 422

### Requirement: Deposit Listing and Detail
`GET /deposits` SHALL list all deposits accessible to admin and ops. `GET /deposits/{id}` SHALL return full detail including associated bars for allocated deposits.

#### Scenario: List deposits
- **WHEN** admin calls `GET /deposits`
- **THEN** return all deposit records with account_id, vault_id, metal, storage_type

#### Scenario: Allocated deposit detail
- **WHEN** `GET /deposits/{id}` is called for an allocated deposit
- **THEN** the response includes the list of bars with serial_number and weight_g
