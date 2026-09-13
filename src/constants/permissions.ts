/**
 * Permission keys used to gate admin-only routes and sidebar entries via
 * `useAuth().hasPermission()`.
 *
 * IMPORTANT: these string values are a best-effort guess matching the route
 * slug they protect (e.g. `/roles` -> "roles"). The Spatie permission names
 * actually seeded on the Laravel backend are NOT visible from the frontend
 * (the `/admin/permissions` and `/admin/roles` endpoints return arbitrary,
 * backend-defined `name` strings with no fixed convention documented in this
 * repo). If an admin who should have access to one of these pages keeps
 * getting redirected to the dashboard, check the `name` returned by
 * `GET /admin/permissions` for that admin's assigned permissions and update
 * the corresponding value below to match exactly.
 *
 * Admins whose `permissions` array contains the wildcard `'*'` (see
 * `hasPermission` in AuthContext) always pass every check below regardless
 * of these exact strings — that "sees everything" super-admin behavior is
 * unaffected by any mismatch here.
 */
export const PERMISSIONS = {
  PERMISSIONS: 'permissions',
  ROLES: 'roles',
  SUB_ADMINS: 'sub-admins',
  AUDIT_LOG: 'audit-log',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
