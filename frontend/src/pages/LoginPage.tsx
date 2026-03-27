import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const form = new URLSearchParams()
      form.append('username', email)
      form.append('password', password)
      const { data } = await api.post<{ access_token: string }>(
        '/auth/login',
        form,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )
      await login(data.access_token)
      const me = await api.get('/auth/me')
      const role = me.data.role
      navigate(role === 'admin' ? '/admin' : role === 'ops' ? '/ops' : '/portfolio', { replace: true })
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bm-navy)' }}>

      {/* Brand mark */}
      <div className="mb-8 text-center">
        <div style={{ color: 'var(--bm-gold-light)' }} className="text-5xl mb-3">◈</div>
        <h1 className="text-2xl font-bold text-white tracking-wide">Bare Metals</h1>
        <p className="text-slate-400 text-sm mt-1">Precious Metal Custody Platform</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Sign in</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-colors"
              placeholder="admin@baremetals.mv"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-60 text-white"
            style={{ backgroundColor: loading ? '#d97706aa' : 'var(--bm-gold)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-slate-600">
        Maldives Securities Depository · Bare Metals Pvt
      </p>
    </div>
  )
}
