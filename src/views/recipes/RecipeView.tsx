import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, AppleIcon, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

type Recipe = {
  id: number
  title: string
  slug: string
  calories: number
  protein: number
  fats: number
  carbs: number
  status: string
  is_premium: boolean
}

type RecipeIngredient = {
  id: number
  ingredient_id: number
  ingredient_title: string
  measurement_unit_id: number | null
  measurement_unit_title: string | null
  quantity: number
  quantity_grams: number
  quantity_display: string
  calories: number
  protein: number
  fats: number
  carbs: number
}

type Ingredient = { id: number; title: string }
type Unit = { id: number; title: string; symbol: string }

const RecipeView = () => {
  const [items, setItems] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage] = useState(50)
  const [pagination, setPagination] = useState<any>(null)

  // Recipe CRUD
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingRecipe, setDeletingRecipe] = useState<Recipe | null>(null)

  // Ingredient management
  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false)
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [ingredientsLoading, setIngredientsLoading] = useState(false)
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([])
  const [allUnits, setAllUnits] = useState<Unit[]>([])
  const [ingFormOpen, setIngFormOpen] = useState(false)
  const [editingIng, setEditingIng] = useState<RecipeIngredient | null>(null)
  const [ingForm, setIngForm] = useState<Record<string, any>>({})

  // Filters
  const [categories, setCategories] = useState<any[]>([])
  const [countryTags, setCountryTags] = useState<any[]>([])
  const [dietTags, setDietTags] = useState<any[]>([])
  const [filterCategory, setFilterCategory] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterDietTag, setFilterDietTag] = useState('')
  const [filterIngredient, setFilterIngredient] = useState('')
  const [sortBy, setSortBy] = useState('id')
  const [sortOrder, setSortOrder] = useState('desc')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('per_page', String(perPage))
      params.set('page', String(page))
      if (search) params.set('search', search)
      if (filterCategory) params.set('category_ids', filterCategory)
      if (filterCountry) params.set('tag_ids', filterCountry)
      if (filterDietTag) {
        params.set('tag_ids', params.get('tag_ids') ? `${params.get('tag_ids')},${filterDietTag}` : filterDietTag)
      }
      if (filterIngredient) params.set('ingredient', filterIngredient)
      params.set('orderby', sortBy)
      params.set('order', sortOrder)
      const res = await api.get(`/admin/recipes?${params}`)
      setItems(res.data || [])
      if (res.pagination) setPagination(res.pagination)
    } catch {
      toast.error('Error al obtener las recetas')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, filterCategory, filterCountry, filterDietTag, filterIngredient, sortBy, sortOrder])

  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
      Promise.all([
        api.get('/admin/recipe-categories?per_page=-1').catch(() => ({ data: [] })),
        api.get('/admin/recipe-tags?per_page=-1').catch(() => ({ data: [] })),
        api.get('/admin/ingredients?per_page=-1').catch(() => ({ data: { data: [] } })),
        api.get('/admin/measurement-units?per_page=-1').catch(() => ({ data: { data: [] } })),
      ]).then(([catRes, tagRes, ingRes, unitRes]) => {
        setCategories(catRes.data || [])
        const allTags = tagRes.data || []
        setCountryTags(allTags.filter((t: any) => /[\u{1F1E6}-\u{1F1FF}]/u.test(t.title)).sort((a: any, b: any) => a.title.localeCompare(b.title, 'es')))
        setDietTags(allTags.filter((t: any) => !/[\u{1F1E6}-\u{1F1FF}]/u.test(t.title)).sort((a: any, b: any) => a.title.localeCompare(b.title, 'es')))
        setAllIngredients(ingRes.data?.data || ingRes.data || [])
        setAllUnits(unitRes.data?.data || unitRes.data || [])
      })
  }, [])

  const openCreate = () => { setEditingRecipe(null); setFormData({ categories: [], tags: [] }); setDialogOpen(true) }
  const openEdit = (r: Recipe) => { setEditingRecipe(r); setFormData({ title: r.title, slug: r.slug, calories: r.calories, protein: r.protein, fats: r.fats, carbs: r.carbs, status: r.status, is_premium: !!r.is_premium, categories: [], tags: [] }); setDialogOpen(true) }

  const handleSubmit = async () => {
    if (!formData.title?.trim()) { toast.error('El título es obligatorio'); return }
    setSubmitting(true)
    try {
      if (editingRecipe) {
        await api.put(`/admin/recipes/${editingRecipe.id}`, formData)
        toast.success('Receta actualizada')
      } else {
        await api.post('/admin/recipes', formData)
        toast.success('Receta creada')
      }
      setDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingRecipe) return
    try {
      await api.delete(`/admin/recipes/${deletingRecipe.id}`)
      toast.success('Receta eliminada')
      setDeleteDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error')
    }
  }

  // ─── Ingredient Management ────────────────────────────────────

  const openIngredients = async (recipe: Recipe) => {
    setActiveRecipe(recipe)
    setIngredientDialogOpen(true)
    await loadIngredients(recipe.id)
  }

  const loadIngredients = async (recipeId: number) => {
    setIngredientsLoading(true)
    try {
      const res = await api.get(`/admin/recipe-ingredients?recipe_id=${recipeId}`)
      setIngredients(res.data || [])
    } catch {
      toast.error('Error al cargar los ingredientes')
    } finally {
      setIngredientsLoading(false)
    }
  }

  const openAddIngredient = () => {
    setEditingIng(null)
    setIngForm({ ingredient_id: '', measurement_unit_id: '', quantity: 1, quantity_grams: '' })
    setIngFormOpen(true)
  }

  const openEditIngredient = (ing: RecipeIngredient) => {
    setEditingIng(ing)
    setIngForm({
      ingredient_id: String(ing.ingredient_id),
      measurement_unit_id: ing.measurement_unit_id ? String(ing.measurement_unit_id) : '',
      quantity: ing.quantity,
      quantity_grams: ing.quantity_grams || '',
    })
    setIngFormOpen(true)
  }

  const handleSaveIngredient = async () => {
    if (!ingForm.ingredient_id) { toast.error('Selecciona un ingrediente'); return }
    if (!ingForm.quantity || Number(ingForm.quantity) <= 0) { toast.error('La cantidad debe ser > 0'); return }
    if (!activeRecipe) return

    const ingredientsPayload = [{
      recipe_ingredient_id: editingIng?.id || null,
      ingredient_id: Number(ingForm.ingredient_id),
      measurement_unit_id: ingForm.measurement_unit_id ? Number(ingForm.measurement_unit_id) : null,
      quantity: Number(ingForm.quantity),
      quantity_grams: ingForm.quantity_grams ? Number(ingForm.quantity_grams) : 0,
    }]

    setSubmitting(true)
    try {
      await api.post('/admin/recipe-ingredients-save', {
        recipe_id: activeRecipe.id,
        ingredients: ingredientsPayload,
      })
      toast.success(editingIng ? 'Ingrediente actualizado' : 'Ingrediente añadido')
      setIngFormOpen(false)
      await loadIngredients(activeRecipe.id)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar el ingrediente')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteIngredient = async (ing: RecipeIngredient) => {
    if (!activeRecipe) return
    try {
      await api.post('/admin/recipe-ingredients-delete', { id: ing.id, recipe_id: activeRecipe.id })
      toast.success('Ingrediente eliminado')
      await loadIngredients(activeRecipe.id)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error')
    }
  }

  const toggleSort = (field: string) => {
    if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortOrder('desc') }
    setPage(1)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown size={12} className='ml-1 opacity-30' />
    return sortOrder === 'asc' ? <ArrowUp size={12} className='ml-1' /> : <ArrowDown size={12} className='ml-1' />
  }

  const SortHead = ({ field, label, className }: { field: string; label: string; className?: string }) => (
    <TableHead className={cn('cursor-pointer select-none hover:text-foreground', className)} onClick={() => toggleSort(field)}>
      <span className='flex items-center justify-end gap-0.5'>{label}<SortIcon field={field} /></span>
    </TableHead>
  )

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Recetas</CardTitle>
          <div className='flex items-center gap-2'>
            <Input placeholder='Buscar recetas...' value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className='w-48' />
            <Select value={filterCategory} onValueChange={v => { setFilterCategory(v === 'all' ? '' : v ?? ''); setPage(1) }}>
              <SelectTrigger className='w-40'><SelectValue placeholder='Categoría' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas las categorías</SelectItem>
                {categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCountry} onValueChange={v => { setFilterCountry(v === 'all' ? '' : v ?? ''); setPage(1) }}>
              <SelectTrigger className='w-[130px]'><SelectValue placeholder='País' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los países</SelectItem>
                {countryTags.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDietTag} onValueChange={v => { setFilterDietTag(v === 'all' ? '' : v ?? ''); setPage(1) }}>
              <SelectTrigger className='w-[160px]'><SelectValue placeholder='Clasificación' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas las etiquetas</SelectItem>
                {dietTags.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder='Filtrar por ingrediente...' value={filterIngredient} onChange={e => { setFilterIngredient(e.target.value); setPage(1) }} className='w-40' />
            <Button onClick={openCreate}><PlusIcon className='size-4 mr-2' /> Añadir Receta</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[60px]'>ID</TableHead>
                  <TableHead>Título</TableHead>
                  <SortHead field='calories' label='Cal' className='text-right' />
                  <SortHead field='protein' label='Pro' className='text-right' />
                  <SortHead field='fats' label='Gra' className='text-right' />
                  <SortHead field='carbs' label='Carb' className='text-right' />
                  <TableHead>Estado</TableHead>
                  <TableHead>Premium</TableHead>
                  <TableHead className='w-[220px]'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className='h-24 text-center'>
                      <div className='flex justify-center'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.id}</TableCell>
                      <TableCell className='font-medium max-w-[250px] truncate'>{r.title}</TableCell>
                      <TableCell className='text-right tabular-nums'>{Math.round(r.calories)}</TableCell>
                      <TableCell className='text-right tabular-nums'>{Math.round(r.protein)}g</TableCell>
                      <TableCell className='text-right tabular-nums'>{Math.round(r.fats)}g</TableCell>
                      <TableCell className='text-right tabular-nums'>{Math.round(r.carbs)}g</TableCell>
                      <TableCell><Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                      <TableCell>{r.is_premium ? <Badge variant='default'>Premium</Badge> : <Badge variant='outline'>Gratis</Badge>}</TableCell>
                      <TableCell>
                        <div className='flex gap-1'>
                          <Button variant='outline' size='sm' onClick={() => openIngredients(r)} title='Gestionar ingredientes'>
                            <AppleIcon className='size-3' />
                          </Button>
                          <Button variant='outline' size='sm' onClick={() => openEdit(r)}>
                            <PencilIcon className='size-3' />
                          </Button>
                          <Button variant='destructive' size='sm' onClick={() => { setDeletingRecipe(r); setDeleteDialogOpen(true) }}>
                            <TrashIcon className='size-3' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className='h-24 text-center'>No se encontraron recetas.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {pagination && (
            <div className='flex items-center justify-between mt-4'>
              <span className='text-sm text-muted-foreground'>
                Mostrando {((pagination.currentPage - 1) * pagination.per_page) + 1} a{' '}
                {Math.min(pagination.currentPage * pagination.per_page, pagination.total_items)} de{' '}
                {pagination.total_items?.toLocaleString()} recetas
              </span>
              <div className='flex items-center gap-2'>
                <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeftIcon className='size-4' />
                </Button>
                <span className='text-sm font-medium'>Página {pagination.currentPage} de {pagination.totalPages}</span>
                <Button variant='outline' size='sm' disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRightIcon className='size-4' />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Recipe Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingRecipe ? 'Editar Receta' : 'Crear Receta'}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Título</FieldLabel>
              <Input value={formData.title || ''} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} />
            </Field>
            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Calorías</FieldLabel>
                <Input type='number' value={formData.calories ?? ''} onChange={e => setFormData(p => ({ ...p, calories: e.target.value }))} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Proteína (g)</FieldLabel>
                <Input type='number' value={formData.protein ?? ''} onChange={e => setFormData(p => ({ ...p, protein: e.target.value }))} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Grasas (g)</FieldLabel>
                <Input type='number' value={formData.fats ?? ''} onChange={e => setFormData(p => ({ ...p, fats: e.target.value }))} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Carbohidratos (g)</FieldLabel>
                <Input type='number' value={formData.carbs ?? ''} onChange={e => setFormData(p => ({ ...p, carbs: e.target.value }))} />
              </Field>
            </div>
            <Field className='gap-2'>
              <FieldLabel>Estado</FieldLabel>
              <Select value={formData.status || 'active'} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='active'>Activo</SelectItem>
                  <SelectItem value='inactive'>Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field className='flex-row items-center justify-between gap-2'>
              <FieldLabel>Exclusivo / Premium</FieldLabel>
              <Switch
                checked={!!formData.is_premium}
                onCheckedChange={v => setFormData(p => ({ ...p, is_premium: v }))}
              />
            </Field>
            {categories.length > 0 && (
              <Field className='gap-2'>
                <FieldLabel>Categorías</FieldLabel>
                <div className='flex flex-wrap gap-2'>
                  {categories.map((c: any) => (
                    <label key={c.id} className='flex items-center gap-1.5 text-sm cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={(formData.categories || []).includes(c.id)}
                        onChange={e => {
                          const ids = formData.categories || []
                          setFormData(p => ({ ...p, categories: e.target.checked ? [...ids, c.id] : ids.filter((id: number) => id !== c.id) }))
                        }}
                      />
                      {c.title}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            {dietTags.length > 0 && (
              <Field className='gap-2'>
                <FieldLabel>Etiquetas</FieldLabel>
                <div className='flex flex-wrap gap-2 max-h-[150px] overflow-y-auto'>
                  {dietTags.map((t: any) => (
                    <label key={t.id} className='flex items-center gap-1.5 text-sm cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={(formData.tags || []).includes(t.id)}
                        onChange={e => {
                          const ids = formData.tags || []
                          setFormData(p => ({ ...p, tags: e.target.checked ? [...ids, t.id] : ids.filter((id: number) => id !== t.id) }))
                        }}
                      />
                      {t.title}
                    </label>
                  ))}
                </div>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Guardando...' : editingRecipe ? 'Actualizar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Recipe Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar Receta</DialogTitle></DialogHeader>
          <p>¿Estás seguro? Esto también eliminará todos los ingredientes y pasos.</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Ingredients Dialog */}
      <Dialog open={ingredientDialogOpen} onOpenChange={setIngredientDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Ingredientes — {activeRecipe?.title}</DialogTitle>
          </DialogHeader>

          <div className='flex items-center justify-between mb-3'>
            <div className='text-sm text-muted-foreground'>
              Total: {Math.round(ingredients.reduce((s, i) => s + i.calories, 0))} cal
              {' | '}{Math.round(ingredients.reduce((s, i) => s + i.protein, 0))}g pro
              {' | '}{Math.round(ingredients.reduce((s, i) => s + i.fats, 0))}g grasa
              {' | '}{Math.round(ingredients.reduce((s, i) => s + i.carbs, 0))}g carb
            </div>
            <Button size='sm' onClick={openAddIngredient}><PlusIcon className='size-3 mr-1' /> Añadir</Button>
          </div>

          {ingredientsLoading ? (
            <div className='flex justify-center py-8'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
          ) : ingredients.length ? (
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingrediente</TableHead>
                    <TableHead className='text-right'>Cant.</TableHead>
                    <TableHead className='text-right'>Gramos</TableHead>
                    <TableHead className='text-right'>Cal</TableHead>
                    <TableHead className='text-right'>Pro</TableHead>
                    <TableHead className='w-[80px]'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map(ing => (
                    <TableRow key={ing.id}>
                      <TableCell className='font-medium'>{ing.ingredient_title}</TableCell>
                      <TableCell className='text-right tabular-nums'>{ing.quantity_display || ing.quantity}</TableCell>
                      <TableCell className='text-right tabular-nums'>{Math.round(ing.quantity_grams)}g</TableCell>
                      <TableCell className='text-right tabular-nums'>{Math.round(ing.calories)}</TableCell>
                      <TableCell className='text-right tabular-nums'>{Math.round(ing.protein)}g</TableCell>
                      <TableCell>
                        <div className='flex gap-1 justify-end'>
                          <Button variant='outline' size='sm' onClick={() => openEditIngredient(ing)}>
                            <PencilIcon className='size-3' />
                          </Button>
                          <Button variant='destructive' size='sm' onClick={() => handleDeleteIngredient(ing)}>
                            <TrashIcon className='size-3' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className='text-center text-muted-foreground py-8'>Aún no hay ingredientes. Añade uno para empezar.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Ingredient Form Dialog */}
      <Dialog open={ingFormOpen} onOpenChange={setIngFormOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>{editingIng ? 'Editar Ingrediente' : 'Añadir Ingrediente'}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Ingrediente</FieldLabel>
              <Select value={ingForm.ingredient_id || ''} onValueChange={v => setIngForm(p => ({ ...p, ingredient_id: v }))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar ingrediente' /></SelectTrigger>
                <SelectContent>
                  {allIngredients.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Unidad</FieldLabel>
              <Select value={ingForm.measurement_unit_id || ''} onValueChange={v => setIngForm(p => ({ ...p, measurement_unit_id: v }))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar unidad (opcional)' /></SelectTrigger>
                <SelectContent>
                  {allUnits.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.title} ({u.symbol})</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Cantidad</FieldLabel>
                <Input type='number' step='0.01' value={ingForm.quantity ?? ''} onChange={e => setIngForm(p => ({ ...p, quantity: e.target.value }))} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Gramos (ajuste manual)</FieldLabel>
                <Input type='number' step='0.01' value={ingForm.quantity_grams ?? ''} onChange={e => setIngForm(p => ({ ...p, quantity_grams: e.target.value }))} placeholder='Calculado automáticamente' />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setIngFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveIngredient} disabled={submitting}>{submitting ? 'Guardando...' : editingIng ? 'Actualizar' : 'Añadir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default RecipeView
