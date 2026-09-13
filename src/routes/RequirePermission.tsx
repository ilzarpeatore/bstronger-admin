import { Navigate } from 'react-router'
import { useAuth } from '@/context/auth-context/AuthContext'

/**
 * Gates a route behind a specific permission, on top of the plain
 * login check already done by RequireAuth (this component assumes it
 * renders inside RequireAuth, i.e. `user` is guaranteed to be non-null).
 *
 * Admins whose `permissions` include the wildcard `'*'` always pass
 * (see `hasPermission` in AuthContext), so this never locks out a
 * super-admin. An admin without the required permission is redirected
 * to the dashboard rather than rendering the page.
 */
const RequirePermission = ({
  permission,
  children,
}: {
  permission: string
  children: React.ReactNode
}) => {
  const { hasPermission } = useAuth()

  if (!hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default RequirePermission
