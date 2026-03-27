## ADDED Requirements

### Requirement: Deposit Form
The ops portal SHALL provide a form for processing deposits. The form SHALL allow selection of client account, vault, and metal. The storage type (unallocated vs allocated) SHALL be inferred from the selected client's `account_type`.

#### Scenario: Unallocated deposit
- **WHEN** ops selects a retail client, enters a gram quantity, and submits
- **THEN** the quantity is converted to tokens (grams × 10) and sent to `POST /deposits`

#### Scenario: Allocated deposit
- **WHEN** ops selects an institutional client and adds bars (serial number + weight per bar)
- **THEN** the bars array is sent to `POST /deposits`

### Requirement: Withdrawal Form
The ops portal SHALL provide a form for processing withdrawals. For unallocated, ops enters a gram quantity. For allocated, ops selects bars from the client's active bar list.

#### Scenario: Unallocated withdrawal
- **WHEN** ops enters a gram quantity and submits
- **THEN** the quantity is converted to tokens and sent to `POST /withdrawals`

#### Scenario: Allocated withdrawal
- **WHEN** ops selects one or more bars from the client's bar list and submits
- **THEN** the selected bar IDs are sent to `POST /withdrawals`

### Requirement: Client Portfolio Viewer
Ops SHALL be able to search for and view any client's portfolio, including holdings and transaction history.

#### Scenario: View client portfolio
- **WHEN** ops selects a client account
- **THEN** the client's holdings and deposit/withdrawal history are displayed
