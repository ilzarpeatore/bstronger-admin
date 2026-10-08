import { useState } from 'react'
import { Search, Clock, Users, UtensilsCrossed, ExternalLink, ImageOff, Download, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'

/**
 * Página de PRUEBA (2026-10-08) para evaluar el catálogo de Spoonacular.
 * Desde el detalle de una receta se puede guardar una copia en la biblioteca
 * propia, que es lo que permite asignársela luego a un cliente. La clave de
 * API vive en el .env del backend (SPOONACULAR_KEY), aquí no hay nada que
 * configurar.
 */

type SpoonacularIngredient = {
  name: string | null
  amount: number | null
  unit: string | null
  text: string
}

type SpoonacularRecipe = {
  external_id: number
  title: string | null
  image_url: string | null
  servings: number | null
  ready_minutes: number | null
  kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  ingredients: SpoonacularIngredient[]
  steps: string[]
  source_url: string | null
}

/** Cocinas que admite complexSearch (su lista cerrada, en minúsculas). */
const CUISINES = [
  'african', 'american', 'asian', 'british', 'cajun', 'caribbean', 'chinese',
  'eastern european', 'european', 'french', 'german', 'greek', 'indian',
  'irish', 'italian', 'japanese', 'jewish', 'korean', 'latin american',
  'mediterranean', 'mexican', 'middle eastern', 'nordic', 'southern',
  'spanish', 'thai', 'vietnamese',
]

const ANY_CUISINE = '__any__'

function macro(value: number | null, unit: string): string {
  return value === null ? '—' : `${value}${unit}`
}

export default function SpoonacularRecipesView() {
  const [query, setQuery] = useState('')
  const [cuisine, setCuisine] = useState('spanish')
  const [maxCalories, setMaxCalories] = useState('')
  const [minProtein, setMinProtein] = useState('')

  const [recipes, setRecipes] = useState<SpoonacularRecipe[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null)

  const [selected, setSelected] = useState<SpoonacularRecipe | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // external_id -> id de la receta local, para las que ya se han guardado en
  // esta sesión. El backend es idempotente, así que esto es solo para no
  // ofrecer dos veces el mismo botón y poder enseñar el id local.
  const [imported, setImported] = useState<Record<number, number>>({})
  const [importing, setImporting] = useState(false)

  const handleSearch = async () => {
    setLoading(true)
    setQuotaMessage(null)

    const params = new URLSearchParams({ number: '12' })
    if (query.trim()) params.set('query', query.trim())
    if (cuisine !== ANY_CUISINE) params.set('cuisine', cuisine)
    if (maxCalories.trim()) params.set('maxCalories', maxCalories.trim())
    if (minProtein.trim()) params.set('minProtein', minProtein.trim())

    try {
      const res = await api.get(`/admin/spoonacular/search?${params.toString()}`)
      setRecipes(res.data || [])
      setTotal(res.total ?? (res.data?.length || 0))
      setSearched(true)
    } catch (err) {
      const apiErr = err as ApiError
      // 402 = puntos del día agotados. No es un fallo nuestro y conviene
      // que se quede en pantalla, no en un toast que desaparece.
      if (apiErr?.status === 402) {
        setQuotaMessage(apiErr.data?.message || 'Se ha agotado la cuota diaria de Spoonacular.')
        setRecipes([])
      } else {
        toast.error(apiErr?.data?.message || apiErr?.message || 'Error al buscar en Spoonacular')
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * El modal pide siempre el detalle, aunque la búsqueda ya traiga
   * ingredientes y pasos. Comprobado contra la API real (2026-10-08):
   * complexSearch devuelve las cantidades YA DIVIDIDAS por ración
   * ("0.13 bay leaf" en una receta de 8 raciones), mientras que
   * /{id}/information trae extendedIngredients.original con la línea de la
   * receta entera ("1 bay leaf"), que es lo que se puede leer. El backend
   * cachea el detalle 1h, así que reabrir la misma receta no gasta puntos.
   *
   * Mientras llega, se muestra lo que ya tenemos de la búsqueda, y si la
   * llamada falla eso es lo que se queda (mejor incompleto que vacío).
   */
  const openRecipe = async (recipe: SpoonacularRecipe) => {
    setSelected(recipe)
    setLoadingDetail(true)

    try {
      const res = await api.get(`/admin/spoonacular/recipes/${recipe.external_id}`)
      setSelected(res.data)
    } catch (err) {
      const apiErr = err as ApiError
      toast.error(
        apiErr?.status === 402
          ? apiErr.data?.message || 'Cuota diaria de Spoonacular agotada.'
          : 'No se pudo cargar el detalle: se muestra lo que vino de la búsqueda'
      )
    } finally {
      setLoadingDetail(false)
    }
  }

  /**
   * Guarda una copia permanente en la biblioteca propia. A partir de ahí la
   * receta es una receta normal: se asigna a un cliente desde Calendario de
   * comidas con la fuente «recetas propias», y el cliente la ve en la app
   * sin que haya que tocar nada más.
   */
  const importRecipe = async (recipe: SpoonacularRecipe) => {
    setImporting(true)
    try {
      const res = await api.post(`/admin/spoonacular/recipes/${recipe.external_id}/import`, {})
      setImported(prev => ({ ...prev, [recipe.external_id]: res.data.recipe_id }))
      toast.success(
        res.data.ya_existia
          ? `Ya estaba en la biblioteca (receta #${res.data.recipe_id})`
          : `Guardada como receta #${res.data.recipe_id}. Ya puedes asignarla desde Calendario de comidas.`
      )
    } catch (err) {
      const apiErr = err as ApiError
      toast.error(
        apiErr?.status === 402
          ? apiErr.data?.message || 'Cuota diaria de Spoonacular agotada.'
          : apiErr?.data?.message || 'No se pudo guardar la receta'
      )
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Recetas · Spoonacular</CardTitle>
          <p className='text-xs text-muted-foreground mt-1'>
            Prueba de la API de Spoonacular. Los macros son por ración. Desde el detalle de una
            receta puedes guardarla en la biblioteca para asignarla luego a un cliente.
          </p>
        </CardHeader>
        <CardContent className='space-y-6'>
          <form
            className='grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end'
            onSubmit={e => { e.preventDefault(); handleSearch() }}
          >
            <Field>
              <FieldLabel htmlFor='sp-query'>Búsqueda</FieldLabel>
              <Input
                id='sp-query'
                placeholder='pollo, lentejas, tortilla...'
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor='sp-cuisine'>Cocina</FieldLabel>
              <Select value={cuisine} onValueChange={value => setCuisine(value ?? ANY_CUISINE)}>
                <SelectTrigger id='sp-cuisine'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_CUISINE}>Todas</SelectItem>
                  {CUISINES.map(c => (
                    <SelectItem key={c} value={c} className='capitalize'>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor='sp-kcal'>Kcal máx.</FieldLabel>
              <Input
                id='sp-kcal'
                type='number'
                min={0}
                max={10000}
                placeholder='600'
                value={maxCalories}
                onChange={e => setMaxCalories(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor='sp-protein'>Proteína mín. (g)</FieldLabel>
              <Input
                id='sp-protein'
                type='number'
                min={0}
                max={1000}
                placeholder='30'
                value={minProtein}
                onChange={e => setMinProtein(e.target.value)}
              />
            </Field>
            <Button type='submit' disabled={loading}>
              <Search className='size-4 mr-1' />
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </form>

          {quotaMessage && (
            <Alert variant='destructive'>
              <AlertTitle>Cuota de Spoonacular agotada</AlertTitle>
              <AlertDescription>{quotaMessage}</AlertDescription>
            </Alert>
          )}

          <Separator />

          {loading ? (
            <div className='flex justify-center py-16'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : recipes.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-20 text-muted-foreground'>
              <UtensilsCrossed className='size-12 mb-4 opacity-50' />
              <p>{searched ? 'Ninguna receta cumple esos filtros' : 'Haz una búsqueda para ver recetas'}</p>
              {searched && (
                <p className='text-xs mt-1'>Prueba a subir las kcal máximas o a bajar la proteína mínima.</p>
              )}
            </div>
          ) : (
            <>
              <p className='text-xs text-muted-foreground'>
                {recipes.length} de {total} resultados
              </p>
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {recipes.map(recipe => (
                  <button
                    key={recipe.external_id}
                    type='button'
                    onClick={() => openRecipe(recipe)}
                    className='text-left rounded-lg border bg-card overflow-hidden hover:border-primary hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  >
                    {recipe.image_url ? (
                      <img
                        src={recipe.image_url}
                        alt={recipe.title ?? ''}
                        loading='lazy'
                        className='w-full aspect-video object-cover'
                      />
                    ) : (
                      <div className='w-full aspect-video bg-muted flex items-center justify-center'>
                        <ImageOff className='size-8 text-muted-foreground opacity-50' />
                      </div>
                    )}

                    <div className='p-3 space-y-2'>
                      <p className='text-sm font-medium line-clamp-2'>{recipe.title ?? 'Sin título'}</p>

                      <div className='flex flex-wrap gap-1'>
                        <Badge variant='default'>{macro(recipe.kcal, ' kcal')}</Badge>
                        <Badge variant='secondary'>P {macro(recipe.protein_g, 'g')}</Badge>
                        <Badge variant='secondary'>H {macro(recipe.carbs_g, 'g')}</Badge>
                        <Badge variant='secondary'>G {macro(recipe.fat_g, 'g')}</Badge>
                      </div>

                      <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                        {recipe.ready_minutes !== null && (
                          <span className='flex items-center gap-1'>
                            <Clock className='size-3' /> {recipe.ready_minutes} min
                          </span>
                        )}
                        {recipe.servings !== null && (
                          <span className='flex items-center gap-1'>
                            <Users className='size-3' /> {recipe.servings} raciones
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null) }}>
        <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='pr-6'>{selected?.title ?? 'Receta'}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className='space-y-5'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='default'>{macro(selected.kcal, ' kcal')}</Badge>
                <Badge variant='secondary'>Proteína {macro(selected.protein_g, 'g')}</Badge>
                <Badge variant='secondary'>Hidratos {macro(selected.carbs_g, 'g')}</Badge>
                <Badge variant='secondary'>Grasa {macro(selected.fat_g, 'g')}</Badge>
                <span className='text-xs text-muted-foreground'>por ración</span>
              </div>

              <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                {selected.ready_minutes !== null && (
                  <span className='flex items-center gap-1'>
                    <Clock className='size-3' /> {selected.ready_minutes} min
                  </span>
                )}
                {selected.servings !== null && (
                  <span className='flex items-center gap-1'>
                    <Users className='size-3' /> {selected.servings} raciones
                  </span>
                )}
                {selected.source_url && (
                  <a
                    href={selected.source_url}
                    target='_blank'
                    rel='noreferrer noopener'
                    className='flex items-center gap-1 hover:text-primary'
                  >
                    <ExternalLink className='size-3' /> Ver original
                  </a>
                )}
              </div>

              {loadingDetail && (
                <p className='flex items-center gap-2 text-xs text-muted-foreground'>
                  <span className='h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                  Cargando cantidades de la receta completa...
                </p>
              )}

              <div>
                <h4 className='text-sm font-semibold mb-2'>Ingredientes</h4>
                {selected.ingredients.length === 0 ? (
                  <p className='text-xs text-muted-foreground'>Spoonacular no da ingredientes para esta receta.</p>
                ) : (
                  <ul className='space-y-1'>
                    {selected.ingredients.map((ing, i) => (
                      <li key={i} className='text-sm flex gap-2'>
                        <span className='text-muted-foreground'>·</span>
                        <span className='first-letter:uppercase'>{ing.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Separator />

              <div>
                <h4 className='text-sm font-semibold mb-2'>Preparación</h4>
                {selected.steps.length === 0 ? (
                  <p className='text-xs text-muted-foreground'>Spoonacular no da los pasos para esta receta.</p>
                ) : (
                  <ol className='space-y-2'>
                    {selected.steps.map((step, i) => (
                      <li key={i} className='text-sm flex gap-3'>
                        <span className='shrink-0 size-5 rounded-full bg-muted text-xs flex items-center justify-center font-medium'>
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <Separator />

              <div className='flex flex-wrap items-center justify-between gap-3'>
                <p className='text-xs text-muted-foreground max-w-sm'>
                  Al guardarla se queda una copia en la biblioteca. Para que un cliente la vea,
                  asígnala después en <strong>Calendario de comidas</strong> con la fuente
                  «recetas propias».
                </p>

                {imported[selected.external_id] ? (
                  <Badge variant='secondary'>
                    <Check className='size-3 mr-1' />
                    En la biblioteca (#{imported[selected.external_id]})
                  </Badge>
                ) : (
                  <Button onClick={() => importRecipe(selected)} disabled={importing || loadingDetail}>
                    <Download className='size-4 mr-1' />
                    {importing ? 'Guardando...' : 'Guardar en la biblioteca'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
