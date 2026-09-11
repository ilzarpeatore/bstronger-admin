import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type AppSettingsData = {
  id?: number
  site_name?: string
  site_email?: string
  site_description?: string
  site_copyright?: string
  facebook_url?: string
  twitter_url?: string
  linkedin_url?: string
  instagram_url?: string
  language_option?: string | null
  contact_email?: string
  contact_number?: string
  help_support_url?: string
  color?: string
  backup_enabled?: boolean
  backup_frequency?: 'daily' | 'weekly'
  backup_retention_days?: number
  backup_last_run_at?: string | null
  backup_last_status?: 'success' | 'failed' | null
  backup_last_size_kb?: number | null
  [key: string]: any
}

const AppSettingsView = () => {
  const [settings, setSettings] = useState<AppSettingsData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [runningBackup, setRunningBackup] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/admin/app-settings')
      .then(res => setSettings(res.data?.data || res.data || {}))
      .catch(() => toast.error('No se pudieron cargar los ajustes de la aplicación'))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (key: string, value: string | boolean | number) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleRunBackupNow = async () => {
    setRunningBackup(true)
    try {
      const res = await api.post('/admin/backup-run-now', {})
      if (res.data?.data) setSettings(res.data.data)
      toast.success(res.data?.message || 'Backup completado')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al ejecutar el backup')
    } finally {
      setRunningBackup(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.post('/admin/app-settings', settings)
      toast.success('Ajustes de la aplicación guardados correctamente')
    } catch {
      toast.error('No se pudieron guardar los ajustes de la aplicación')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className='flex justify-center py-12'>
          <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>Ajustes de la aplicación</CardTitle>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-8 max-w-2xl'>
          <div>
            <h3 className='text-lg font-medium mb-4'>General</h3>
            <FieldGroup className='gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Nombre del sitio</FieldLabel>
                <Input value={settings.site_name || ''} onChange={e => handleChange('site_name', e.target.value)} placeholder='Nombre del sitio' />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Correo del sitio</FieldLabel>
                <Input type='email' value={settings.site_email || ''} onChange={e => handleChange('site_email', e.target.value)} placeholder='Correo del sitio' />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Descripción del sitio</FieldLabel>
                <textarea
                  className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2'
                  value={settings.site_description || ''}
                  onChange={e => handleChange('site_description', e.target.value)}
                  placeholder='Descripción del sitio'
                />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Derechos de autor</FieldLabel>
                <Input value={settings.site_copyright || ''} onChange={e => handleChange('site_copyright', e.target.value)} placeholder='Texto de derechos de autor' />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Color del tema</FieldLabel>
                <div className='flex items-center gap-2'>
                  <Input type='color' value={settings.color || '#4f46e5'} onChange={e => handleChange('color', e.target.value)} className='w-16 h-10 p-1' />
                  <Input value={settings.color || ''} onChange={e => handleChange('color', e.target.value)} placeholder='#4f46e5' className='flex-1' />
                </div>
              </Field>
            </FieldGroup>
          </div>

          <div>
            <h3 className='text-lg font-medium mb-4'>Contacto</h3>
            <FieldGroup className='gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Correo de contacto</FieldLabel>
                <Input type='email' value={settings.contact_email || ''} onChange={e => handleChange('contact_email', e.target.value)} placeholder='Correo de contacto' />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Teléfono de contacto</FieldLabel>
                <Input value={settings.contact_number || ''} onChange={e => handleChange('contact_number', e.target.value)} placeholder='Teléfono de contacto' />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>URL de ayuda y soporte</FieldLabel>
                <Input value={settings.help_support_url || ''} onChange={e => handleChange('help_support_url', e.target.value)} placeholder='https://...' />
              </Field>
            </FieldGroup>
          </div>

          <div>
            <h3 className='text-lg font-medium mb-4'>Redes sociales</h3>
            <FieldGroup className='gap-4'>
              <Field className='gap-2'>
                <FieldLabel>URL de Facebook</FieldLabel>
                <Input value={settings.facebook_url || ''} onChange={e => handleChange('facebook_url', e.target.value)} placeholder='https://facebook.com/...' />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>URL de Twitter</FieldLabel>
                <Input value={settings.twitter_url || ''} onChange={e => handleChange('twitter_url', e.target.value)} placeholder='https://twitter.com/...' />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>URL de LinkedIn</FieldLabel>
                <Input value={settings.linkedin_url || ''} onChange={e => handleChange('linkedin_url', e.target.value)} placeholder='https://linkedin.com/...' />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>URL de Instagram</FieldLabel>
                <Input value={settings.instagram_url || ''} onChange={e => handleChange('instagram_url', e.target.value)} placeholder='https://instagram.com/...' />
              </Field>
            </FieldGroup>
          </div>

          <div>
            <h3 className='text-lg font-medium mb-4'>Copias de seguridad</h3>
            <FieldGroup className='gap-4'>
              <Field className='gap-2'>
                <div className='flex items-center justify-between'>
                  <FieldLabel className='mb-0'>Backup automático de la base de datos</FieldLabel>
                  <Switch checked={!!settings.backup_enabled} onCheckedChange={v => handleChange('backup_enabled', v)} />
                </div>
              </Field>
              <div className='grid grid-cols-2 gap-4'>
                <Field className='gap-2'>
                  <FieldLabel>Frecuencia</FieldLabel>
                  <Select value={settings.backup_frequency || 'daily'} onValueChange={v => handleChange('backup_frequency', v as string)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='daily'>Diaria (03:00)</SelectItem>
                      <SelectItem value='weekly'>Semanal (domingos, 03:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className='gap-2'>
                  <FieldLabel>Retener copias (días)</FieldLabel>
                  <Input
                    type='number'
                    min={1}
                    value={settings.backup_retention_days ?? 14}
                    onChange={e => handleChange('backup_retention_days', Number(e.target.value))}
                  />
                </Field>
              </div>

              <div className='rounded-md border p-3 flex items-center justify-between'>
                <div className='text-sm'>
                  <p className='text-muted-foreground'>Última copia</p>
                  {settings.backup_last_run_at ? (
                    <p>
                      {new Date(settings.backup_last_run_at).toLocaleString('es-ES')}
                      {' · '}
                      {settings.backup_last_size_kb ? `${(settings.backup_last_size_kb / 1024).toFixed(1)} MB` : ''}
                      {' '}
                      <Badge variant={settings.backup_last_status === 'success' ? 'default' : 'destructive'}>
                        {settings.backup_last_status === 'success' ? 'OK' : 'Fallida'}
                      </Badge>
                    </p>
                  ) : (
                    <p>Todavía no se ha ejecutado ninguna copia.</p>
                  )}
                </div>
                <Button variant='outline' onClick={handleRunBackupNow} disabled={runningBackup}>
                  {runningBackup ? 'Ejecutando...' : 'Backup ahora'}
                </Button>
              </div>
            </FieldGroup>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default AppSettingsView
