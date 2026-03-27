import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Account, Vault, Metal, Portfolio, BarSummary } from '../../types'

const METALS: Metal[] = ['gold', 'silver', 'platinum']
const inputCls = 'w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400'

export function WithdrawalPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [vaults, setVaults] = useState<Vault[]>([])
  const [accountId, setAccountId] = useState('')
  const [vaultId, setVaultId] = useState('')
  const [metal, setMetal] = useState<Metal>('gold')
  const [grams, setGrams] = useState('')
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [selectedBarIds, setSelectedBarIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Account[]>('/accounts').then(r => setAccounts(r.data.filter(a => a.role === 'client' && a.is_active)))
    api.get<Vault[]>('/vaults').then(r => setVaults(r.data.filter(v => v.is_active)))
  }, [])

  const selectedAccount = accounts.find(a => String(a.id) === accountId)
  const storageType = selectedAccount?.account_type === 'institutional' ? 'allocated' : 'unallocated'

  useEffect(() => {
    setPortfolio(null)
    setSelectedBarIds(new Set())
    if (accountId) {
      api.get<Portfolio>(`/portfolio/${accountId}`).then(r => setPortfolio(r.data)).catch(() => {})
    }
  }, [accountId])

  const activeBars: BarSummary[] = portfolio?.holdings.flatMap(h => h.bars ?? []) ?? []

  function toggleBar(id: number) {
    setSelectedBarIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const body: Record<string, any> = { account_id: Number(accountId), storage_type: storageType }
      if (storageType === 'unallocated') {
        const tokens = Math.round(parseFloat(grams) * 10)
        if (tokens <= 0) { setError('Weight must be positive'); setLoading(false); return }
        body.vault_id = Number(vaultId)
        body.metal = metal
        body.token_amount = tokens
      } else {
        if (selectedBarIds.size === 0) { setError('Select at least one bar'); setLoading(false); return }
        body.bar_ids = [...selectedBarIds]
      }
      await api.post('/withdrawals', body)
      setSuccess('Withdrawal recorded successfully.')
      setGrams('')
      setSelectedBarIds(new Set())
      if (accountId) api.get<Portfolio>(`/portfolio/${accountId}`).then(r => setPortfolio(r.data)).catch(() => {})
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to create withdrawal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">New Withdrawal</h1>
        <p className="text-sm text-slate-500">Process a client metal withdrawal from a vault</p>
      </div>

      <div className="max-w-lg">
        <form onSubmit={submit} className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Client Account</label>
            <select required value={accountId} onChange={e => setAccountId(e.target.value)} className={inputCls}>
              <option value="">Select client…</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} · {a.account_type}</option>
              ))}
            </select>
          </div>

          {accountId && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
              storageType === 'allocated'
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <span>{storageType === 'allocated' ? '📦' : '🪙'}</span>
              <span>Storage type: <strong className="capitalize">{storageType}</strong></span>
            </div>
          )}

          {storageType === 'unallocated' && accountId && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Vault</label>
                <select required value={vaultId} onChange={e => setVaultId(e.target.value)} className={inputCls}>
                  <option value="">Select vault…</option>
                  {vaults.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Metal</label>
                <select value={metal} onChange={e => setMetal(e.target.value as Metal)} className={inputCls}>
                  {METALS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Weight (grams)</label>
                <input type="number" step="0.1" min="0.1" value={grams}
                  onChange={e => setGrams(e.target.value)} placeholder="e.g. 50.0" className={inputCls} />
                {grams && parseFloat(grams) > 0 && (
                  <p className="text-xs text-stone-400 mt-1.5">= {Math.round(parseFloat(grams) * 10)} tokens</p>
                )}
              </div>
            </>
          )}

          {storageType === 'allocated' && accountId && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Select Bars ({selectedBarIds.size} selected)
              </label>
              {activeBars.length === 0
                ? <p className="text-sm text-stone-400 py-4 text-center border border-stone-200 rounded-lg">
                    No active bars for this account
                  </p>
                : (
                  <div className="max-h-52 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                    {activeBars.map(b => (
                      <label key={b.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-stone-50">
                        <input type="checkbox" checked={selectedBarIds.has(b.id)}
                          onChange={() => toggleBar(b.id)}
                          className="rounded accent-amber-500" />
                        <span className="text-sm font-mono text-slate-700 flex-1">{b.serial_number}</span>
                        <span className="text-xs text-stone-400">{b.weight_g}g</span>
                      </label>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded-lg">✓ {success}</div>}

          <button type="submit" disabled={loading || !accountId}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: 'var(--bm-gold)' }}>
            {loading ? 'Submitting…' : 'Submit Withdrawal'}
          </button>
        </form>
      </div>
    </div>
  )
}
