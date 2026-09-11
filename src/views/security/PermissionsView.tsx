
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'

const PermissionsView = () => {
  const [permissions, setPermissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/permissions')
      .then(res => setPermissions(res.data || res || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permisos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Guard</TableHead>
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
              ) : permissions.length ? (
                permissions.map((perm, i) => (
                  <TableRow key={perm.id ?? i}>
                    <TableCell>{perm.id}</TableCell>
                    <TableCell>{perm.name}</TableCell>
                    <TableCell>{perm.guard_name}</TableCell>
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

export default PermissionsView
