import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, CalendarIcon, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks'
type TemplateType = 'sequential' | 'weekday'
type TemplateOption = { id: number; title: string; type: TemplateType }

const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Desayuno' },
  { key: 'lunch', label: 'Almuerzo' },
  { key: 'dinner', label: 'Cena' },
  { key: 'snacks', label: 'Snacks' },
]

type AssignedMeal = {
  id: number
  recipe_id: number
  calories: number
  recipe?: { id: number; title: string; recipe_image: string | null }
  is_coach_assigned: boolean
  assigned_by?: { id: number; name: string }
}

type CalendarDay = {
  date: string
  daily_plan_id: number | null
  meals: Record<MealType, AssignedMeal[]>
}

type User = { id: number; name?: string; first_name?: string; last_name?: string; email: string }
type RecipeOption = { id: number; title: string; calories?: number; recipe_image?: string | null }

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function getCalendarCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  const startDay = (first.getDay() + 6) % 7
  const totalDays = last.getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function getMonthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function getTodayString() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

const MEAL_LABEL_SHORT: Record<MealType, string> = {
  breakfast: 'D',
  lunch: 'A',
  dinner: 'C',
  snacks: 'S',
}

type Props = {
  /** When provided, fixes the calendar to this client and hides the client picker
   * (used when embedding this view inside a client's own profile page). */
  clientId?: string
}

export default function ClientMealCalendarView({ clientId: fixedClientId }: Props = {}) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [clientId, setClientId] = useState(fixedClientId ?? '')
  const [clients, setClients] = useState<User[]>([])
  const [days, setDays] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(false)

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignDate, setAssignDate] = useState('')
  const [assignMealType, setAssignMealType] = useState<MealType>('breakfast')
  const [recipeSearch, setRecipeSearch] = useState('')
  const [recipeResults, setRecipeResults] = useState<RecipeOption[]>([])
  const [recipeSearchLoading, setRecipeSearchLoading] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeOption | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportTitle, setExportTitle] = useState('')
  const [exportType, setExportType] = useState<TemplateType>('sequential')
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [exporting, setExporting] = useState(false)

  const [importTemplateDialogOpen, setImportTemplateDialogOpen] = useState(false)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [importTemplateId, setImportTemplateId] = useState('')
  const [importTemplateStartDate, setImportTemplateStartDate] = useState('')
  const [importTemplateWeeks, setImportTemplateWeeks] = useState('1')
  const [importingTemplate, setImportingTemplate] = useState(false)

  const today = useMemo(() => getTodayString(), [])

  const fetchClients = useCallback(async () => {
    if (fixedClientId) return
    try {
      const res = await api.get('/admin/users?per_page=500')
      setClients(res.data?.data || res.data || [])
    } catch {
      // best-effort fetch, ignore failures
    }
  }, [fixedClientId])

  const fetchCalendar = useCallback(async () => {
    if (!clientId) {
      setDays([])
      return
    }
    setLoading(true)
    try {
      const { start, end } = getMonthBounds(year, month)
      const res = await api.get(`/admin/client-meal-calendar?user_id=${clientId}&start_date=${start}&end_date=${end}`)
      setDays(res.data || [])
    } catch {
      toast.error('Error al cargar el calendario de comidas')
      setDays([])
    } finally {
      setLoading(false)
    }
  }, [clientId, year, month])

  useEffect(() => { fetchClients() }, [fetchClients])
  useEffect(() => { fetchCalendar() }, [fetchCalendar])

  const daysByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>()
    for (const d of days) map.set(d.date, d)
    return map
  }, [days])

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else { setMonth(m => m - 1) }
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else { setMonth(m => m + 1) }
  }

  const cells = useMemo(() => getCalendarCells(year, month), [year, month])

  const searchRecipes = useCallback(async (query: string) => {
    setRecipeSearchLoading(true)
    try {
      const res = await api.get(`/admin/recipes?search=${encodeURIComponent(query)}&per_page=15`)
      setRecipeResults(res.data?.data || res.data || [])
    } catch {
      setRecipeResults([])
    } finally {
      setRecipeSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!assignDialogOpen) return
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => searchRecipes(recipeSearch), 350)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [recipeSearch, assignDialogOpen, searchRecipes])

  const openAssignDialog = useCallback((dateStr: string, mealType: MealType) => {
    if (!clientId) {
      toast.info('Selecciona un cliente primero')
      return
    }
    setAssignDate(dateStr)
    setAssignMealType(mealType)
    setRecipeSearch('')
    setRecipeResults([])
    setSelectedRecipe(null)
    setAssignDialogOpen(true)
    searchRecipes('')
  }, [clientId, searchRecipes])

  const handleAssign = useCallback(async () => {
    if (!clientId || !assignDate || !selectedRecipe) return
    setSubmitting(true)
    try {
      await api.post('/admin/client-meal-calendar/assign', {
        user_id: Number(clientId),
        date: assignDate,
        meal_type: assignMealType,
        recipe_id: selectedRecipe.id,
      })
      toast.success('Comida asignada')
      setAssignDialogOpen(false)
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al asignar la comida')
    } finally {
      setSubmitting(false)
    }
  }, [clientId, assignDate, assignMealType, selectedRecipe, fetchCalendar])

  const handleRemove = useCallback(async (id: number) => {
    try {
      await api.delete(`/admin/client-meal-calendar/${id}`)
      toast.success('Comida eliminada')
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al eliminar la comida')
    }
  }, [fetchCalendar])

  const openExportDialog = () => {
    const { start, end } = getMonthBounds(year, month)
    setExportTitle('')
    setExportType('sequential')
    setExportStartDate(start)
    setExportEndDate(end)
    setExportDialogOpen(true)
  }

  const handleExport = async () => {
    if (!clientId || !exportTitle.trim() || !exportStartDate || !exportEndDate) return
    setExporting(true)
    try {
      const created = await api.post('/admin/meal-plan-templates', { title: exportTitle.trim(), type: exportType })
      await api.post(`/admin/meal-plan-templates/${created.data.id}/export-from-calendar`, {
        client_id: Number(clientId),
        start_date: exportStartDate,
        end_date: exportEndDate,
      })
      toast.success('Guardado como plantilla')
      setExportDialogOpen(false)
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al guardar la plantilla')
    } finally {
      setExporting(false)
    }
  }

  const openImportTemplateDialog = () => {
    setImportTemplateId('')
    setImportTemplateStartDate('')
    setImportTemplateWeeks('1')
    setImportTemplateDialogOpen(true)
    if (templates.length === 0) {
      api.get('/admin/meal-plan-templates?per_page=200').then(res => setTemplates(res.data?.data || res.data || [])).catch(() => {})
    }
  }

  const selectedTemplate = templates.find(t => String(t.id) === importTemplateId)

  const handleImportTemplate = async () => {
    if (!clientId || !importTemplateId || !importTemplateStartDate) return
    setImportingTemplate(true)
    try {
      const res = await api.post(`/admin/meal-plan-templates/${importTemplateId}/import-to-calendar`, {
        client_id: Number(clientId),
        start_date: importTemplateStartDate,
        ...(selectedTemplate?.type === 'weekday' ? { weeks: Number(importTemplateWeeks) || 1 } : {}),
      })
      toast.success(res.message || 'Plantilla importada')
      setImportTemplateDialogOpen(false)
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al importar la plantilla')
    } finally {
      setImportingTemplate(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4'>
            {!fixedClientId && <CardTitle>Calendario de comidas del cliente</CardTitle>}
            {!fixedClientId && (
              <Select value={clientId} onValueChange={v => setClientId(v ?? '')}>
                <SelectTrigger className='w-full sm:w-[280px]'>
                  <SelectValue placeholder='Seleccionar cliente' />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim()} ({c.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className='flex items-center gap-3 text-xs text-muted-foreground sm:ml-2'>
              <span className='flex items-center gap-1'>
                <span className='inline-block h-3 w-3 rounded bg-orange-100 border border-orange-300' />
                Asignado por el coach
              </span>
              <span className='flex items-center gap-1'>
                <span className='inline-block h-3 w-3 rounded bg-gray-100 border border-gray-300' />
                Añadido por el cliente
              </span>
            </div>
          </div>
          {clientId && (
            <div className='flex items-center gap-2 flex-wrap'>
              <Button variant='outline' size='sm' className='flex-1 sm:flex-initial' onClick={openImportTemplateDialog}>Importar plantilla</Button>
              <Button variant='outline' size='sm' className='flex-1 sm:flex-initial' onClick={openExportDialog}>Guardar como plantilla</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!clientId ? (
            <div className='flex flex-col items-center justify-center py-20 text-muted-foreground'>
              <CalendarIcon className='size-12 mb-4 opacity-50' />
              <p>Selecciona un cliente para ver y asignar su plan de comidas</p>
            </div>
          ) : (
            <>
              <div className='flex items-center justify-between mb-4'>
                <Button variant='outline' size='sm' onClick={prevMonth}>
                  <ChevronLeft className='size-4' />
                  <span className='ml-1'>Mes</span>
                </Button>
                <h3 className='text-lg font-semibold'>
                  {MONTH_NAMES[month - 1]} {year} {loading && <span className='text-xs text-muted-foreground font-normal ml-2'>cargando…</span>}
                </h3>
                <Button variant='outline' size='sm' onClick={nextMonth}>
                  <span className='mr-1'>Mes</span>
                  <ChevronRight className='size-4' />
                </Button>
              </div>

              <div className='overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0'>
              <div className='grid grid-cols-7 border-t border-l min-w-[700px] sm:min-w-0'>
                {DAYS.map(d => (
                  <div key={d} className='border-r border-b bg-muted/50 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground'>
                    {d}
                  </div>
                ))}
                {cells.map((dateStr, i) => {
                  const day = dateStr ? daysByDate.get(dateStr) : undefined
                  const isToday = dateStr === today

                  return (
                    <div
                      key={i}
                      className={`border-r border-b min-h-[130px] p-1.5 ${dateStr ? 'bg-background' : 'bg-muted/30'}`}
                    >
                      {dateStr && (
                        <>
                          <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary font-bold bg-primary/10 rounded px-1 inline-block' : ''}`}>
                            {parseInt(dateStr.split('-')[2])}
                          </div>
                          <div className='space-y-0.5'>
                            {MEAL_TYPES.map(({ key, label }) => {
                              const meals = day?.meals?.[key] ?? []
                              return (
                                <div key={key} className='group'>
                                  <div className='flex items-start gap-1'>
                                    <span className='text-[9px] font-bold text-muted-foreground w-2.5 shrink-0 pt-0.5'>{MEAL_LABEL_SHORT[key]}</span>
                                    <div className='flex-1 min-w-0 space-y-0.5'>
                                      {meals.length === 0 ? (
                                        <button
                                          className='opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-muted-foreground hover:text-primary flex items-center gap-0.5'
                                          onClick={() => openAssignDialog(dateStr, key)}
                                          title={`Asignar ${label}`}
                                        >
                                          <Plus className='size-2.5' /> añadir
                                        </button>
                                      ) : (
                                        meals.map(m => (
                                          <div
                                            key={m.id}
                                            className={`text-[9px] leading-tight px-1 py-0.5 rounded flex items-center justify-between gap-0.5 ${
                                              m.is_coach_assigned
                                                ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                                            }`}
                                            title={m.recipe?.title}
                                          >
                                            <span className='truncate'>{m.recipe?.title ?? `Receta #${m.recipe_id}`}</span>
                                            <button
                                              className='shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-600'
                                              onClick={() => {
                                                if (window.confirm('¿Eliminar esta comida?')) handleRemove(m.id)
                                              }}
                                            >
                                              <X className='size-2.5' />
                                            </button>
                                          </div>
                                        ))
                                      )}
                                      {meals.length > 0 && (
                                        <button
                                          className='opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-muted-foreground hover:text-primary flex items-center gap-0.5'
                                          onClick={() => openAssignDialog(dateStr, key)}
                                          title={`Añadir otro ${label}`}
                                        >
                                          <Plus className='size-2.5' /> añadir
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar comida — {assignDate}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Comida</FieldLabel>
              <Select value={assignMealType} onValueChange={v => setAssignMealType((v as MealType) ?? 'breakfast')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map(({ key, label }) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Receta</FieldLabel>
              <div className='relative'>
                <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
                <Input
                  className='pl-8'
                  placeholder='Buscar recetas...'
                  value={recipeSearch}
                  onChange={e => {
                    setRecipeSearch(e.target.value)
                    setSelectedRecipe(null)
                  }}
                />
              </div>
              <div className='max-h-56 overflow-y-auto border rounded-md divide-y'>
                {recipeSearchLoading ? (
                  <div className='p-3 text-sm text-muted-foreground text-center'>Buscando…</div>
                ) : recipeResults.length === 0 ? (
                  <div className='p-3 text-sm text-muted-foreground text-center'>No se encontraron recetas</div>
                ) : (
                  recipeResults.map(r => (
                    <button
                      key={r.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between ${
                        selectedRecipe?.id === r.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedRecipe(r)}
                    >
                      <span className='truncate'>{r.title}</span>
                      {r.calories != null && <span className='text-xs text-muted-foreground shrink-0 ml-2'>{r.calories} kcal</span>}
                    </button>
                  ))
                )}
              </div>
              {selectedRecipe && (
                <div className='text-xs text-muted-foreground'>Seleccionado: <span className='font-medium text-foreground'>{selectedRecipe.title}</span></div>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAssignDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selectedRecipe || submitting}>
              {submitting ? 'Asignando…' : 'Asignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar el calendario de este cliente como plantilla</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Título de la plantilla</FieldLabel>
              <Input placeholder='p. ej. Plan de definición de 30 días' value={exportTitle} onChange={e => setExportTitle(e.target.value)} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Tipo</FieldLabel>
              <Select value={exportType} onValueChange={v => setExportType((v as TemplateType) ?? 'sequential')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='sequential'>Secuencial — Día 1, Día 2... (desde la fecha de inicio)</SelectItem>
                  <SelectItem value='weekday'>Semanal — patrón de lunes a domingo (primera aparición de cada día de la semana en el rango)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className='grid grid-cols-2 gap-3'>
              <Field className='gap-2'>
                <FieldLabel>Desde</FieldLabel>
                <input type='date' className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm' value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Hasta</FieldLabel>
                <input type='date' className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm' value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setExportDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleExport} disabled={!exportTitle.trim() || !exportStartDate || !exportEndDate || exporting}>
              {exporting ? 'Guardando…' : 'Guardar como plantilla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importTemplateDialogOpen} onOpenChange={setImportTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar una plantilla al calendario de este cliente</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Plantilla</FieldLabel>
              <Select value={importTemplateId} onValueChange={v => setImportTemplateId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Seleccionar plantilla' /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Fecha de inicio</FieldLabel>
              <input type='date' className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm' value={importTemplateStartDate} onChange={e => setImportTemplateStartDate(e.target.value)} />
            </Field>
            {selectedTemplate?.type === 'weekday' && (
              <Field className='gap-2'>
                <FieldLabel>¿Repetir durante cuántas semanas?</FieldLabel>
                <Input type='number' min={1} max={12} value={importTemplateWeeks} onChange={e => setImportTemplateWeeks(e.target.value)} />
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setImportTemplateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleImportTemplate} disabled={!importTemplateId || !importTemplateStartDate || importingTemplate}>
              {importingTemplate ? 'Importando…' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
