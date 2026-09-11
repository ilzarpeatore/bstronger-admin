import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale/es'

type AuditEntry = {
  id: number
  user?: { name?: string; email?: string }
  action: string
  entity_type: string
  entity_id?: number | string
  detail?: string
  ip_address?: string
  created_at: string
}

const actionLabels: Record<string, string> = {
  login: 'Inicio de sesión',
  logout: 'Cierre de sesión',
  create: 'Creación',
  update: 'Actualización',
  delete: 'Eliminación',
  revoke_access: 'Revocación de acceso',
  assign_program: 'Asignación de programa',
  assign_diet: 'Asignación de dieta',
  change_permissions: 'Cambio de permisos',
  enable_2fa: 'Activación 2FA',
  disable_2fa: 'Desactivación 2FA',
}

const actionVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  login: 'default',
  logout: 'secondary',
  create: 'default',
  update: 'outline',
  delete: 'destructive',
  revoke_access: 'destructive',
  change_permissions: 'destructive',
  enable_2fa: 'default',
  disable_2fa: 'destructive',
}

const AuditLogView = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(() => {
    setLoading(true)
    api.get('/admin/audit-logs')
      .then(res => setLogs(res.data || res || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de auditoría</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    <div className='flex justify-center'>
                      <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length ? (
                logs.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className='whitespace-nowrap'>
                      {item.created_at ? format(new Date(item.created_at), "dd MMM yyyy HH:mm", { locale: es }) : '-'}
                    </TableCell>
                    <TableCell>{item.user?.name || item.user?.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={actionVariants[item.action] || 'secondary'}>
                        {actionLabels[item.action] || item.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.entity_type}{item.entity_id ? ` #${item.entity_id}` : ''}</TableCell>
                    <TableCell className='max-w-[200px] truncate'>{item.detail || '-'}</TableCell>
                    <TableCell>{item.ip_address || '-'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>Sin registros de auditoría.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export default AuditLogView
