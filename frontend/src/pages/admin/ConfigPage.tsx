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
    setForm({
      mvr_usd_rate: String(data.mvr_usd_rate),
      price_cache_ttl_hours: String(data.price_cache_ttl_hours),
    })
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

  if (!config) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">System Configuration</h1>

      <form onSubmit={save} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            MVR / USD Rate
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={form.mvr_usd_rate}
            onChange={e => setForm(f => ({ ...f, mvr_usd_rate: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">How many MVR per 1 USD</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price Cache TTL (hours)
          </label>
          <input
            type="number"
            min="1"
            required
            value={form.price_cache_ttl_hours}
            onChange={e => setForm(f => ({ ...f, price_cache_ttl_hours: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">How long to serve cached prices before re-fetching</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">✓ Saved successfully</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
