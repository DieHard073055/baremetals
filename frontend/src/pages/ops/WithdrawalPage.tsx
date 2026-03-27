import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Account, Vault, Metal, Portfolio, BarSummary } from '../../types'

const METALS: Metal[] = ['gold', 'silver', 'platinum']

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
      const body: Record<string, any> = {
        account_id: Number(accountId),
        storage_type: storageType,
      }
      if (storageType === 'unallocated') {
        const tokens = Math.round(parseFloat(grams) * 10)
        if (tokens <= 0) { setError('Grams must be positive'); setLoading(false); return }
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
      // Reload portfolio
      if (accountId) {
        api.get<Portfolio>(`/portfolio/${accountId}`).then(r => setPortfolio(r.data)).catch(() => {})
      }
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to create withdrawal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">New Withdrawal</h1>

      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client Account</label>
          <select required value={accountId} onChange={e => setAccountId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select client…</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.account_type})</option>
            ))}
          </select>
        </div>

        {accountId && (
          <div className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
            Storage type: <strong className="capitalize">{storageType}</strong>
          </div>
        )}

        {storageType === 'unallocated' && accountId && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vault</label>
              <select required value={vaultId} onChange={e => setVaultId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select vault…</option>
                {vaults.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metal</label>
              <select value={metal} onChange={e => setMetal(e.target.value as Metal)}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {METALS.map(m => <option key={m} value={m} className="capitalize">{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (grams)</label>
              <input type="number" step="0.1" min="0.1" value={grams}
                onChange={e => setGrams(e.target.value)} placeholder="e.g. 50.0"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </>
        )}

        {storageType === 'allocated' && accountId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Bars to Withdraw ({selectedBarIds.size} selected)
            </label>
            {activeBars.length === 0
              ? <p className="text-sm text-gray-400">No active bars for this account</p>
              : (
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {activeBars.map(b => (
                    <label key={b.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={selectedBarIds.has(b.id)}
                        onChange={() => toggleBar(b.id)} className="rounded" />
                      <span className="text-sm text-gray-700">{b.serial_number}</span>
                      <span className="text-xs text-gray-400 ml-auto">{b.weight_g}g</span>
                    </label>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <button type="submit" disabled={loading || !accountId}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'Submitting…' : 'Submit Withdrawal'}
        </button>
      </form>
    </div>
  )
}
