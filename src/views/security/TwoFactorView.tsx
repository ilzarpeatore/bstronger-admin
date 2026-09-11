import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { ShieldCheck, ShieldOff, CopyIcon } from 'lucide-react'

type TwoFactorStatus = {
  enabled: boolean
  backup_codes?: string[]
}

const TwoFactorView = () => {
  const [status, setStatus] = useState<TwoFactorStatus>({ enabled: false })
  const [loading, setLoading] = useState(true)
  const [setupData, setSetupData] = useState<{ qr_code: string; secret: string; backup_codes: string[] } | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [setupOpen, setSetupOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchStatus = useCallback(() => {
    setLoading(true)
    api.get('/admin/2fa/status')
      .then(res => setStatus(res.data || { enabled: false }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleSetup = async () => {
    try {
      const res = await api.post('/admin/2fa/setup', {})
      setSetupData(res.data)
      setSetupOpen(true)
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo iniciar la configuración de 2FA')
    }
  }

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error('Ingresa un código de 6 dígitos')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/admin/2fa/verify', { code: verifyCode })
      toast.success('2FA activado correctamente')
      setSetupOpen(false)
      setVerifyCode('')
      setSetupData(null)
      fetchStatus()
    } catch (err: any) {
      toast.error(err?.message || 'Código inválido')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisable = async () => {
    setSubmitting(true)
    try {
      await api.post('/admin/2fa/disable', {})
      toast.success('2FA desactivado')
      setDisableOpen(false)
      fetchStatus()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo desactivar 2FA')
    } finally {
      setSubmitting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado al portapapeles')
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Autenticación en dos pasos (TOTP)</CardTitle>
          <CardDescription>
            Añade una capa extra de seguridad a tu cuenta de administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex justify-center py-8'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : (
            <div className='flex items-center gap-4'>
              <Badge variant={status.enabled ? 'default' : 'secondary'} className='text-sm'>
                {status.enabled ? 'Activado' : 'Desactivado'}
              </Badge>
              {status.enabled ? (
                <Button variant='destructive' onClick={() => setDisableOpen(true)}>
                  <ShieldOff className='mr-2 size-4' />
                  Desactivar 2FA
                </Button>
              ) : (
                <Button onClick={handleSetup}>
                  <ShieldCheck className='mr-2 size-4' />
                  Activar 2FA
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Configurar 2FA</DialogTitle>
          </DialogHeader>
          {setupData && (
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Escanea este código QR con tu app de autenticación (Google Authenticator, Authy, etc.):
              </p>
              <div className='flex justify-center'>
                <img src={setupData.qr_code} alt='QR 2FA' className='rounded-md border' />
              </div>
              <div className='space-y-1'>
                <Label className='text-xs text-muted-foreground'>O ingresa manualmente este secreto:</Label>
                <div className='flex items-center gap-2'>
                  <code className='flex-1 rounded bg-muted px-2 py-1 text-sm font-mono break-all'>
                    {setupData.secret}
                  </code>
                  <Button variant='ghost' size='icon' onClick={() => copyToClipboard(setupData.secret)}>
                    <CopyIcon className='size-4' />
                  </Button>
                </div>
              </div>
              <div className='space-y-1'>
                <Label>Código de verificación</Label>
                <Input
                  placeholder='000000'
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              {setupData.backup_codes?.length > 0 && (
                <div className='space-y-1'>
                  <Label className='text-xs text-muted-foreground'>Códigos de respaldo (guárdalos en un lugar seguro):</Label>
                  <div className='flex flex-wrap gap-1'>
                    {setupData.backup_codes.map((code, i) => (
                      <Badge key={i} variant='outline' className='font-mono text-xs'>{code}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => { setSetupOpen(false); setVerifyCode(''); setSetupData(null) }}>
              Cancelar
            </Button>
            <Button onClick={handleVerify} disabled={submitting || verifyCode.length !== 6}>
              {submitting ? 'Verificando...' : 'Activar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar 2FA</DialogTitle>
          </DialogHeader>
          <p>¿Estás seguro? Tu cuenta será menos segura sin autenticación en dos pasos.</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDisableOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDisable} disabled={submitting}>
              {submitting ? 'Desactivando...' : 'Desactivar 2FA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default TwoFactorView
