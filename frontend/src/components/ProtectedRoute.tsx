import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types'

interface Props {
  allowedRoles: Role[]
}

export function ProtectedRoute({ allowedRoles }: Props) {
  const { token, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading…
      </div>
    )
  }

  if (!token || !role) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(role)) {
    const home = role === 'admin' ? '/admin' : role === 'ops' ? '/ops' : '/portfolio'
    return <Navigate to={home} replace />
  }

  return <Outlet />
}
