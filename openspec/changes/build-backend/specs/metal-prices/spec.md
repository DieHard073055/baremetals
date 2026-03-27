## ADDED Requirements

### Requirement: Price Caching
The system SHALL fetch metal prices (gold, silver, platinum) from metalpriceapi.com at most once per configurable TTL window. Prices SHALL be stored in the `metal_prices` table in USD per troy oz.

#### Scenario: Cache within TTL
- **WHEN** `GET /prices` is called and the last fetch is within TTL
- **THEN** return cached prices without calling the external API

#### Scenario: Cache expired
- **WHEN** `GET /prices` is called and TTL has elapsed
- **THEN** fetch fresh prices, persist them, and return with `stale: false`

### Requirement: Stale Price Fallback
If the external price API is unreachable, the system SHALL serve the last cached price with `stale: true`. If no cached price exists at all, the endpoint SHALL return an error.

#### Scenario: API unreachable, cache exists
- **WHEN** metalpriceapi.com is unreachable and a cached price exists
- **THEN** return last cached price with `stale: true` and last fetch timestamp

#### Scenario: API unreachable, no cache
- **WHEN** metalpriceapi.com is unreachable and no price has ever been fetched
- **THEN** return HTTP 503

### Requirement: Price Endpoints
`GET /prices` SHALL return current cached prices. `POST /prices/refresh` SHALL force an immediate fetch (admin only).

#### Scenario: Force refresh
- **WHEN** admin calls `POST /prices/refresh`
- **THEN** immediately fetch from the external API, persist, and return new prices

#### Scenario: Non-admin force refresh
- **WHEN** an ops user calls `POST /prices/refresh`
- **THEN** return HTTP 403
