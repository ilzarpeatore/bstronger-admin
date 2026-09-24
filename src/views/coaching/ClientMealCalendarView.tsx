import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, CalendarIcon, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import FatSecretRecipeFilters, { EMPTY_FATSECRET_FILTERS, fatSecretFiltersToParams, fatSecretFiltersToRecipeTypesQuery, type FatSecretRecipeFilterValues } from '@/components/coaching/FatSecretRecipeFilters'

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
  recipe_id: number | null
  fatsecret_recipe_id: number | null
  calories: number
  // Mismo shape para ambos orígenes -- ver DailyPlanRecipeResource::resolveRecipePreview()
  // en el backend (Bckbs). `title`/`recipe_image` pueden venir null si el
  // cache de FatSecret todavía no se ha rellenado para esa receta.
  recipe?: { id: number; title: string | null; recipe_image: string | null; source?: 'fatsecret' }
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
// Receta de FatSecret (2026-09-19, ver docs/FATSECRET_INTEGRATION.md en el
// repo Bckbs) -- selección unificada con RecipeOption vía RecipeSelection,
// nunca se guarda nada de esto de forma permanente, solo el id al asignar.
type FatSecretRecipeOption = { fatsecret_recipe_id: number; name: string; image_url: string | null; calories: number }
type RecipeSource = 'local' | 'fatsecret'
type RecipeSelection = { source: RecipeSource; id: number; title: string; calories?: number; image_url?: string | null }

type LocalRecipeDetail = {
  id: number; title: string; description?: string | null; preparation_time?: string | null
  calories: number; protein: number; fats: number; carbs: number; recipe_image?: string | null
}
type RecipeIngredientRow = {
  id: number; ingredient_id: number; ingredient_title: string
  measurement_unit_id: number | null; measurement_unit_title: string | null
  quantity: number; quantity_grams: number; quantity_display: string
  calories: number; protein: number; fats: number; carbs: number
}
type FatSecretIngredientLine = { description: string | null; food_id: number | null; number_of_units: number | null; measurement_description: string | null }
// Contenido en vivo de FatSecret (recipe.get.v2) para asignaciones
// antiguas al calendario que se hicieron ANTES del fix de 2026-09-20
// (ClientMealPlanController::assignRecipe() ahora siempre importa a la
// biblioteca) -- sin recipe_id local no hay nada editable, solo lectura.
type FatSecretRecipeDetail = {
  fatsecret_recipe_id: number; name: string; image_url: string | null
  calories: number; protein: number; fat: number; carbs: number
  directions: string[]; ingredients: FatSecretIngredientLine[]
}
type SimpleOption = { id: number; title: string }

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
  const [recipeSource, setRecipeSource] = useState<RecipeSource>('local')
  const [recipeSearch, setRecipeSearch] = useState('')
  const [recipeResults, setRecipeResults] = useState<RecipeOption[]>([])
  const [fatSecretResults, setFatSecretResults] = useState<FatSecretRecipeOption[]>([])
  const [recipeSearchLoading, setRecipeSearchLoading] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSelection | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fsFilters, setFsFilters] = useState<FatSecretRecipeFilterValues>(EMPTY_FATSECRET_FILTERS)
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

  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailRecipe, setDetailRecipe] = useState<LocalRecipeDetail | null>(null)
  const [detailFsRecipe, setDetailFsRecipe] = useState<FatSecretRecipeDetail | null>(null)
  const [detailIngredients, setDetailIngredients] = useState<RecipeIngredientRow[]>([])
  const [detailEditing, setDetailEditing] = useState(false)
  const [detailForm, setDetailForm] = useState<Record<string, any>>({})
  const [detailSaving, setDetailSaving] = useState(false)
  const [allIngredients, setAllIngredients] = useState<SimpleOption[]>([])
  const [allUnits, setAllUnits] = useState<SimpleOption[]>([])
  const [addIngOpen, setAddIngOpen] = useState(false)
  const [addIngForm, setAddIngForm] = useState<Record<string, any>>({ ingredient_id: '', measurement_unit_id: '', quantity: 1, quantity_grams: '' })
  const [savingIng, setSavingIng] = useState(false)

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

  const searchRecipes = useCallback(async (query: string, source: RecipeSource, filters: FatSecretRecipeFilterValues) => {
    if (source === 'fatsecret' && query.trim().length < 2) {
      setFatSecretResults([])
      return
    }
    setRecipeSearchLoading(true)
    try {
      if (source === 'local') {
        const res = await api.get(`/admin/recipes?search=${encodeURIComponent(query)}&per_page=15`)
        setRecipeResults(res.data?.data || res.data || [])
      } else {
        const params = new URLSearchParams({ q: query, ...fatSecretFiltersToParams(filters) })
        const res = await api.get(`/admin/fatsecret/recipes/search?${params.toString()}${fatSecretFiltersToRecipeTypesQuery(filters)}`)
        setFatSecretResults(res.data?.results || [])
      }
    } catch (err: any) {
      if (source === 'local') setRecipeResults([])
      else {
        setFatSecretResults([])
        toast.error('No se pudo buscar en FatSecret', { description: err?.data?.message })
      }
    } finally {
      setRecipeSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!assignDialogOpen) return
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => searchRecipes(recipeSearch, recipeSource, fsFilters), 350)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [recipeSearch, recipeSource, fsFilters, assignDialogOpen, searchRecipes])

  const openAssignDialog = useCallback((dateStr: string, mealType: MealType) => {
    if (!clientId) {
      toast.info('Selecciona un cliente primero')
      return
    }
    setAssignDate(dateStr)
    setAssignMealType(mealType)
    setRecipeSource('local')
    setRecipeSearch('')
    setRecipeResults([])
    setFatSecretResults([])
    setSelectedRecipe(null)
    setFsFilters(EMPTY_FATSECRET_FILTERS)
    setAssignDialogOpen(true)
    searchRecipes('', 'local', EMPTY_FATSECRET_FILTERS)
  }, [clientId, searchRecipes])

  const handleAssign = useCallback(async () => {
    if (!clientId || !assignDate || !selectedRecipe) return
    setSubmitting(true)
    try {
      await api.post('/admin/client-meal-calendar/assign', {
        user_id: Number(clientId),
        date: assignDate,
        meal_type: assignMealType,
        ...(selectedRecipe.source === 'fatsecret'
          ? { fatsecret_recipe_id: selectedRecipe.id }
          : { recipe_id: selectedRecipe.id }),
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

  const loadIngredientPickerData = useCallback(() => {
    if (allIngredients.length > 0) return
    Promise.all([
      api.get('/admin/ingredients?per_page=-1').catch(() => ({ data: { data: [] } })),
      api.get('/admin/measurement-units?per_page=-1').catch(() => ({ data: { data: [] } })),
    ]).then(([ingRes, unitRes]) => {
      setAllIngredients(ingRes.data?.data || ingRes.data || [])
      setAllUnits(unitRes.data?.data || unitRes.data || [])
    })
  }, [allIngredients.length])

  const loadDetailIngredients = useCallback(async (recipeId: number) => {
    try {
      const res = await api.get(`/admin/recipe-ingredients?recipe_id=${recipeId}`)
      setDetailIngredients(res.data || [])
    } catch {
      setDetailIngredients([])
    }
  }, [])

  const openMealDetail = useCallback(async (meal: AssignedMeal) => {
    setDetailDialogOpen(true)
    setDetailEditing(false)
    setDetailRecipe(null)
    setDetailFsRecipe(null)
    setDetailIngredients([])
    setDetailLoading(true)
    try {
      if (meal.recipe_id) {
        const [recRes] = await Promise.all([
          api.get(`/admin/recipes/${meal.recipe_id}`),
          loadDetailIngredients(meal.recipe_id),
        ])
        const rec = recRes.data?.data || recRes.data
        setDetailRecipe(rec)
        setDetailForm({ title: rec.title, calories: rec.calories, protein: rec.protein, fats: rec.fats, carbs: rec.carbs })
      } else if (meal.fatsecret_recipe_id) {
        const res = await api.get(`/admin/fatsecret/recipes/${meal.fatsecret_recipe_id}`)
        setDetailFsRecipe(res.data?.data || res.data)
      }
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'No se pudo cargar el contenido de la receta')
    } finally {
      setDetailLoading(false)
    }
  }, [loadDetailIngredients])

  const handleSaveDetailRecipe = async () => {
    if (!detailRecipe) return
    if (!detailForm.title?.trim()) { toast.error('El título es obligatorio'); return }
    setDetailSaving(true)
    try {
      const res = await api.put(`/admin/recipes/${detailRecipe.id}`, {
        title: detailForm.title.trim(),
        calories: Number(detailForm.calories) || 0,
        protein: Number(detailForm.protein) || 0,
        fats: Number(detailForm.fats) || 0,
        carbs: Number(detailForm.carbs) || 0,
      })
      const updated = res.data?.data || res.data
      setDetailRecipe(updated)
      toast.success('Receta actualizada')
      setDetailEditing(false)
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al actualizar la receta')
    } finally {
      setDetailSaving(false)
    }
  }

  const openAddDetailIngredient = () => {
    loadIngredientPickerData()
    setAddIngForm({ ingredient_id: '', measurement_unit_id: '', quantity: 1, quantity_grams: '' })
    setAddIngOpen(true)
  }

  const handleAddDetailIngredient = async () => {
    if (!detailRecipe) return
    if (!addIngForm.ingredient_id) { toast.error('Selecciona un ingrediente'); return }
    if (!addIngForm.quantity || Number(addIngForm.quantity) <= 0) { toast.error('La cantidad debe ser > 0'); return }
    setSavingIng(true)
    try {
      await api.post('/admin/recipe-ingredients-save', {
        recipe_id: detailRecipe.id,
        ingredients: [{
          recipe_ingredient_id: null,
          ingredient_id: Number(addIngForm.ingredient_id),
          measurement_unit_id: addIngForm.measurement_unit_id ? Number(addIngForm.measurement_unit_id) : null,
          quantity: Number(addIngForm.quantity),
          quantity_grams: addIngForm.quantity_grams ? Number(addIngForm.quantity_grams) : 0,
        }],
      })
      toast.success('Ingrediente añadido')
      setAddIngOpen(false)
      await loadDetailIngredients(detailRecipe.id)
      const recRes = await api.get(`/admin/recipes/${detailRecipe.id}`)
      setDetailRecipe(recRes.data?.data || recRes.data)
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al añadir el ingrediente')
    } finally {
      setSavingIng(false)
    }
  }

  const handleRemoveDetailIngredient = async (ing: RecipeIngredientRow) => {
    if (!detailRecipe) return
    try {
      await api.post('/admin/recipe-ingredients-delete', { id: ing.id, recipe_id: detailRecipe.id })
      toast.success('Ingrediente eliminado')
      await loadDetailIngredients(detailRecipe.id)
      const recRes = await api.get(`/admin/recipes/${detailRecipe.id}`)
      setDetailRecipe(recRes.data?.data || recRes.data)
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al eliminar el ingrediente')
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
                                            className={`text-[9px] leading-tight px-1 py-0.5 rounded flex items-center justify-between gap-0.5 cursor-pointer hover:brightness-95 ${
                                              m.is_coach_assigned
                                                ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                                            }`}
                                            title={m.recipe?.title ?? undefined}
                                            onClick={() => openMealDetail(m)}
                                          >
                                            <span className='truncate'>
                                              {m.recipe?.title ?? (m.fatsecret_recipe_id ? 'Receta de FatSecret' : `Receta #${m.recipe_id}`)}
                                            </span>
                                            <button
                                              className='shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-600'
                                              onClick={(e) => {
                                                e.stopPropagation()
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
              <div className='flex gap-2'>
                <Button
                  type='button'
                  variant={recipeSource === 'local' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    setRecipeSource('local')
                    setSelectedRecipe(null)
                    searchRecipes(recipeSearch, 'local', fsFilters)
                  }}
                >
                  Mis recetas
                </Button>
                <Button
                  type='button'
                  variant={recipeSource === 'fatsecret' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    setRecipeSource('fatsecret')
                    setSelectedRecipe(null)
                    searchRecipes(recipeSearch, 'fatsecret', fsFilters)
                  }}
                >
                  FatSecret
                </Button>
              </div>
              <div className='relative'>
                <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
                <Input
                  className='pl-8'
                  placeholder={recipeSource === 'local' ? 'Buscar en tus recetas...' : 'Buscar en FatSecret (en inglés)...'}
                  value={recipeSearch}
                  onChange={e => {
                    setRecipeSearch(e.target.value)
                    setSelectedRecipe(null)
                  }}
                />
              </div>
              {recipeSource === 'fatsecret' && (
                <FatSecretRecipeFilters value={fsFilters} onChange={setFsFilters} endpoint='/admin/fatsecret/recipe-types' />
              )}
              <div className='max-h-56 overflow-y-auto border rounded-md divide-y'>
                {recipeSearchLoading ? (
                  <div className='p-3 text-sm text-muted-foreground text-center'>Buscando…</div>
                ) : recipeSource === 'local' ? (
                  recipeResults.length === 0 ? (
                    <div className='p-3 text-sm text-muted-foreground text-center'>No se encontraron recetas</div>
                  ) : (
                    recipeResults.map(r => (
                      <button
                        key={r.id}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between ${
                          selectedRecipe?.source === 'local' && selectedRecipe.id === r.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => setSelectedRecipe({ source: 'local', id: r.id, title: r.title, calories: r.calories, image_url: r.recipe_image })}
                      >
                        <span className='truncate'>{r.title}</span>
                        {r.calories != null && <span className='text-xs text-muted-foreground shrink-0 ml-2'>{r.calories} kcal</span>}
                      </button>
                    ))
                  )
                ) : fatSecretResults.length === 0 ? (
                  <div className='p-3 text-sm text-muted-foreground text-center'>
                    {recipeSearch.trim().length < 2 ? 'Escribe al menos 2 letras para buscar' : 'No se encontraron recetas'}
                  </div>
                ) : (
                  fatSecretResults.map(r => (
                    <button
                      key={r.fatsecret_recipe_id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${
                        selectedRecipe?.source === 'fatsecret' && selectedRecipe.id === r.fatsecret_recipe_id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedRecipe({ source: 'fatsecret', id: r.fatsecret_recipe_id, title: r.name, calories: r.calories, image_url: r.image_url })}
                    >
                      {r.image_url && (
                        <img src={r.image_url} alt='' className='size-8 rounded object-cover shrink-0' />
                      )}
                      <span className='truncate flex-1'>{r.name}</span>
                      <span className='text-xs text-muted-foreground shrink-0'>{Math.round(r.calories)} kcal</span>
                    </button>
                  ))
                )}
              </div>
              {selectedRecipe && (
                <div className='text-xs text-muted-foreground flex items-center gap-1.5'>
                  Seleccionado: <span className='font-medium text-foreground'>{selectedRecipe.title}</span>
                  {selectedRecipe.source === 'fatsecret' && <Badge variant='outline' className='text-[10px] py-0'>FatSecret</Badge>}
                </div>
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

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className='max-w-lg max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {detailRecipe?.title || detailFsRecipe?.name || 'Contenido de la receta'}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className='flex justify-center py-12'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
          ) : detailRecipe ? (
            <div className='space-y-4'>
              {detailRecipe.recipe_image && (
                <img src={detailRecipe.recipe_image} alt='' className='w-full h-40 object-cover rounded-md' />
              )}

              {detailEditing ? (
                <FieldGroup className='gap-3'>
                  <Field className='gap-2'>
                    <FieldLabel>Título</FieldLabel>
                    <Input value={detailForm.title ?? ''} onChange={e => setDetailForm((p: any) => ({ ...p, title: e.target.value }))} />
                  </Field>
                  <div className='grid grid-cols-4 gap-2'>
                    <Field className='gap-2'>
                      <FieldLabel>Kcal</FieldLabel>
                      <Input type='number' value={detailForm.calories ?? ''} onChange={e => setDetailForm((p: any) => ({ ...p, calories: e.target.value }))} />
                    </Field>
                    <Field className='gap-2'>
                      <FieldLabel>Prot (g)</FieldLabel>
                      <Input type='number' value={detailForm.protein ?? ''} onChange={e => setDetailForm((p: any) => ({ ...p, protein: e.target.value }))} />
                    </Field>
                    <Field className='gap-2'>
                      <FieldLabel>Grasa (g)</FieldLabel>
                      <Input type='number' value={detailForm.fats ?? ''} onChange={e => setDetailForm((p: any) => ({ ...p, fats: e.target.value }))} />
                    </Field>
                    <Field className='gap-2'>
                      <FieldLabel>Carb (g)</FieldLabel>
                      <Input type='number' value={detailForm.carbs ?? ''} onChange={e => setDetailForm((p: any) => ({ ...p, carbs: e.target.value }))} />
                    </Field>
                  </div>
                  <div className='flex gap-2 justify-end'>
                    <Button variant='outline' size='sm' onClick={() => setDetailEditing(false)}>Cancelar</Button>
                    <Button size='sm' onClick={handleSaveDetailRecipe} disabled={detailSaving}>{detailSaving ? 'Guardando…' : 'Guardar cambios'}</Button>
                  </div>
                </FieldGroup>
              ) : (
                <div className='flex items-center justify-between'>
                  <div className='flex gap-3 text-sm'>
                    <span><b>{Math.round(detailRecipe.calories)}</b> kcal</span>
                    <span><b>{Math.round(detailRecipe.protein)}</b>g pro</span>
                    <span><b>{Math.round(detailRecipe.fats)}</b>g grasa</span>
                    <span><b>{Math.round(detailRecipe.carbs)}</b>g carb</span>
                  </div>
                  <Button variant='outline' size='sm' onClick={() => setDetailEditing(true)}>Editar</Button>
                </div>
              )}

              <div>
                <div className='flex items-center justify-between mb-2'>
                  <h4 className='text-sm font-medium'>Ingredientes</h4>
                  <Button variant='outline' size='sm' onClick={openAddDetailIngredient}>
                    <Plus className='size-3 mr-1' /> Añadir
                  </Button>
                </div>
                {detailIngredients.length > 0 ? (
                  <div className='space-y-1'>
                    {detailIngredients.map(ing => (
                      <div key={ing.id} className='flex items-center justify-between gap-2 text-xs border rounded-md px-2 py-1.5'>
                        <span className='truncate'>{ing.ingredient_title} — {ing.quantity_display}</span>
                        <div className='flex items-center gap-2 shrink-0'>
                          <span className='text-muted-foreground'>{Math.round(ing.calories)} kcal</span>
                          <button className='text-red-600 hover:text-red-800' onClick={() => handleRemoveDetailIngredient(ing)}>
                            <X className='size-3' />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-center text-xs text-muted-foreground py-4'>Sin ingredientes registrados</p>
                )}
              </div>
            </div>
          ) : detailFsRecipe ? (
            <div className='space-y-4'>
              <div className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800'>
                Esta comida se asignó antes de que las recetas de FatSecret se guardaran en la biblioteca —
                aquí solo puedes verla, no editarla. Quítala y vuelve a asignarla para poder editarla.
              </div>
              {detailFsRecipe.image_url && (
                <img src={detailFsRecipe.image_url} alt='' className='w-full h-40 object-cover rounded-md' />
              )}
              <div className='flex gap-3 text-sm'>
                <span><b>{Math.round(detailFsRecipe.calories)}</b> kcal</span>
                <span><b>{Math.round(detailFsRecipe.protein)}</b>g pro</span>
                <span><b>{Math.round(detailFsRecipe.fat)}</b>g grasa</span>
                <span><b>{Math.round(detailFsRecipe.carbs)}</b>g carb</span>
              </div>
              {detailFsRecipe.ingredients.length > 0 && (
                <div>
                  <h4 className='text-sm font-medium mb-2'>Ingredientes</h4>
                  <ul className='list-disc list-inside space-y-0.5 text-xs'>
                    {detailFsRecipe.ingredients.map((ing, i) => (
                      <li key={i}>{ing.description}</li>
                    ))}
                  </ul>
                </div>
              )}
              {detailFsRecipe.directions.length > 0 && (
                <div>
                  <h4 className='text-sm font-medium mb-2'>Preparación</h4>
                  <ol className='list-decimal list-inside space-y-0.5 text-xs'>
                    {detailFsRecipe.directions.map((d, i) => <li key={i}>{d}</li>)}
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <p className='text-center text-sm text-muted-foreground py-8'>No se pudo cargar esta receta</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addIngOpen} onOpenChange={setAddIngOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Añadir ingrediente</DialogTitle></DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Ingrediente</FieldLabel>
              <Select value={addIngForm.ingredient_id || ''} onValueChange={v => setAddIngForm((p: any) => ({ ...p, ingredient_id: v }))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar ingrediente' /></SelectTrigger>
                <SelectContent>
                  {allIngredients.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Unidad de medida</FieldLabel>
              <Select value={addIngForm.measurement_unit_id || ''} onValueChange={v => setAddIngForm((p: any) => ({ ...p, measurement_unit_id: v }))}>
                <SelectTrigger><SelectValue placeholder='Opcional' /></SelectTrigger>
                <SelectContent>
                  {allUnits.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className='grid grid-cols-2 gap-3'>
              <Field className='gap-2'>
                <FieldLabel>Cantidad</FieldLabel>
                <Input type='number' step='0.01' value={addIngForm.quantity ?? ''} onChange={e => setAddIngForm((p: any) => ({ ...p, quantity: e.target.value }))} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Gramos</FieldLabel>
                <Input type='number' step='0.01' value={addIngForm.quantity_grams ?? ''} onChange={e => setAddIngForm((p: any) => ({ ...p, quantity_grams: e.target.value }))} placeholder='Calculado automáticamente' />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAddIngOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddDetailIngredient} disabled={savingIng}>{savingIng ? 'Guardando…' : 'Añadir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
