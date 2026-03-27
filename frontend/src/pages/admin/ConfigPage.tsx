import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Config } from '../../types'

export function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [form, setForm] = useState({ mvr_usd_rate: '', price_cache_ttl_hours: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get<Config>('/config')
    setConfig(data)
    setForm({ mvr_usd_rate: String(data.mvr_usd_rate), price_cache_ttl_hours: String(data.price_cache_ttl_hours) })
  }

  useEffect(() => { load() }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const { data } = await api.patch<Config>('/config', {
        mvr_usd_rate: parseFloat(form.mvr_usd_rate),
        price_cache_ttl_hours: parseInt(form.price_cache_ttl_hours),
      })
      setConfig(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400'

  if (!config) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-stone-400 text-sm">Loading configuration…</p>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">System Configuration</h1>
        <p className="text-sm text-slate-500">Platform-wide settings for valuation and price caching</p>
      </div>

      <div className="max-w-md">
        <form onSubmit={save} className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              MVR / USD Exchange Rate
            </label>
            <input type="number" step="0.01" required
              value={form.mvr_usd_rate}
              onChange={e => setForm(f => ({ ...f, mvr_usd_rate: e.target.value }))}
              className={inputCls} />
            <p className="text-xs text-stone-400 mt-1.5">
              Maldivian Rufiyaa per 1 US Dollar. Used in portfolio valuations.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Price Cache TTL (hours)
            </label>
            <input type="number" min="1" required
              value={form.price_cache_ttl_hours}
              onChange={e => setForm(f => ({ ...f, price_cache_ttl_hours: e.target.value }))}
              className={inputCls} />
            <p className="text-xs text-stone-400 mt-1.5">
              How long to serve cached prices before re-fetching from the external API.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
          {saved && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded-lg">
              ✓ Configuration saved successfully
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: 'var(--bm-gold)' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
