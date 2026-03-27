## ADDED Requirements

### Requirement: Portfolio Holdings
`GET /portfolio/{account_id}` SHALL return the account's current holdings per metal. Retail clients show token balances converted to kg; institutional clients show active bars with serial number and weight.

#### Scenario: Retail client portfolio
- **WHEN** called for a retail account
- **THEN** return per-metal token balance (expressed in kg) with no bar detail

#### Scenario: Institutional client portfolio
- **WHEN** called for an institutional account
- **THEN** return a list of active bars per metal with serial_number and weight_g

#### Scenario: Client accessing another account's portfolio
- **WHEN** a client calls the endpoint with a different account_id
- **THEN** return HTTP 403

### Requirement: Portfolio Valuation
Holdings SHALL be valued in USD and MVR using the current cached metal price and the system MVR/USD rate.

#### Scenario: Price available
- **WHEN** a valid cached price exists within TTL
- **THEN** return USD and MVR valuations alongside holdings; `stale: false`

#### Scenario: Stale price
- **WHEN** the cache exists but TTL has expired and the price API is unreachable
- **THEN** return the last cached price with `stale: true` and still show valuations

#### Scenario: No cached price
- **WHEN** no price has ever been fetched and the API is unreachable
- **THEN** return holdings without valuations and include an error indicator
