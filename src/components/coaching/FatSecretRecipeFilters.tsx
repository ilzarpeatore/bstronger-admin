import { useEffect, useState } from 'react'
import { SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { api } from '@/lib/api'

// Filtros server-side reales de recipes.search.v3 (2026-09-20, ver
// docs/FATSECRET_INTEGRATION.md seccion 13 en Bckbs) -- todos disponibles en
// plan Basic. Los porcentajes de macro son sobre CALORIAS de la receta (lo
// que expone la API), no gramos absolutos -- la propia API no ofrece un
// filtro de gramos, así que la UI se etiqueta como "%" para no confundir.
export type FatSecretRecipeFilterValues = {
  caloriesFrom: string
  caloriesTo: string
  proteinFrom: string
  proteinTo: string
  carbFrom: string
  carbTo: string
  fatFrom: string
  fatTo: string
  prepTimeFrom: string
  prepTimeTo: string
  recipeType: string
  mustHaveImages: boolean
  sortBy: string
}

export const EMPTY_FATSECRET_FILTERS: FatSecretRecipeFilterValues = {
  caloriesFrom: '',
  caloriesTo: '',
  proteinFrom: '',
  proteinTo: '',
  carbFrom: '',
  carbTo: '',
  fatFrom: '',
  fatTo: '',
  prepTimeFrom: '',
  prepTimeTo: '',
  recipeType: '',
  mustHaveImages: false,
  sortBy: '',
}

export function hasActiveFatSecretFilters(f: FatSecretRecipeFilterValues): boolean {
  return Object.entries(f).some(([k, v]) => (k === 'mustHaveImages' ? v === true : v !== ''))
}

/** Construye los query params reales que espera el backend (Admin\FatSecretController::searchRecipes / API\FatSecretController::search). */
export function fatSecretFiltersToParams(f: FatSecretRecipeFilterValues): Record<string, string> {
  const params: Record<string, string> = {}
  if (f.caloriesFrom) params.calories_from = f.caloriesFrom
  if (f.caloriesTo) params.calories_to = f.caloriesTo
  if (f.proteinFrom) params.protein_percentage_from = f.proteinFrom
  if (f.proteinTo) params.protein_percentage_to = f.proteinTo
  if (f.carbFrom) params.carb_percentage_from = f.carbFrom
  if (f.carbTo) params.carb_percentage_to = f.carbTo
  if (f.fatFrom) params.fat_percentage_from = f.fatFrom
  if (f.fatTo) params.fat_percentage_to = f.fatTo
  if (f.prepTimeFrom) params.prep_time_from = f.prepTimeFrom
  if (f.prepTimeTo) params.prep_time_to = f.prepTimeTo
  if (f.mustHaveImages) params.must_have_images = 'true'
  if (f.sortBy) params.sort_by = f.sortBy
  return params
}

/** `recipe_types[]` va aparte porque no es un par clave=valor simple en un objeto plano. */
export function fatSecretFiltersToRecipeTypesQuery(f: FatSecretRecipeFilterValues): string {
  return f.recipeType ? `&recipe_types[]=${encodeURIComponent(f.recipeType)}` : ''
}

const SORT_OPTIONS = [
  { value: 'caloriesPerServingAscending', label: 'Menos calorías primero' },
  { value: 'caloriesPerServingDescending', label: 'Más calorías primero' },
  { value: 'newest', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguas' },
]

// Cache a nivel de módulo -- recipe_types.get es una lista casi estática
// (13 valores fijos de FatSecret), no tiene sentido re-pedirla cada vez que
// se monta este componente en una vista distinta.
let recipeTypesCache: string[] | null = null

export default function FatSecretRecipeFilters({
  value,
  onChange,
  endpoint = '/admin/fatsecret/recipe-types',
}: {
  value: FatSecretRecipeFilterValues
  onChange: (next: FatSecretRecipeFilterValues) => void
  /** Endpoint de recipe-types a usar -- el admin y el cliente tienen rutas distintas. */
  endpoint?: string
}) {
  const [open, setOpen] = useState(false)
  const [recipeTypes, setRecipeTypes] = useState<string[]>(recipeTypesCache ?? [])

  useEffect(() => {
    if (recipeTypesCache) return
    api.get(endpoint)
      .then(res => {
        const types = res.data?.data || res.data || []
        recipeTypesCache = types
        setRecipeTypes(types)
      })
      .catch(() => {})
  }, [endpoint])

  const set = (patch: Partial<FatSecretRecipeFilterValues>) => onChange({ ...value, ...patch })
  const active = hasActiveFatSecretFilters(value)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className='w-full flex items-center justify-between rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors'>
        <span className='flex items-center gap-1.5'>
          <SlidersHorizontal className='size-3.5' />
          Filtros {active && <span className='text-primary'>(activos)</span>}
        </span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className='mt-2 space-y-3 rounded-md border p-3'>
          <div className='grid grid-cols-2 gap-2'>
            <Field className='gap-1'>
              <FieldLabel className='text-xs'>Calorías desde</FieldLabel>
              <Input type='number' min={0} value={value.caloriesFrom} onChange={e => set({ caloriesFrom: e.target.value })} placeholder='ej. 300' />
            </Field>
            <Field className='gap-1'>
              <FieldLabel className='text-xs'>Calorías hasta</FieldLabel>
              <Input type='number' min={0} value={value.caloriesTo} onChange={e => set({ caloriesTo: e.target.value })} placeholder='ej. 600' />
            </Field>
          </div>
          <div className='grid grid-cols-3 gap-2'>
            <Field className='gap-1'>
              <FieldLabel className='text-xs'>% proteína</FieldLabel>
              <div className='flex gap-1'>
                <Input type='number' min={0} max={100} value={value.proteinFrom} onChange={e => set({ proteinFrom: e.target.value })} placeholder='min' />
                <Input type='number' min={0} max={100} value={value.proteinTo} onChange={e => set({ proteinTo: e.target.value })} placeholder='max' />
              </div>
            </Field>
            <Field className='gap-1'>
              <FieldLabel className='text-xs'>% carbos</FieldLabel>
              <div className='flex gap-1'>
                <Input type='number' min={0} max={100} value={value.carbFrom} onChange={e => set({ carbFrom: e.target.value })} placeholder='min' />
                <Input type='number' min={0} max={100} value={value.carbTo} onChange={e => set({ carbTo: e.target.value })} placeholder='max' />
              </div>
            </Field>
            <Field className='gap-1'>
              <FieldLabel className='text-xs'>% grasa</FieldLabel>
              <div className='flex gap-1'>
                <Input type='number' min={0} max={100} value={value.fatFrom} onChange={e => set({ fatFrom: e.target.value })} placeholder='min' />
                <Input type='number' min={0} max={100} value={value.fatTo} onChange={e => set({ fatTo: e.target.value })} placeholder='max' />
              </div>
            </Field>
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <Field className='gap-1'>
              <FieldLabel className='text-xs'>Preparación (min)</FieldLabel>
              <div className='flex gap-1'>
                <Input type='number' min={0} value={value.prepTimeFrom} onChange={e => set({ prepTimeFrom: e.target.value })} placeholder='min' />
                <Input type='number' min={0} value={value.prepTimeTo} onChange={e => set({ prepTimeTo: e.target.value })} placeholder='max' />
              </div>
            </Field>
            <Field className='gap-1'>
              <FieldLabel className='text-xs'>Tipo de receta</FieldLabel>
              <Select value={value.recipeType || '__any__'} onValueChange={v => set({ recipeType: v === '__any__' ? '' : (v ?? '') })}>
                <SelectTrigger><SelectValue placeholder='Cualquiera' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__any__'>Cualquiera</SelectItem>
                  {recipeTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className='flex items-center justify-between gap-3'>
            <label className='flex items-center gap-2 text-xs cursor-pointer'>
              <Checkbox checked={value.mustHaveImages} onCheckedChange={c => set({ mustHaveImages: c === true })} />
              Solo con foto
            </label>
            <Select value={value.sortBy || '__default__'} onValueChange={v => set({ sortBy: v === '__default__' ? '' : (v ?? '') })}>
              <SelectTrigger className='w-[190px]'><SelectValue placeholder='Orden por defecto' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='__default__'>Orden por defecto</SelectItem>
                {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {active && (
            <Button type='button' variant='ghost' size='sm' className='w-full text-muted-foreground' onClick={() => onChange(EMPTY_FATSECRET_FILTERS)}>
              Quitar filtros
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
