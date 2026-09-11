import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Plus, X, Search, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks'
type TemplateType = 'sequential' | 'weekday'

const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Desayuno' },
  { key: 'lunch', label: 'Almuerzo' },
  { key: 'dinner', label: 'Cena' },
  { key: 'snacks', label: 'Snacks' },
]

const WEEKDAYS: { key: string; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
]

type TemplateItem = {
  id: number
  day_key: string
  meal_type: MealType
  recipe_id: number
  calories: number
  recipe?: { id: number; title: string; recipe_image: string | null }
}

type TemplateDetail = {
  id: number
  title: string
  type: TemplateType
  items: TemplateItem[]
  coach?: { id: number; name: string }
}

type RecipeOption = { id: number; title: string; calories?: number }
type User = { id: number; name?: string; first_name?: string; last_name?: string; email: string }

export default function MealPlanTemplateDetailView({ templateId }: { templateId: string }) {
  const navigate = useNavigate()
  const [template, setTemplate] = useState<TemplateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [extraDays, setExtraDays] = useState(0)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignDayKey, setAssignDayKey] = useState('')
  const [assignMealType, setAssignMealType] = useState<MealType>('breakfast')
  const [recipeSearch, setRecipeSearch] = useState('')
  const [recipeResults, setRecipeResults] = useState<RecipeOption[]>([])
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeOption | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [clients, setClients] = useState<User[]>([])
  const [importClientId, setImportClientId] = useState('')
  const [importStartDate, setImportStartDate] = useState('')
  const [importWeeks, setImportWeeks] = useState('1')
  const [importing, setImporting] = useState(false)

  const fetchTemplate = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/meal-plan-templates/${templateId}`)
      setTemplate(res.data)
    } catch {
      toast.error('Error al cargar la plantilla')
    } finally {
      setLoading(false)
    }
  }, [templateId])

  useEffect(() => { fetchTemplate() }, [fetchTemplate])

  const itemsByDay = useMemo(() => {
    const map = new Map<string, TemplateItem[]>()
    for (const item of template?.items ?? []) {
      const list = map.get(item.day_key) || []
      list.push(item)
      map.set(item.day_key, list)
    }
    return map
  }, [template])

  const sequentialDayCount = useMemo(() => {
    if (!template || template.type !== 'sequential') return 0
    const maxOffset = template.items.reduce((max, it) => Math.max(max, parseInt(it.day_key, 10) || 0), -1)
    return Math.max(maxOffset + 1, 1) + extraDays
  }, [template, extraDays])

  const days: { key: string; label: string }[] = useMemo(() => {
    if (!template) return []
    if (template.type === 'weekday') return WEEKDAYS
    return Array.from({ length: sequentialDayCount }, (_, i) => ({ key: String(i), label: `Día ${i + 1}` }))
  }, [template, sequentialDayCount])

  const searchRecipes = useCallback(async (query: string) => {
    setRecipeLoading(true)
    try {
      const res = await api.get(`/admin/recipes?search=${encodeURIComponent(query)}&per_page=15`)
      setRecipeResults(res.data?.data || res.data || [])
    } catch {
      setRecipeResults([])
    } finally {
      setRecipeLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!assignOpen) return
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => searchRecipes(recipeSearch), 350)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [recipeSearch, assignOpen, searchRecipes])

  const openAssign = (dayKey: string, mealType: MealType) => {
    setAssignDayKey(dayKey)
    setAssignMealType(mealType)
    setRecipeSearch('')
    setRecipeResults([])
    setSelectedRecipe(null)
    setAssignOpen(true)
    searchRecipes('')
  }

  const handleAddItem = async () => {
    if (!selectedRecipe) return
    setSubmitting(true)
    try {
      await api.post(`/admin/meal-plan-templates/${templateId}/items`, {
        day_key: assignDayKey,
        meal_type: assignMealType,
        recipe_id: selectedRecipe.id,
      })
      toast.success('Comida añadida')
      setAssignOpen(false)
      fetchTemplate()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al añadir la comida')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveItem = async (itemId: number) => {
    try {
      await api.delete(`/admin/meal-plan-template-items/${itemId}`)
      toast.success('Comida eliminada')
      fetchTemplate()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al eliminar la comida')
    }
  }

  const openImport = () => {
    setImportClientId('')
    setImportStartDate('')
    setImportWeeks('1')
    setImportOpen(true)
    if (clients.length === 0) {
      api.get('/admin/users?per_page=500').then(res => setClients(res.data?.data || res.data || [])).catch(() => {})
    }
  }

  const handleImport = async () => {
    if (!importClientId || !importStartDate) return
    setImporting(true)
    try {
      const res = await api.post(`/admin/meal-plan-templates/${templateId}/import-to-calendar`, {
        client_id: Number(importClientId),
        start_date: importStartDate,
        ...(template?.type === 'weekday' ? { weeks: Number(importWeeks) || 1 } : {}),
      })
      toast.success(res.message || 'Plantilla importada')
      setImportOpen(false)
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al importar la plantilla')
    } finally {
      setImporting(false)
    }
  }

  if (loading || !template) {
    return (
      <div className='flex justify-center py-20'>
        <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Button variant='ghost' size='icon' onClick={() => navigate('/meal-plan-templates')}>
              <ArrowLeft className='size-4' />
            </Button>
            <div>
              <CardTitle>{template.title}</CardTitle>
              <Badge variant={template.type === 'sequential' ? 'default' : 'secondary'} className='mt-1'>
                {template.type === 'sequential' ? 'Día 1, 2...' : 'Semanal (lun-dom)'}
              </Badge>
            </div>
          </div>
          <Button onClick={openImport}>Importar al calendario de un cliente</Button>
        </CardHeader>
        <CardContent>
          <div className='flex gap-3 overflow-x-auto pb-2'>
            {days.map(day => {
              const dayItems = itemsByDay.get(day.key) ?? []
              return (
                <div key={day.key} className='shrink-0 w-[220px] border rounded-lg p-3 bg-card'>
                  <p className='text-sm font-semibold mb-2'>{day.label}</p>
                  <div className='space-y-3'>
                    {MEAL_TYPES.map(({ key, label }) => {
                      const mealItems = dayItems.filter(it => it.meal_type === key)
                      return (
                        <div key={key}>
                          <div className='flex items-center justify-between mb-1'>
                            <span className='text-[10px] font-bold uppercase text-muted-foreground'>{label}</span>
                            <button onClick={() => openAssign(day.key, key)} className='text-muted-foreground hover:text-primary'>
                              <PlusCircle className='size-3.5' />
                            </button>
                          </div>
                          <div className='space-y-1'>
                            {mealItems.length === 0 ? (
                              <p className='text-[10px] text-muted-foreground italic'>—</p>
                            ) : (
                              mealItems.map(it => (
                                <div key={it.id} className='flex items-center justify-between gap-1 bg-blue-50 border border-blue-200 text-blue-800 text-[10px] rounded px-1.5 py-1'>
                                  <span className='truncate'>{it.recipe?.title ?? `Receta #${it.recipe_id}`}</span>
                                  <button onClick={() => handleRemoveItem(it.id)} className='shrink-0 hover:text-red-600'>
                                    <X className='size-3' />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {template.type === 'sequential' && (
              <button
                onClick={() => setExtraDays(d => d + 1)}
                className='shrink-0 w-[100px] border border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary hover:border-primary transition-colors'
              >
                <Plus className='size-5' />
                <span className='text-xs'>Añadir día</span>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Añadir comida — {template.type === 'sequential' ? `Día ${Number(assignDayKey) + 1}` : WEEKDAYS.find(w => w.key === assignDayKey)?.label} · {MEAL_TYPES.find(m => m.key === assignMealType)?.label}
            </DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-3'>
            <Field className='gap-2'>
              <FieldLabel>Receta</FieldLabel>
              <div className='relative'>
                <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
                <Input
                  className='pl-8'
                  placeholder='Buscar recetas...'
                  value={recipeSearch}
                  onChange={e => { setRecipeSearch(e.target.value); setSelectedRecipe(null) }}
                />
              </div>
              <div className='max-h-56 overflow-y-auto border rounded-md divide-y'>
                {recipeLoading ? (
                  <div className='p-3 text-sm text-muted-foreground text-center'>Buscando…</div>
                ) : recipeResults.length === 0 ? (
                  <div className='p-3 text-sm text-muted-foreground text-center'>No se encontraron recetas</div>
                ) : (
                  recipeResults.map(r => (
                    <button
                      key={r.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between ${selectedRecipe?.id === r.id ? 'bg-muted' : ''}`}
                      onClick={() => setSelectedRecipe(r)}
                    >
                      <span className='truncate'>{r.title}</span>
                      {r.calories != null && <span className='text-xs text-muted-foreground shrink-0 ml-2'>{r.calories} kcal</span>}
                    </button>
                  ))
                )}
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAssignOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddItem} disabled={!selectedRecipe || submitting}>
              {submitting ? 'Añadiendo…' : 'Añadir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar "{template.title}" a un cliente</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Cliente</FieldLabel>
              <Select value={importClientId} onValueChange={v => setImportClientId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Seleccionar cliente' /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim()} ({c.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Fecha de inicio</FieldLabel>
              <input
                type='date'
                className='border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2'
                value={importStartDate}
                onChange={e => setImportStartDate(e.target.value)}
              />
            </Field>
            {template.type === 'weekday' && (
              <Field className='gap-2'>
                <FieldLabel>¿Repetir durante cuántas semanas?</FieldLabel>
                <Input type='number' min={1} max={12} value={importWeeks} onChange={e => setImportWeeks(e.target.value)} />
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!importClientId || !importStartDate || importing}>
              {importing ? 'Importando…' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
