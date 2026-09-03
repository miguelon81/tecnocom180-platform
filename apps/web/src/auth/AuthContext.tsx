import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { login as apiLogin } from '../api/auth'
import { apiFetch } from '../api/client'

interface AuthUser {
  id: string
  organizationId: string
  name: string
  email: string
  phone: string | null
  role: string
  active?: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const TOKEN_KEY = 'tecnocom180_token'
const USER_KEY = 'tecnocom180_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  )

  const [user, setUser] = useState<AuthUser | null>(() => {
    const storedUser = localStorage.getItem(USER_KEY)

    if (!storedUser) {
      return null
    }

    try {
      return JSON.parse(storedUser) as AuthUser
    } catch {
      localStorage.removeItem(USER_KEY)
      return null
    }
  })

  const [loading, setLoading] = useState(() =>
    Boolean(localStorage.getItem(TOKEN_KEY)),
  )

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }, [token])

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  }, [user])

  useEffect(() => {
    async function restoreSession() {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await apiFetch('/auth/me')

        if (!response.ok) {
          throw new Error('Session invalid')
        }

        const currentUser = (await response.json()) as AuthUser

        if (!currentUser.active) {
          throw new Error('User inactive')
        }

        setUser(currentUser)
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)

        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    void restoreSession()
  }, [token])

  async function login(email: string, password: string) {
    setLoading(true)

    try {
      const result = await apiLogin(email, password)

      /*
       * Persistimos primero en localStorage.
       *
       * Esto garantiza que cualquier llamada posterior que utilice
       * apiFetch() pueda encontrar inmediatamente el JWT.
       */
      localStorage.setItem(TOKEN_KEY, result.token)
      localStorage.setItem(USER_KEY, JSON.stringify(result.user))

      /*
       * Después actualizamos el estado de React.
       */
      setToken(result.token)
      setUser(result.user)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)

    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}