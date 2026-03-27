export type Role = 'admin' | 'ops' | 'client'
export type AccountType = 'retail' | 'institutional'
export type Metal = 'gold' | 'silver' | 'platinum'
export type StorageType = 'allocated' | 'unallocated'

export interface Account {
  id: number
  name: string
  email: string
  role: Role
  account_type: AccountType | null
  is_active: boolean
  created_at: string
}

export interface Vault {
  id: number
  name: string
  latitude: number
  longitude: number
  is_active: boolean
  gold_tokens?: number
  silver_tokens?: number
  platinum_tokens?: number
  gold_bar_weight_g?: number
  silver_bar_weight_g?: number
  platinum_bar_weight_g?: number
}

export interface PoolSummary {
  metal: Metal
  total_tokens: number
}

export interface BarSummary {
  id: number
  serial_number: string
  weight_g: number
  metal?: Metal
}

export interface VaultDetail extends Vault {
  pools: PoolSummary[]
  bars: BarSummary[]
}

export interface Deposit {
  id: number
  deposit_number: string
  account_id: number
  vault_id: number
  metal: Metal
  storage_type: StorageType
  token_amount: number | null
  bars: BarSummary[]
  created_at?: string
}

export interface Withdrawal {
  id: number
  account_id: number
  vault_id: number | null
  metal: Metal | null
  storage_type: StorageType
  token_amount: number | null
  created_at?: string
}

export interface HoldingItem {
  metal: Metal
  balance_tokens?: number
  weight_kg?: number
  bars?: BarSummary[]
  total_weight_g?: number
  value_usd: number | null
  value_mvr: number | null
  stale: boolean | null
}

export interface Portfolio {
  account_id: number
  account_type: AccountType
  holdings: HoldingItem[]
}

export interface PriceItem {
  metal: Metal
  price_usd_per_troy_oz: number
  fetched_at: string
  stale: boolean
}

export interface Config {
  mvr_usd_rate: number
  price_cache_ttl_hours: number
}
