import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Account, Vault, Metal } from '../../types'

interface Bar { serial_number: string; weight_g: string }

const METALS: Metal[] = ['gold', 'silver', 'platinum']

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
        if (tokens <= 0) { setError('Grams must be positive'); setLoading(false); return }
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
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">New Deposit</h1>

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

        {storageType === 'unallocated' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (grams)</label>
            <input type="number" step="0.1" min="0.1" required={storageType === 'unallocated'}
              value={grams} onChange={e => setGrams(e.target.value)}
              placeholder="e.g. 100.0"
              className="w-full border rounded-lg px-3 py-2 text-sm" />
            {grams && <p className="text-xs text-gray-400 mt-1">= {Math.round(parseFloat(grams) * 10)} tokens</p>}
          </div>
        )}

        {storageType === 'allocated' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bars</label>
            <div className="space-y-2">
              {bars.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder="Serial number" value={b.serial_number}
                    onChange={e => updateBar(i, 'serial_number', e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm" required />
                  <input type="number" step="0.01" placeholder="Weight (g)" value={b.weight_g}
                    onChange={e => updateBar(i, 'weight_g', e.target.value)}
                    className="w-28 border rounded-lg px-3 py-2 text-sm" required />
                  {bars.length > 1 && (
                    <button type="button" onClick={() => removeBar(i)} className="text-red-400 hover:text-red-600 px-1">×</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addBar}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800">+ Add bar</button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <button type="submit" disabled={loading || !accountId}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'Submitting…' : 'Submit Deposit'}
        </button>
      </form>
    </div>
  )
}
