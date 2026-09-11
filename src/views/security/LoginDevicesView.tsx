
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

const LoginDevicesView = () => {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [revokingItem, setRevokingItem] = useState<any>(null)

  const fetchDevices = useCallback(() => {
    setLoading(true)
    api.get('/admin/admin-login-devices')
      .then(res => setDevices(res.data || res || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchDevices() }, [fetchDevices])

  const handleRevoke = async () => {
    if (!revokingItem) return
    try {
      await api.delete(`/admin/admin-login-devices/${revokingItem.id}`)
      toast.success('Dispositivo revocado')
      setRevokeDialogOpen(false)
      fetchDevices()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo revocar el dispositivo')
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Dispositivos de inicio de sesión de administradores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Nombre del dispositivo</TableHead>
                  <TableHead>Dirección IP</TableHead>
                  <TableHead>Última actividad</TableHead>
                  <TableHead className='w-[100px]'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className='h-24 text-center'>
                      <div className='flex justify-center'>
                        <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : devices.length ? (
                  devices.map((item, i) => (
                    <TableRow key={item.id ?? i}>
                      <TableCell>{item.user?.name || item.user?.email || item.user || '-'}</TableCell>
                      <TableCell>{item.device_name}</TableCell>
                      <TableCell>{item.ip_address}</TableCell>
                      <TableCell>{item.last_active}</TableCell>
                      <TableCell>
                        <Button variant='destructive' size='sm' onClick={() => { setRevokingItem(item); setRevokeDialogOpen(true) }}>
                          <XIcon className='size-4' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className='h-24 text-center'>Sin resultados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revocar dispositivo</DialogTitle>
          </DialogHeader>
          <p>¿Estás seguro de que quieres revocar este dispositivo? La sesión vinculada a él ya no será de confianza.</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRevokeDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleRevoke}>Revocar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default LoginDevicesView
