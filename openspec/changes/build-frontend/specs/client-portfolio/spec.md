## ADDED Requirements

### Requirement: Holdings Display
The client portfolio page SHALL display current holdings per metal in kg with USD and MVR valuations.

#### Scenario: Holdings with valid price
- **WHEN** a client views their portfolio and prices are current
- **THEN** each metal card shows quantity in kg, value in selected currency

#### Scenario: No holdings
- **WHEN** a client has zero balance for a metal
- **THEN** the metal card shows 0 kg and 0 value

### Requirement: Currency Toggle
The client portfolio SHALL provide a USD / MVR toggle. Switching currency SHALL recalculate all displayed values client-side using the MVR rate fetched at page load.

#### Scenario: Toggle to MVR
- **WHEN** the client switches to MVR
- **THEN** all value fields update to MVR amounts without a new API call

### Requirement: Transaction History
The client portfolio SHALL include deposit and withdrawal history tabs showing the client's own records.

#### Scenario: Deposit history
- **WHEN** the client opens the deposits tab
- **THEN** a table of their deposits is shown with date, vault, metal, quantity

### Requirement: Institutional Bar List
For institutional clients, the portfolio SHALL include a tab listing all active bars with serial number and weight in grams.

#### Scenario: Bar list
- **WHEN** an institutional client views their portfolio
- **THEN** a bars tab is visible showing serial_number and weight_g for each active bar

### Requirement: Stale Price Banner
When portfolio valuations are based on stale price data, the UI SHALL display a visible warning banner.

#### Scenario: Stale price shown
- **WHEN** the portfolio API returns `stale: true`
- **THEN** a banner reads "Price data may be outdated" above the holdings
