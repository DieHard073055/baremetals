import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types'

const navItems: Record<Role, { to: string; label: string }[]> = {
  admin: [
    { to: '/admin', label: 'Accounts' },
    { to: '/admin/vaults', label: 'Vaults' },
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/prices', label: 'Prices' },
    { to: '/admin/config', label: 'Config' },
  ],
  ops: [
    { to: '/ops/deposit', label: 'Deposit' },
    { to: '/ops/withdraw', label: 'Withdrawal' },
    { to: '/ops/clients', label: 'Clients' },
    { to: '/ops/vaults', label: 'Vaults' },
  ],
  client: [
    { to: '/portfolio', label: 'Portfolio' },
  ],
}

export function Layout() {
  const { role, user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const items = role ? navItems[role] : []
  const roleLabel = role === 'admin' ? 'Admin' : role === 'ops' ? 'Ops' : 'Client'

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bm-warm)' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'var(--bm-navy)' }} className="shadow-lg">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <span style={{ color: 'var(--bm-gold-light)' }} className="text-lg">◈</span>
            <span className="text-white font-semibold text-sm tracking-wide">Bare Metals</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {items.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/admin' || to === '/portfolio'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-amber-400 bg-white/10'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <span className="text-sm text-slate-300">{user?.name}</span>
            <span style={{ backgroundColor: 'var(--bm-gold)', color: 'white' }}
              className="text-xs px-2 py-0.5 rounded-full font-medium">
              {roleLabel}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-slate-300 hover:text-white p-1"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen
              ? <span className="text-xl leading-none">✕</span>
              : <span className="text-xl leading-none">☰</span>
            }
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
            className="md:hidden px-4 pb-4 pt-2 space-y-1">
            {items.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/admin' || to === '/portfolio'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-amber-400 bg-white/10'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} className="pt-3 mt-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-white">{user?.name}</p>
                <p className="text-xs text-slate-400">{roleLabel}</p>
              </div>
              <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300">
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
