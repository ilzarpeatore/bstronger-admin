import { useState, useEffect, useCallback } from 'react'
import { SearchIcon, CheckIcon } from 'lucide-react'
import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type NutritionPreview = { serving_description: string; calories: number; protein: number; fat: number; carbs: number }
type FoodSearchResult = { food_id: number; food_name: string; food_type: string; brand_name: string | null; nutrition_preview: NutritionPreview | null }
type FoodDetail = {
  food_id: number
  food_name_en: string
  serving_id: number | null
  can_autocalculate: boolean
  calories_per_gram: number | null
  protein_per_gram: number | null
  fat_per_gram: number | null
  carbs_per_gram: number | null
  density_hint: number | null
}
type Category = { id: number; title: string }

// Tarjeta de importación desde FatSecret (2026-09-19, ver
// docs/FATSECRET_INTEGRATION.md) -- SOLO trae nutrición por gramo, nunca el
// nombre (se traduce a mano) ni ninguna receta/imagen de FatSecret. No
// modifica CrudView.tsx (lo usan muchas otras pantallas) -- al crear un
// ingrediente aquí, se fuerza un remount de <CrudView> (cambiando `key`)
// para que recargue su listado sin tener que tocar su lógica interna.
const FatSecretImportCard = ({ onImported }: { onImported: () => void }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<FoodSearchResult | null>(null)
  const [detail, setDetail] = useState<FoodDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [titleEs, setTitleEs] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [creating, setCreating] = useState(false)
  const [manualValues, setManualValues] = useState({ calories_per_gram: '', protein_per_gram: '', fat_per_gram: '', carbs_per_gram: '' })

  useEffect(() => {
    api.get('/admin/ingredient-categories?per_page=-1')
      .then(res => setCategories(res.data?.data || res.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      setSearching(true)
      api.get(`/admin/fatsecret/foods/search?q=${encodeURIComponent(query.trim())}`)
        .then(res => setResults(res.data || []))
        .catch((err: any) => {
          setResults([])
          toast.error('No se pudo buscar en FatSecret', { description: err?.data?.message })
        })
        .finally(() => setSearching(false))
    }, 400)
    return () => clearTimeout(handle)
  }, [query])

  const selectResult = useCallback((food: FoodSearchResult) => {
    setSelected(food)
    setDetail(null)
    setTitleEs('')
    setLoadingDetail(true)
    api.get(`/admin/fatsecret/foods/${food.food_id}`)
      .then(res => {
        const d: FoodDetail = res.data
        setDetail(d)
        setManualValues({
          calories_per_gram: d.calories_per_gram != null ? String(d.calories_per_gram) : '',
          protein_per_gram: d.protein_per_gram != null ? String(d.protein_per_gram) : '',
          fat_per_gram: d.fat_per_gram != null ? String(d.fat_per_gram) : '',
          carbs_per_gram: d.carbs_per_gram != null ? String(d.carbs_per_gram) : '',
        })
      })
      .catch((err: any) => toast.error('No se pudo cargar el detalle', { description: err?.data?.message }))
      .finally(() => setLoadingDetail(false))
  }, [])

  const reset = () => {
    setQuery('')
    setResults([])
    setSelected(null)
    setDetail(null)
    setTitleEs('')
    setCategoryId('')
    setManualValues({ calories_per_gram: '', protein_per_gram: '', fat_per_gram: '', carbs_per_gram: '' })
  }

  const canCreate = selected && titleEs.trim() && categoryId &&
    manualValues.calories_per_gram !== '' && manualValues.protein_per_gram !== '' &&
    manualValues.fat_per_gram !== '' && manualValues.carbs_per_gram !== ''

  const handleCreate = async () => {
    if (!selected || !detail) return
    setCreating(true)
    try {
      await api.post('/admin/ingredients', {
        title: titleEs.trim(),
        ingredient_category_id: Number(categoryId),
        calories_per_gram: Number(manualValues.calories_per_gram),
        protein_per_gram: Number(manualValues.protein_per_gram),
        fat_per_gram: Number(manualValues.fat_per_gram),
        carbs_per_gram: Number(manualValues.carbs_per_gram),
        density: detail.density_hint ?? undefined,
        fatsecret_food_id: detail.food_id,
        fatsecret_serving_id: detail.serving_id ?? undefined,
        fatsecret_synced_at: new Date().toISOString(),
      })
      toast.success(`Ingrediente "${titleEs.trim()}" creado desde FatSecret`)
      reset()
      onImported()
    } catch (err: any) {
      const errors = err?.data?.errors
      const description = errors ? Object.values(errors).flat().join(' ') : err?.data?.message
      toast.error('No se pudo crear el ingrediente', { description })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar ingrediente desde FatSecret</CardTitle>
        <CardDescription>
          Busca un alimento genérico para autocompletar su nutrición por gramo. El nombre en español lo escribes tú -- FatSecret
          solo aporta el dato numérico.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Field className='gap-2'>
          <FieldLabel>Buscar en FatSecret (en inglés)</FieldLabel>
          <div className='relative'>
            <SearchIcon className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
            <Input
              className='pl-9'
              placeholder='ej. chicken breast, olive oil, white rice...'
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </Field>

        {(searching || results.length > 0) && (
          <div className='rounded-md border max-h-64 overflow-y-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[40px]' />
                  <TableHead>Nombre</TableHead>
                  <TableHead className='w-[100px]'>Tipo</TableHead>
                  <TableHead className='w-[220px]'>Nutrición (preview)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searching ? (
                  <TableRow><TableCell colSpan={4} className='h-16 text-center text-sm text-muted-foreground'>Buscando...</TableCell></TableRow>
                ) : (
                  results.map(food => (
                    <TableRow
                      key={food.food_id}
                      className='cursor-pointer hover:bg-muted/50'
                      onClick={() => selectResult(food)}
                    >
                      <TableCell>{selected?.food_id === food.food_id && <CheckIcon className='size-4 text-primary' />}</TableCell>
                      <TableCell>
                        {food.food_name}
                        {food.brand_name && <span className='text-muted-foreground'> ({food.brand_name})</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={food.food_type === 'Generic' ? 'default' : 'secondary'}>{food.food_type}</Badge>
                      </TableCell>
                      <TableCell className='text-xs text-muted-foreground'>
                        {food.nutrition_preview ? (
                          <>
                            {food.nutrition_preview.calories} kcal · P {food.nutrition_preview.protein}g · G {food.nutrition_preview.fat}g · C {food.nutrition_preview.carbs}g
                            <span className='block'>por {food.nutrition_preview.serving_description}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {selected && (
          <div className='rounded-md border p-4 space-y-4 bg-muted/30'>
            {loadingDetail ? (
              <p className='text-sm text-muted-foreground'>Cargando nutrición de "{selected.food_name}"...</p>
            ) : detail ? (
              <>
                {!detail.can_autocalculate && (
                  <p className='text-sm text-amber-600'>
                    FatSecret no da una ración en gramos/ml para este alimento -- introduce los valores a mano.
                  </p>
                )}
                <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                  <Field className='gap-1.5'>
                    <FieldLabel>Cal/g</FieldLabel>
                    <Input type='number' step='0.001' value={manualValues.calories_per_gram} onChange={e => setManualValues(v => ({ ...v, calories_per_gram: e.target.value }))} />
                  </Field>
                  <Field className='gap-1.5'>
                    <FieldLabel>Prot/g</FieldLabel>
                    <Input type='number' step='0.001' value={manualValues.protein_per_gram} onChange={e => setManualValues(v => ({ ...v, protein_per_gram: e.target.value }))} />
                  </Field>
                  <Field className='gap-1.5'>
                    <FieldLabel>Grasa/g</FieldLabel>
                    <Input type='number' step='0.001' value={manualValues.fat_per_gram} onChange={e => setManualValues(v => ({ ...v, fat_per_gram: e.target.value }))} />
                  </Field>
                  <Field className='gap-1.5'>
                    <FieldLabel>Carbs/g</FieldLabel>
                    <Input type='number' step='0.001' value={manualValues.carbs_per_gram} onChange={e => setManualValues(v => ({ ...v, carbs_per_gram: e.target.value }))} />
                  </Field>
                </div>

                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <Field className='gap-1.5'>
                    <FieldLabel>Nombre en español</FieldLabel>
                    <Input placeholder='ej. Pechuga de pollo' value={titleEs} onChange={e => setTitleEs(e.target.value)} />
                  </Field>
                  <Field className='gap-1.5'>
                    <FieldLabel>Categoría</FieldLabel>
                    <Select value={categoryId} onValueChange={v => setCategoryId(v ?? '')}>
                      <SelectTrigger><SelectValue placeholder='Selecciona categoría' /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className='flex justify-end gap-2'>
                  <Button variant='outline' onClick={reset} disabled={creating}>Cancelar</Button>
                  <Button onClick={handleCreate} disabled={!canCreate || creating}>
                    {creating ? 'Creando...' : 'Crear ingrediente'}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const IngredientView = () => {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className='space-y-6'>
      <FatSecretImportCard onImported={() => setRefreshKey(k => k + 1)} />
      <CrudView
        key={refreshKey}
        title='Ingredientes'
        endpoint='/admin/ingredients'
        fields={[
          { name: 'title', label: 'Título', required: true },
          { name: 'slug', label: 'Slug', type: 'slug' },
          { name: 'ingredient_category_id', label: 'Categoría', type: 'select', endpoint: '/admin/ingredient-categories', required: true },
          { name: 'calories_per_gram', label: 'Calorías por gramo', type: 'number' },
          { name: 'protein_per_gram', label: 'Proteína por gramo', type: 'number' },
          { name: 'fat_per_gram', label: 'Grasa por gramo', type: 'number' },
          { name: 'carbs_per_gram', label: 'Carbohidratos por gramo', type: 'number' },
          { name: 'density', label: 'Densidad', type: 'number' },
          { name: 'status', label: 'Estado', type: 'select', options: [{ label: 'Activo', value: 'active' }, { label: 'Inactivo', value: 'inactive' }] },
        ]}
        columns={[
          { id: 'id', header: 'ID', accessorKey: 'id' },
          { id: 'title', header: 'Título', accessorKey: 'title' },
          { id: 'ingredient_category_id', header: 'Categoría', accessorKey: 'ingredient_category_id' },
          { id: 'calories_per_gram', header: 'Cal/g', accessorKey: 'calories_per_gram' },
          {
            id: 'fatsecret_food_id',
            header: 'Origen',
            cell: ({ row }) => row.original.fatsecret_food_id
              ? <Badge variant='outline'>FatSecret</Badge>
              : <Badge variant='secondary'>Manual</Badge>,
          },
          {
            id: 'status',
            header: 'Estado',
            cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
          },
        ]}
      />
    </div>
  )
}

export default IngredientView
