import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Search, PlusCircle, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Desayuno' },
  { key: 'lunch', label: 'Almuerzo' },
  { key: 'dinner', label: 'Cena' },
  { key: 'snacks', label: 'Meriendas' },
]

type DietOption = { id: number; title: string }
type MealItem = { id: number; meal_type: MealType; recipe_id: number; recipe?: { id: number; title: string } }
type RecipeOption = { id: number; title: string; calories?: number }

export default function DietMealItemsView() {
  const [diets, setDiets] = useState<DietOption[]>([])
  const [dietId, setDietId] = useState('')
  const [items, setItems] = useState<MealItem[]>([])
  const [loading, setLoading] = useState(false)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignMealType, setAssignMealType] = useState<MealType>('breakfast')
  const [recipeSearch, setRecipeSearch] = useState('')
  const [recipeResults, setRecipeResults] = useState<RecipeOption[]>([])
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeOption | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.get('/admin/diets?per_page=200')
      .then(res => setDiets(res.data?.data || res.data || []))
      .catch(() => toast.error('Error al cargar las dietas'))
  }, [])

  const fetchItems = useCallback(async () => {
    if (!dietId) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const res = await api.get(`/admin/diets/${dietId}/meal-items`)
      setItems(res.data?.items || [])
    } catch {
      toast.error('Error al cargar los elementos de comidas')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [dietId])

  useEffect(() => { fetchItems() }, [fetchItems])

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

  const openAssign = (mealType: MealType) => {
    setAssignMealType(mealType)
    setRecipeSearch('')
    setRecipeResults([])
    setSelectedRecipe(null)
    setAssignOpen(true)
    searchRecipes('')
  }

  const handleAddItem = async () => {
    if (!dietId || !selectedRecipe) return
    setSubmitting(true)
    try {
      await api.post(`/admin/diets/${dietId}/meal-items`, {
        meal_type: assignMealType,
        recipe_id: selectedRecipe.id,
      })
      toast.success('Receta añadida')
      setAssignOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al añadir la receta')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveItem = async (itemId: number) => {
    try {
      await api.delete(`/admin/diet-meal-items/${itemId}`)
      toast.success('Receta eliminada')
      fetchItems()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al eliminar la receta')
    }
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4'>
            <CardTitle>Elementos de comidas</CardTitle>
            <Select value={dietId} onValueChange={v => setDietId(v ?? '')}>
              <SelectTrigger className='w-full sm:w-[280px]'>
                <SelectValue placeholder='Seleccionar dieta' />
              </SelectTrigger>
              <SelectContent>
                {diets.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!dietId ? (
            <div className='flex flex-col items-center justify-center py-20 text-muted-foreground'>
              <UtensilsCrossed className='size-12 mb-4 opacity-50' />
              <p>Selecciona una dieta para gestionar sus recetas de desayuno/almuerzo/cena/meriendas</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
              {MEAL_TYPES.map(({ key, label }) => {
                const mealItems = items.filter(it => it.meal_type === key)
                return (
                  <div key={key} className='border rounded-lg p-3'>
                    <div className='flex items-center justify-between mb-2'>
                      <p className='text-sm font-semibold'>{label}</p>
                      <button onClick={() => openAssign(key)} className='text-muted-foreground hover:text-primary'>
                        <PlusCircle className='size-4' />
                      </button>
                    </div>
                    <div className='space-y-1.5 min-h-[40px]'>
                      {loading ? (
                        <p className='text-xs text-muted-foreground'>Cargando…</p>
                      ) : mealItems.length === 0 ? (
                        <p className='text-xs text-muted-foreground italic'>Aún no hay recetas</p>
                      ) : (
                        mealItems.map(it => (
                          <div key={it.id} className='flex items-center justify-between gap-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded px-2 py-1.5'>
                            <span className='truncate'>{it.recipe?.title ?? `Receta #${it.recipe_id}`}</span>
                            <button onClick={() => handleRemoveItem(it.id)} className='shrink-0 hover:text-red-600'>
                              <X className='size-3.5' />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir receta — {MEAL_TYPES.find(m => m.key === assignMealType)?.label}</DialogTitle>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant='outline' onClick={() => setAssignOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddItem} disabled={!selectedRecipe || submitting}>
              {submitting ? 'Añadiendo…' : 'Añadir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
