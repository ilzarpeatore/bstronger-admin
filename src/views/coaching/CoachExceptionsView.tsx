import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertTriangle, Check, X, RefreshCw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import RetentionRiskSettingsDialog from '@/components/coaching/RetentionRiskSettingsDialog'
import {
  CATEGORY_META,
  cardAccentClass,
  severityBadgeVariant,
  clientLabel,
  formatRelative,
  type ExceptionItem,
  type ExceptionStatusVal,
  type ExceptionSeverity,
  type CoachOption,
} from '@/lib/coachExceptions'

// Panel de Excepciones del Coach (docs/Panel_Excepciones_Implementacion.md).
// Feed unificado sobre datos que el Motor de Auto-Regulación ya genera —
// esta vista es solo lectura/resolución, no recalcula nada.
// Tipos/helpers compartidos con CoachExceptionsCard.tsx (dashboard general +
// resumen de cliente) y Notifications.tsx viven en @/lib/coachExceptions.

const STATUS_TABS: { value: ExceptionStatusVal | 'all'; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'resuelta', label: 'Resueltas' },
  { value: 'descartada', label: 'Descartadas' },
  { value: 'all', label: 'Todas' },
]

const CoachExceptionsView = () => {
  const [coaches, setCoaches] = useState<CoachOption[]>([])
  const [coachId, setCoachId] = useState('')

  const [status, setStatus] = useState<ExceptionStatusVal | 'all'>('pendiente')
  const [category, setCategory] = useState<string>('all')

  const [items, setItems] = useState<ExceptionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actingOn, setActingOn] = useState<number | null>(null)
  const [riskSettingsOpen, setRiskSettingsOpen] = useState(false)

  const fetchCoaches = useCallback(async () => {
    try {
      const res = await api.get('/admin/coach-exceptions/coaches')
      const data: CoachOption[] = res.data?.data || res.data || []
      setCoaches(data)
    } catch {
      toast.error('Error al cargar la lista de coaches')
    }
  }, [])

  useEffect(() => { fetchCoaches() }, [fetchCoaches])

  useEffect(() => {
    if (!coachId && coaches.length > 0) {
      setCoachId(String(coaches[0].id))
    }
  }, [coachId, coaches])

  const fetchItems = useCallback(async () => {
    if (!coachId) { setItems([]); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ coach_id: coachId, status })
      if (category !== 'all') params.set('category', category)
      const res = await api.get(`/admin/coach-exceptions?${params.toString()}`)
      setItems(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar el panel de excepciones')
    } finally {
      setLoading(false)
    }
  }, [coachId, status, category])

  useEffect(() => { fetchItems() }, [fetchItems])

  const grouped = useMemo(() => {
    const order: ExceptionSeverity[] = ['alta', 'media', 'baja']
    return order
      .map(sev => ({ severity: sev, items: items.filter(i => i.severity === sev) }))
      .filter(g => g.items.length > 0)
  }, [items])

  const handleAction = async (item: ExceptionItem, action: 'resolve' | 'dismiss') => {
    setActingOn(item.id)
    try {
      await api.post(`/admin/coach-exceptions/${item.id}/${action}`, {})
      toast.success(action === 'resolve' ? 'Marcado como resuelto' : 'Descartado')
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar')
    } finally {
      setActingOn(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Panel de Excepciones</CardTitle>
            <CardDescription>
              Todo lo que requiere tu atención en un solo sitio — dolor, estancamiento, sugerencias de carga
              pendientes, readiness bajo sostenido, semanas adaptativas por aprobar e inactividad reciente.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center">
            <Select value={coachId} onValueChange={v => setCoachId(v ?? '')}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Seleccionar coach" /></SelectTrigger>
              <SelectContent>
                {coaches.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={fetchItems} disabled={loading} title="Actualizar">
                <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setRiskSettingsOpen(true)} disabled={!coachId} title="Configurar riesgo de abandono">
                <Settings2 className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Tabs value={status} onValueChange={v => setStatus((v as ExceptionStatusVal | 'all') ?? 'pendiente')}>
              <TabsList>
                {STATUS_TABS.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <Select value={category} onValueChange={v => setCategory(v ?? 'all')}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm">
              <Check className="size-10 mb-3 opacity-40" />
              <p>{status === 'pendiente' ? 'Nada pendiente — todo al día.' : 'No hay ítems en este filtro.'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(group => (
                <div key={group.severity}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Severidad {group.severity} ({group.items.length})
                  </p>
                  <div className="space-y-2">
                    {group.items.map(item => {
                      const meta = CATEGORY_META[item.category]
                      const Icon = meta?.icon || AlertTriangle
                      return (
                        <div
                          key={item.id}
                          className={cn('rounded-lg border p-3.5 transition-colors', cardAccentClass(item))}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex size-9 items-center justify-center rounded-lg bg-background border shrink-0">
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium">{item.title}</p>
                                  <Badge variant={severityBadgeVariant(item.severity)}>{item.severity}</Badge>
                                  <Badge variant="outline">{meta?.label || item.category}</Badge>
                                </div>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                                )}
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {clientLabel(item)} · {formatRelative(item.created_at)}
                                </p>
                              </div>
                            </div>
                            {item.status === 'pendiente' && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  size="sm" variant="outline"
                                  disabled={actingOn === item.id}
                                  onClick={() => handleAction(item, 'resolve')}
                                >
                                  <Check className="size-3.5 mr-1" /> Resolver
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  disabled={actingOn === item.id}
                                  onClick={() => handleAction(item, 'dismiss')}
                                >
                                  <X className="size-3.5 mr-1" /> Descartar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RetentionRiskSettingsDialog open={riskSettingsOpen} onOpenChange={setRiskSettingsOpen} coachId={coachId || null} />
    </div>
  )
}

export default CoachExceptionsView
