import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { PriceItem } from '../../types'

const METAL_ICON: Record<string, string> = { gold: '🥇', silver: '🥈', platinum: '⬜' }

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
    try {
      const { data } = await api.post<PriceItem[]>('/prices/refresh')
      setPrices(data)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Refresh failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const isStale = prices.some(p => p.stale)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Metal Prices</h1>
        <button
          onClick={forceRefresh}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Refreshing…' : '↻ Force Refresh'}
        </button>
      </div>

      {isStale && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-3 text-sm">
          ⚠️ Price data is stale — the external price API could not be reached. Values shown are from the last successful fetch.
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {prices.map(p => (
          <div key={p.metal} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-medium capitalize text-gray-900">
                {METAL_ICON[p.metal]} {p.metal}
              </span>
              {p.stale && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Stale</span>
              )}
            </div>
            <p className="text-2xl font-semibold text-gray-900">
              ${p.price_usd_per_troy_oz.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">per troy oz</p>
            <p className="text-xs text-gray-400 mt-2">
              Last fetched: {new Date(p.fetched_at).toLocaleString()}
            </p>
          </div>
        ))}
        {prices.length === 0 && !error && (
          <p className="col-span-3 text-center text-gray-400 text-sm py-8">
            No cached prices. Click "Force Refresh" to fetch from the external API.
          </p>
        )}
      </div>
    </div>
  )
}
