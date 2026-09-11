import { Navigate } from 'react-router'
import { useAuth } from '@/context/auth-context/AuthContext'
import Spinner from '@/views/spinner/Spinner'

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <Spinner />
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />
  }

  return <>{children}</>
}

export default RequireAuth
