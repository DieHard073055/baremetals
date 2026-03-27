import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Account, Vault, Metal } from '../../types'

interface Bar { serial_number: string; weight_g: string }
const METALS: Metal[] = ['gold', 'silver', 'platinum']
const inputCls = 'w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400'

export function DepositPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [vaults, setVaults] = useState<Vault[]>([])
  const [accountId, setAccountId] = useState('')
  const [vaultId, setVaultId] = useState('')
  const [metal, setMetal] = useState<Metal>('gold')
  const [grams, setGrams] = useState('')
  const [bars, setBars] = useState<Bar[]>([{ serial_number: '', weight_g: '' }])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Account[]>('/accounts').then(r => setAccounts(r.data.filter(a => a.role === 'client' && a.is_active)))
    api.get<Vault[]>('/vaults').then(r => setVaults(r.data.filter(v => v.is_active)))
  }, [])

  const selectedAccount = accounts.find(a => String(a.id) === accountId)
  const storageType = selectedAccount?.account_type === 'institutional' ? 'allocated' : 'unallocated'

  function addBar() { setBars(b => [...b, { serial_number: '', weight_g: '' }]) }
  function removeBar(i: number) { setBars(b => b.filter((_, idx) => idx !== i)) }
  function updateBar(i: number, field: keyof Bar, val: string) {
    setBars(b => b.map((bar, idx) => idx === i ? { ...bar, [field]: val } : bar))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const body: Record<string, any> = {
        account_id: Number(accountId),
        vault_id: Number(vaultId),
        metal,
        storage_type: storageType,
      }
      if (storageType === 'unallocated') {
        const tokens = Math.round(parseFloat(grams) * 10)
        if (tokens <= 0) { setError('Weight must be positive'); setLoading(false); return }
        body.token_amount = tokens
      } else {
        body.bars = bars.map(b => ({ serial_number: b.serial_number, weight_g: parseFloat(b.weight_g) }))
      }
      await api.post('/deposits', body)
      setSuccess('Deposit recorded successfully.')
      setGrams('')
      setBars([{ serial_number: '', weight_g: '' }])
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to create deposit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">New Deposit</h1>
        <p className="text-sm text-slate-500">Record a client metal deposit into a vault</p>
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
              <span>Storage type: <strong className="capitalize">{storageType}</strong>
                {' '}({storageType === 'allocated' ? 'institutional — physical bars' : 'retail — pooled tokens'})
              </span>
            </div>
          )}

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
              {METALS.map(m => <option key={m} value={m} className="capitalize">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>

          {storageType === 'unallocated' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Weight (grams)</label>
              <input type="number" step="0.1" min="0.1" value={grams}
                onChange={e => setGrams(e.target.value)} placeholder="e.g. 100.0" className={inputCls} />
              {grams && parseFloat(grams) > 0 && (
                <p className="text-xs text-stone-400 mt-1.5">
                  = {Math.round(parseFloat(grams) * 10)} tokens · {(parseFloat(grams) / 1000).toFixed(4)} kg
                </p>
              )}
            </div>
          )}

          {storageType === 'allocated' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Bars</label>
              <div className="space-y-2">
                {bars.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <input placeholder="Serial number" value={b.serial_number}
                      onChange={e => updateBar(i, 'serial_number', e.target.value)}
                      className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" required />
                    <input type="number" step="0.01" placeholder="g" value={b.weight_g}
                      onChange={e => updateBar(i, 'weight_g', e.target.value)}
                      className="w-24 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" required />
                    {bars.length > 1 && (
                      <button type="button" onClick={() => removeBar(i)}
                        className="text-red-400 hover:text-red-600 px-1 text-lg">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addBar}
                className="mt-2 text-sm font-medium text-amber-600 hover:text-amber-700">
                + Add bar
              </button>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded-lg">✓ {success}</div>}

          <button type="submit" disabled={loading || !accountId}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: 'var(--bm-gold)' }}>
            {loading ? 'Submitting…' : 'Submit Deposit'}
          </button>
        </form>
      </div>
    </div>
  )
}
