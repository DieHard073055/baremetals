import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Account, Role, AccountType } from '../../types'

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
    }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: 'bg-amber-100 text-amber-700',
    ops: 'bg-blue-100 text-blue-700',
    client: 'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${styles[role] ?? 'bg-stone-100 text-stone-600'}`}>
      {role}
    </span>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    role: 'client' as Role,
    account_type: 'retail' as AccountType,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/accounts', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        account_type: form.role === 'client' ? form.account_type : null,
      })
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Create Account</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Full name" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
          <input required type="email" placeholder="Email address" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
          <input required type="password" placeholder="Password" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputCls} />
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} className={inputCls}>
            <option value="client">Client</option>
            <option value="ops">Ops</option>
            <option value="admin">Admin</option>
          </select>
          {form.role === 'client' && (
            <select value={form.account_type}
              onChange={e => setForm(f => ({ ...f, account_type: e.target.value as AccountType }))} className={inputCls}>
              <option value="retail">Retail (unallocated)</option>
              <option value="institutional">Institutional (allocated)</option>
            </select>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-stone-200 rounded-lg py-2.5 text-sm text-slate-700 hover:bg-stone-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--bm-gold)' }}>
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [deactivating, setDeactivating] = useState<number | null>(null)

  async function load() {
    const { data } = await api.get<Account[]>('/accounts')
    setAccounts(data)
  }

  useEffect(() => { load() }, [])

  async function deactivate(id: number) {
    if (!confirm('Deactivate this account?')) return
    setDeactivating(id)
    try {
      await api.patch(`/accounts/${id}/deactivate`)
      await load()
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Cannot deactivate — account has active holdings')
    } finally {
      setDeactivating(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Accounts</h1>
          <p className="text-sm text-slate-500">{accounts.length} total</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--bm-gold)' }}
        >
          + New Account
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm min-w-[600px]">
            <thead style={{ backgroundColor: 'var(--bm-navy)' }}>
              <tr>
                {['ID', 'Name', 'Email', 'Role', 'Type', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {accounts.map(a => (
                <tr key={a.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 text-stone-400 text-xs">{a.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{a.name}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{a.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={a.role} /></td>
                  <td className="px-4 py-3 capitalize text-slate-600 text-xs">{a.account_type ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge active={a.is_active} /></td>
                  <td className="px-4 py-3 text-right">
                    {a.is_active && (
                      <button
                        onClick={() => deactivate(a.id)}
                        disabled={deactivating === a.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {accounts.length === 0 && (
          <p className="text-center py-10 text-stone-400 text-sm">No accounts yet</p>
        )}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  )
}
