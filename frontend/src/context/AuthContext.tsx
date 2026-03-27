import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { Account, Role } from '../types'

interface AuthState {
  token: string | null
  user: Account | null
  role: Role | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (token: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem('token'),
    user: null,
    role: null,
    loading: true,
  })

  // On mount (or token change), fetch /auth/me to hydrate user + role
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setState({ token: null, user: null, role: null, loading: false })
      return
    }
    api.get<Account>('/auth/me')
      .then(({ data }) => {
        setState({ token, user: data, role: data.role, loading: false })
      })
      .catch(() => {
        localStorage.removeItem('token')
        setState({ token: null, user: null, role: null, loading: false })
      })
  }, [])

  const login = useCallback(async (token: string) => {
    localStorage.setItem('token', token)
    const { data } = await api.get<Account>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    setState({ token, user: data, role: data.role, loading: false })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setState({ token: null, user: null, role: null, loading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
