import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type SettingItem = {
  id: number
  setting_group: string
  setting_key: string
  setting_value: string | null
}

const tabs = [
  { value: 'general', label: 'General' },
  { value: 'mail', label: 'Correo' },
  { value: 'firebase', label: 'Firebase' },
  { value: 'mobile', label: 'Configuración móvil' },
  { value: 'payment', label: 'Pagos' },
  { value: 'subscription', label: 'Suscripción' },
  { value: 'mail_alerts', label: 'Alertas de correo' },
  { value: 'login_enable', label: 'Ajustes de inicio de sesión' },
  { value: 'terms', label: 'Términos' },
  { value: 'privacy', label: 'Privacidad' }
]

const TAB_SLUGS: Record<string, string> = {
  general: 'general',
  mail: 'correo',
  firebase: 'firebase',
  mobile: 'configuracion-movil',
  payment: 'pagos',
  subscription: 'suscripcion',
  mail_alerts: 'alertas-de-correo',
  login_enable: 'inicio-de-sesion',
  terms: 'terminos',
  privacy: 'privacidad',
}
const SLUG_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_SLUGS).map(([value, slug]) => [slug, value]),
)

const SettingsView = () => {
  const navigate = useNavigate()
  const params = useParams()
  const mappedTab = params.tab ? SLUG_TO_TAB[params.tab] : undefined
  const activeTab = mappedTab && tabs.some(t => t.value === mappedTab) ? mappedTab : 'general'
  const goToTab = (value: string) => navigate(`/settings/${TAB_SLUGS[value]}`)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    setSettings({})
    api.get(`/admin/settings?page=${activeTab}`)
      .then(res => {
        const items: SettingItem[] = res.data?.data || []
        const mapped: Record<string, string> = {}
        items.forEach(item => { mapped[item.setting_key] = item.setting_value || '' })
        setSettings(mapped)
      })
      .catch(() => toast.error('No se pudieron cargar los ajustes'))
      .finally(() => setLoading(false))
  }, [activeTab])

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const grouped: Record<string, Record<string, string>> = {}
      grouped[activeTab] = settings
      await api.post('/admin/settings', { settings: grouped })
      toast.success('Ajustes guardados correctamente')
    } catch {
      toast.error('No se pudieron guardar los ajustes')
    } finally {
      setSaving(false)
    }
  }

  const renderField = (key: string) => {
    const isStatus = key.toLowerCase().includes('status') || key.toLowerCase().includes('enable')
    const isPassword = key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('key')
    const isUrl = key.toLowerCase().includes('url') || key.toLowerCase().includes('host') || key.toLowerCase().includes('link')

    if (isStatus || key.endsWith('_active') || key.endsWith('_enabled')) {
      return (
        <Field key={key} className='gap-2'>
          <FieldLabel className='capitalize'>{key.replace(/_/g, ' ')}</FieldLabel>
          <Select value={settings[key] || ''} onValueChange={v => handleChange(key, v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder={`Seleccionar ${key.replace(/_/g, ' ')}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='1'>Activado</SelectItem>
              <SelectItem value='0'>Desactivado</SelectItem>
              <SelectItem value='active'>Activo</SelectItem>
              <SelectItem value='inactive'>Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )
    }

    return (
      <Field key={key} className='gap-2'>
        <FieldLabel className='capitalize'>{key.replace(/_/g, ' ')}</FieldLabel>
        <Input
          type={isPassword ? 'password' : isUrl ? 'url' : 'text'}
          value={settings[key] ?? ''}
          onChange={e => handleChange(key, e.target.value)}
          placeholder={`Introducir ${key.replace(/_/g, ' ')}`}
        />
      </Field>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>Ajustes</CardTitle>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={goToTab}>
          <TabsList className='flex flex-wrap h-auto gap-1 p-1'>
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className='mt-6'>
            {loading ? (
              <div className='flex justify-center py-12'>
                <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
              </div>
            ) : Object.keys(settings).length === 0 ? (
              <p className='text-muted-foreground py-6'>No se encontraron ajustes para esta sección.</p>
            ) : (
              <FieldGroup className='gap-4 max-w-2xl'>
                {Object.entries(settings).map(([key]) => renderField(key))}
              </FieldGroup>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default SettingsView
