import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { api, setToken, removeToken } from '@/lib/api'

export type AuthUser = {
  id: number
  name: string
  email: string
  user_type: string
  status: string
  permissions: string[]
}

type AuthContextType = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get('/admin/me')
      setUser(response.data)
    } catch {
      setUser(null)
      removeToken()
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      refreshUser().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [refreshUser])

  const login = async (email: string, password: string) => {
    const response = await api.post('/admin/login', { email, password })
    setToken(response.token)
    setUser(response.data)
  }

  const logout = async () => {
    try {
      await api.post('/admin/logout', {})
    } catch {
      // ignore
    }
    removeToken()
    setUser(null)
  }

  const hasPermission = (permission: string) => {
    if (!user) return false
    if (user.permissions.includes('*')) return true
    return user.permissions.includes(permission)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
