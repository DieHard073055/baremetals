import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { PriceItem } from '../../types'

const METAL_CONFIG: Record<string, { label: string; bg: string; border: string; dot: string }> = {
  gold:     { label: 'Gold',     bg: 'bg-amber-50',  border: 'border-amber-200', dot: 'bg-amber-400' },
  silver:   { label: 'Silver',   bg: 'bg-slate-50',  border: 'border-slate-200', dot: 'bg-slate-400' },
  platinum: { label: 'Platinum', bg: 'bg-blue-50',   border: 'border-blue-200',  dot: 'bg-blue-400'  },
}

export function PricesPage() {
  const [prices, setPrices] = useState<PriceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const { data } = await api.get<PriceItem[]>('/prices')
      setPrices(data)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Unable to load prices')
    }
  }

  async function forceRefresh() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post<PriceItem[]>('/prices/refresh')
      setPrices(data)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Refresh failed — check API key or network')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const isStale = prices.some(p => p.stale)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Metal Prices</h1>
          <p className="text-sm text-slate-500">USD per troy oz · cached from metalpriceapi.com</p>
        </div>
        <button
          onClick={forceRefresh}
          disabled={loading}
          className="text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          style={{ backgroundColor: 'var(--bm-gold)' }}
        >
          {loading ? 'Refreshing…' : '↻ Force Refresh'}
        </button>
      </div>

      {isStale && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <span>⚠️</span>
          <span>Price data is stale — the external API could not be reached. Showing last cached values.</span>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {prices.map(p => {
          const cfg = METAL_CONFIG[p.metal] ?? METAL_CONFIG.gold
          return (
            <div key={p.metal}
              className={`rounded-xl border ${cfg.bg} ${cfg.border} p-5 shadow-sm`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                  <span className="font-semibold text-slate-900 capitalize">{p.metal}</span>
                </div>
                {p.stale && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Stale
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-900">
                ${p.price_usd_per_troy_oz.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">per troy oz</p>
              <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-stone-200">
                {new Date(p.fetched_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          )
        })}
        {prices.length === 0 && !error && (
          <div className="col-span-3 bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400 text-sm shadow-sm">
            <p className="text-2xl mb-2">💰</p>
            No cached prices — click <strong>Force Refresh</strong> to fetch live prices.
          </div>
        )}
      </div>
    </div>
  )
}
