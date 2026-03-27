import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Account, Role, AccountType } from '../../types'

function Badge({ active }: { active: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'client' as Role, account_type: 'retail' as AccountType | '' })
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Create Account</h2>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input required type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input required type="password" placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="client">Client</option>
            <option value="ops">Ops</option>
            <option value="admin">Admin</option>
          </select>
          {form.role === 'client' && (
            <select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value as AccountType }))}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="retail">Retail</option>
              <option value="institutional">Institutional</option>
            </select>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-60">
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Accounts</h1>
        <button onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Account
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['ID', 'Name', 'Email', 'Role', 'Type', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{a.id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                <td className="px-4 py-3 text-gray-600">{a.email}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{a.role}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{a.account_type ?? '—'}</td>
                <td className="px-4 py-3"><Badge active={a.is_active} /></td>
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
        {accounts.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">No accounts found</p>
        )}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  )
}
