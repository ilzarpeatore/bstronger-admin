
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'

const LoginHistoryView = () => {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/admin-login-history')
      .then(res => setHistory(res.data || res || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de inicio de sesión de administradores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Dirección IP</TableHead>
                <TableHead>Inicio de sesión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className='h-24 text-center'>
                    <div className='flex justify-center'>
                      <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                    </div>
                  </TableCell>
                </TableRow>
              ) : history.length ? (
                history.map((item, i) => (
                  <TableRow key={item.id ?? i}>
                    <TableCell>{item.user?.name || item.user?.email || item.user || '-'}</TableCell>
                    <TableCell>{item.ip_address}</TableCell>
                    <TableCell>{item.login_at}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className='h-24 text-center'>Sin resultados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export default LoginHistoryView
