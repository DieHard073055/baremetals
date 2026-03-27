## ADDED Requirements

### Requirement: Unallocated Withdrawal
`POST /withdrawals` with `storage_type: "unallocated"` SHALL process a retail withdrawal. Both the client's `token_balances` and the vault's `unallocated_pools` row SHALL be checked and decremented atomically under a row-level lock.

#### Scenario: Valid unallocated withdrawal
- **WHEN** ops posts a withdrawal where `token_amount <= client balance` and `token_amount <= vault pool`
- **THEN** return HTTP 201; both balance and pool are decremented

#### Scenario: Insufficient client balance
- **WHEN** `token_amount > token_balances.balance` for that account and metal
- **THEN** return HTTP 422

#### Scenario: Insufficient vault pool
- **WHEN** client balance is sufficient but vault pool is insufficient
- **THEN** return HTTP 422

#### Scenario: Concurrent withdrawals on the same pool
- **WHEN** two simultaneous requests both try to withdraw from the same vault+metal pool
- **THEN** only one succeeds if combined amount would overdraw; row-level lock prevents both passing the balance check

### Requirement: Allocated Withdrawal
`POST /withdrawals` with `storage_type: "allocated"` SHALL process an institutional withdrawal by releasing specific bars identified by `bar_ids`. All bars must belong to the requesting account and must not be already withdrawn.

#### Scenario: Valid allocated withdrawal
- **WHEN** ops posts `{ account_id, storage_type: "allocated", bar_ids: [...] }` with valid bars
- **THEN** return HTTP 201; bars are marked as withdrawn

#### Scenario: Bar belongs to different account
- **WHEN** any bar_id in the request belongs to a different account
- **THEN** return HTTP 422 and no bars are withdrawn

#### Scenario: Bar already withdrawn
- **WHEN** any bar_id has already been released
- **THEN** return HTTP 422 and the entire withdrawal is rejected

### Requirement: Withdrawal Listing
`GET /withdrawals` SHALL list all withdrawals accessible to admin and ops.

#### Scenario: List withdrawals
- **WHEN** admin calls `GET /withdrawals`
- **THEN** return all withdrawal records with account_id, vault_id, metal, storage_type
