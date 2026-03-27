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

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const items = role ? navItems[role] : []
  const roleLabel = role === 'admin' ? 'Admin' : role === 'ops' ? 'Ops' : 'Client'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-gray-900 text-sm">Bare Metals</span>
            <nav className="flex gap-1">
              {items.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/admin' || to === '/portfolio'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>{user?.name}</span>
            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
              {roleLabel}
            </span>
            <button
              onClick={handleLogout}
              className="text-red-500 hover:text-red-700 text-xs"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
