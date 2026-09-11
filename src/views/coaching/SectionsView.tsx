import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PlusIcon, TrashIcon, ArrowLeftIcon, SaveIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type SectionExercise = {
  id: number
  exercise_id: number
  exercise?: { id: number; title: string }
  prescribed: Record<string, any> | null
  enabled_metrics: Record<string, boolean> | null
  order: number | null
}

type Section = {
  id: number
  title: string
  instructions: string | null
  exercises?: SectionExercise[]
}

type Exercise = {
  id: number
  title: string
}

const PRESCRIBED_FIELDS = [
  { key: 'sets', label: 'Series' },
  { key: 'reps_min', label: 'Reps mín' },
  { key: 'reps_max', label: 'Reps máx' },
  { key: 'weight', label: 'Peso (kg)' },
  { key: 'rest_seconds', label: 'Descanso (s)' },
  { key: 'rpe', label: 'RPE' },
]

export default function SectionsView() {
  const navigate = useNavigate()
  const params = useParams()
  const view = params.id ? 'detail' : 'list'
  const sectionId = params.id ? Number(params.id) : null
  const [items, setItems] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<Section | null>(null)
  const [editingItem, setEditingItem] = useState<Section | null>(null)
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [selectedSection, setSelectedSection] = useState<Section | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [exercises, setExercises] = useState<SectionExercise[]>([])
  const [exerciseList, setExerciseList] = useState<Exercise[]>([])
  const [addExerciseDialogOpen, setAddExerciseDialogOpen] = useState(false)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [exerciseSearch, setExerciseSearch] = useState('')

  const sortedExercises = useMemo(
    () => [...exercises].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [exercises]
  )

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (search) params.set('search', search)
      const res = await api.get(`/admin/section-template-list?${params}`)
      setItems(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar las secciones')
    } finally {
      setLoading(false)
    }
  }, [search])

  const fetchExercises = useCallback(async () => {
    try {
      const res = await api.get('/admin/exercises?per_page=500')
      const data = res.data?.data || res.data || []
      setExerciseList(data.map((e: any) => ({ id: e.id, title: e.title })))
    } catch {
      toast.error('Error al cargar los ejercicios')
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openCreate = () => {
    setEditingItem(null)
    setTitle('')
    setInstructions('')
    setDialogOpen(true)
  }

  const openEdit = (item: Section) => {
    setEditingItem(item)
    setTitle(item.title)
    setInstructions(item.instructions || '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!title.trim()) { toast.error('El título es obligatorio'); return }
    setSubmitting(true)
    try {
      if (editingItem) {
        await api.post('/admin/section-template-update', { id: editingItem.id, title, instructions })
        toast.success('Sección actualizada')
      } else {
        await api.post('/admin/section-template-store', { title, instructions })
        toast.success('Sección creada')
      }
      setDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    try {
      await api.post('/admin/section-template-delete', { id: deletingItem.id })
      toast.success('Sección eliminada')
      setDeleteDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar')
    }
  }

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await api.get(`/admin/section-template-detail?id=${id}`)
      const detail = res.data || res
      setSelectedSection(detail)
      setExercises(detail.exercises || [])
      fetchExercises()
    } catch {
      toast.error('Error al cargar el detalle de la sección')
    } finally {
      setDetailLoading(false)
    }
  }, [fetchExercises])

  const openDetail = (item: Section) => {
    navigate(`/section-templates/${item.id}`)
  }

  useEffect(() => {
    if (sectionId === null) {
      setSelectedSection(null)
      setExercises([])
      setDetailLoading(false)
      return
    }
    loadDetail(sectionId)
  }, [sectionId, loadDetail])

  const handleAddExercise = async () => {
    if (!selectedSection || !selectedExerciseId) return
    try {
      await api.post('/admin/section-template-exercise-save', {
        section_template_id: selectedSection.id,
        exercise_id: Number(selectedExerciseId),
        prescribed: {},
        enabled_metrics: {}
      })
      toast.success('Ejercicio añadido')
      setAddExerciseDialogOpen(false)
      setSelectedExerciseId('')
      loadDetail(selectedSection.id)
    } catch (err: any) {
      toast.error(err?.message || 'Error al añadir el ejercicio')
    }
  }

  const handleUpdateField = async (exercise: SectionExercise, field: string, value: string) => {
    try {
      await api.post('/admin/section-template-exercise-update-field', {
        id: exercise.id,
        field,
        value: value || null
      })
      setExercises(prev => prev.map(e =>
        e.id === exercise.id
          ? { ...e, prescribed: { ...e.prescribed, [field]: value || null } }
          : e
      ))
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar')
    }
  }

  const handleDeleteExercise = async (exercise: SectionExercise) => {
    if (!selectedSection) return
    try {
      await api.post('/admin/section-template-exercise-delete', { id: exercise.id })
      toast.success('Ejercicio eliminado')
      loadDetail(selectedSection.id)
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar el ejercicio')
    }
  }

  if (view === 'detail') {
    if (detailLoading || !selectedSection) {
      return (
        <Card>
          <CardContent className='flex items-center justify-center h-[300px]'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
          </CardContent>
        </Card>
      )
    }
    return (
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Button variant='ghost' size='sm' onClick={() => navigate('/section-templates')}>
              <ArrowLeftIcon className='size-4 mr-1' /> Volver
            </Button>
            <CardTitle>{selectedSection.title}</CardTitle>
            {selectedSection.instructions && (
              <Badge variant='secondary'>{selectedSection.instructions}</Badge>
            )}
          </div>
          <Button onClick={() => { fetchExercises(); setAddExerciseDialogOpen(true) }}>
            <PlusIcon className='size-4 mr-2' /> Añadir ejercicio
          </Button>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[60px]'>#</TableHead>
                  <TableHead>Ejercicio</TableHead>
                  {PRESCRIBED_FIELDS.map(f => (
                    <TableHead key={f.key}>{f.label}</TableHead>
                  ))}
                  <TableHead className='w-[60px]'></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exercises.length ? sortedExercises.map((ex, i) => (
                  <TableRow key={ex.id}>
                    <TableCell className='font-medium text-muted-foreground'>{i + 1}</TableCell>
                    <TableCell className='font-medium'>{ex.exercise?.title || `Ejercicio #${ex.exercise_id}`}</TableCell>
                    {PRESCRIBED_FIELDS.map(f => (
                      <TableCell key={f.key}>
                        <Input
                          className='h-8 w-20'
                          value={ex.prescribed?.[f.key] ?? ''}
                          onBlur={e => handleUpdateField(ex, f.key, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          placeholder='—'
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button variant='ghost' size='sm' onClick={() => handleDeleteExercise(ex)}>
                        <TrashIcon className='size-3 text-destructive' />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={PRESCRIBED_FIELDS.length + 3} className='h-24 text-center'>
                      No hay ejercicios. Haz clic en "Añadir ejercicio" para empezar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Dialog open={addExerciseDialogOpen} onOpenChange={setAddExerciseDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Añadir ejercicio</DialogTitle></DialogHeader>
              <Field className='gap-2'>
                <FieldLabel>Buscar ejercicios</FieldLabel>
                <Input
                  placeholder='Escribe para buscar...'
                  value={exerciseSearch}
                  onChange={e => { setExerciseSearch(e.target.value); setSelectedExerciseId('') }}
                />
                <div className='max-h-60 overflow-y-auto rounded-md border'>
                  {exerciseList
                    .filter(e => !exerciseSearch || e.title.toLowerCase().includes(exerciseSearch.toLowerCase()))
                    .slice(0, 50)
                    .map(e => (
                      <div
                        key={e.id}
                        className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-muted ${selectedExerciseId === String(e.id) ? 'bg-muted font-medium' : ''}`}
                        onClick={() => { setSelectedExerciseId(String(e.id)); setExerciseSearch(e.title) }}
                      >
                        {e.title}
                      </div>
                    ))}
                  {exerciseList.filter(e => !exerciseSearch || e.title.toLowerCase().includes(exerciseSearch.toLowerCase())).length === 0 && (
                    <p className='px-3 py-2 text-sm text-muted-foreground'>No se encontraron ejercicios</p>
                  )}
                </div>
              </Field>
              <DialogFooter>
                <Button variant='outline' onClick={() => setAddExerciseDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddExercise} disabled={!selectedExerciseId}>Añadir</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Plantillas de secciones</CardTitle>
          <div className='flex items-center gap-2'>
            <Input placeholder='Buscar secciones...' value={search} onChange={e => setSearch(e.target.value)} className='w-64' />
            <Button onClick={openCreate}><PlusIcon className='size-4 mr-2' /> Nueva sección</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[60px]'>ID</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Instrucciones</TableHead>
                  <TableHead>Ejercicios</TableHead>
                  <TableHead className='w-[120px]'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className='h-24 text-center'>
                      <div className='flex justify-center'>
                        <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map(item => (
                    <TableRow key={item.id} className='cursor-pointer hover:bg-muted/50' onClick={() => openDetail(item)}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell className='font-medium'>{item.title}</TableCell>
                      <TableCell className='text-muted-foreground truncate max-w-[300px]'>{item.instructions || '—'}</TableCell>
                      <TableCell><Badge variant='outline'>{item.exercises?.length ?? 0}</Badge></TableCell>
                      <TableCell>
                        <div className='flex gap-2' onClick={e => e.stopPropagation()}>
                          <Button variant='outline' size='sm' onClick={() => openEdit(item)}>
                            <SaveIcon className='size-3' />
                          </Button>
                          <Button variant='destructive' size='sm' onClick={() => { setDeletingItem(item); setDeleteDialogOpen(true) }}>
                            <TrashIcon className='size-3' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className='h-24 text-center'>No se encontraron secciones.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar sección' : 'Nueva sección'}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Título</FieldLabel>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder='Título de la sección' />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Instrucciones</FieldLabel>
              <textarea
                className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2'
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder='Instrucciones opcionales'
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? 'Guardando...' : editingItem ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar sección</DialogTitle></DialogHeader>
          <p>¿Seguro que quieres eliminar esta sección y todos sus ejercicios?</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
