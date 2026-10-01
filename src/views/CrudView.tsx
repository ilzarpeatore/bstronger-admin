
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon, PencilIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { TableRowsSkeleton } from '@/components/shared/skeletons'

type CrudField = {
  name: string
  label: string
  // 'multiselect' (2026-09-30): lista de ids (p. ej. hábitos y recursos de un
  // pack). Pide `endpoint` tal cual, sin añadir per_page, y acepta respuesta
  // plana o paginada ({data: [...]} o {data: {data: [...]}}).
  type?: 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'email' | 'password' | 'file' | 'slug' | 'boolean'
  required?: boolean
  options?: { label: string; value: string }[]
  // Alternativa a `options` estático: carga las opciones desde un endpoint real
  // (ej. para relaciones como training_program_id/meal_plan_template_id, cuyo
  // listado de valores es dinámico, no un enum fijo). Mismo patrón que FilterConfig.
  endpoint?: string
  optionLabel?: string
  optionValue?: string
  placeholder?: string
}

type FilterConfig = {
  name: string
  label: string
  type?: 'select' | 'text'
  options?: { label: string; value: string | number }[]
  endpoint?: string
  optionLabel?: string
  optionValue?: string
}

type CrudViewProps = {
  title: string
  endpoint: string
  fields: CrudField[]
  columns: ColumnDef<any, any>[]
  paginated?: boolean
  filters?: FilterConfig[]
  // Parámetros fijos del listado (p. ej. { is_pack: '0' } en Planes): solo
  // filtran el GET, no se mandan al crear/editar.
  listParams?: Record<string, string>
}

type Pagination = {
  total_items: number
  per_page: number
  currentPage: number
  totalPages: number
}

const EMPTY_FILTERS: FilterConfig[] = []
const EMPTY_PARAMS: Record<string, string> = {}

export default function CrudView({ title, endpoint, fields, columns, paginated = false, filters = EMPTY_FILTERS, listParams = EMPTY_PARAMS }: CrudViewProps) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [filterOptions, setFilterOptions] = useState<Record<string, { label: string; value: string | number }[]>>({})
  const [fieldOptions, setFieldOptions] = useState<Record<string, { label: string; value: string | number }[]>>({})

  useEffect(() => {
    const loadFilterOptions = async () => {
      const newOptions: Record<string, { label: string; value: string | number }[]> = {}
      for (const f of filters) {
        if (f.options) {
          newOptions[f.name] = f.options
        } else if (f.endpoint) {
          try {
            const res = await api.get(`${f.endpoint}?per_page=-1`)
            const data = res.data || res
            newOptions[f.name] = Array.isArray(data)
              ? data.map((item: any) => ({
                  label: item[f.optionLabel || 'title'],
                  value: item[f.optionValue || 'id'],
                }))
              : []
          } catch { /* silently fail */ }
        }
      }
      setFilterOptions(newOptions)
    }
    if (filters.length > 0) loadFilterOptions()
  }, [filters])

  useEffect(() => {
    const loadFieldOptions = async () => {
      const newOptions: Record<string, { label: string; value: string | number }[]> = {}
      for (const f of fields) {
        if ((f.type === 'select' || f.type === 'multiselect') && f.endpoint) {
          try {
            const res = await api.get(f.type === 'multiselect' ? f.endpoint : `${f.endpoint}?per_page=-1`)
            const data = f.type === 'multiselect' ? (res.data?.data ?? res.data ?? res) : (res.data || res)
            newOptions[f.name] = Array.isArray(data)
              ? data.map((item: any) => ({
                  label: item[f.optionLabel || 'title'],
                  value: item[f.optionValue || 'id'],
                }))
              : []
          } catch { /* silently fail */ }
        }
      }
      setFieldOptions(newOptions)
    }
    if (fields.some(f => (f.type === 'select' || f.type === 'multiselect') && f.endpoint)) loadFieldOptions()
  }, [fields])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(listParams)
      if (paginated) {
        params.set('per_page', String(perPage))
        params.set('page', String(page))
      } else {
        params.set('per_page', '-1')
      }
      if (search) params.set('search', search)
      for (const f of filters) {
        if (filterValues[f.name]) params.set(f.name, filterValues[f.name])
      }
      const res = await api.get(`${endpoint}?${params}`)
      setItems(res.data || [])
      if (res.pagination) setPagination(res.pagination)
    } catch {
      toast.error('No se pudieron cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [endpoint, search, paginated, perPage, page, filterValues, filters, listParams])

  useEffect(() => { fetchItems() }, [fetchItems])

  const resetFilters = () => {
    setFilterValues({})
    setPage(1)
  }

  const openCreate = () => {
    setEditingItem(null)
    setFormData({})
    setFieldErrors({})
    setDialogOpen(true)
  }

  const openEdit = useCallback((item: any) => {
    setEditingItem(item)
    const data: Record<string, any> = {}
    fields.forEach(f => {
      data[f.name] = f.type === 'boolean' ? !!item[f.name] : f.type === 'multiselect' ? (item[f.name] ?? []) : (item[f.name] ?? '')
    })
    setFormData(data)
    setFieldErrors({})
    setDialogOpen(true)
  }, [fields])

  const handleSubmit = async () => {
    // FIX (auditoría 2026-09-13): `required` en CrudField era solo
    // cosmético -- no bloqueaba nada, se podía enviar el formulario con
    // campos obligatorios vacíos y dejar que Laravel lo rechazara (o, peor,
    // que lo aceptara si el backend no validaba ese campo).
    const missing: Record<string, string> = {}
    for (const f of fields) {
      if (f.required && (formData[f.name] === '' || formData[f.name] == null)) {
        missing[f.name] = `${f.label} es obligatorio`
      }
    }
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing)
      toast.error('Revisa los campos obligatorios')
      return
    }

    setFieldErrors({})
    setSubmitting(true)
    try {
      // Los selects opcionales (ej. relaciones nullable como training_program_id)
      // parten de '' cuando no hay valor elegido — un '' literal rompe la
      // validación `nullable|exists:...` de Laravel, así que se omite la clave
      // en vez de mandar un string vacío.
      const payload = { ...formData }
      for (const f of fields) {
        if (f.type === 'select' && payload[f.name] === '') {
          delete payload[f.name]
        }
      }
      if (editingItem) {
        await api.put(`${endpoint}/${editingItem.id}`, payload)
        toast.success('Actualizado correctamente')
      } else {
        await api.post(endpoint, payload)
        toast.success('Creado correctamente')
      }
      setDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      // FIX (auditoría 2026-09-13): un 422 de Laravel trae { errors: { campo:
      // [mensaje] } } -- antes se ignoraba del todo y solo se mostraba un
      // toast genérico, sin decir qué campo falló.
      const errors = err?.data?.errors
      if (errors && typeof errors === 'object') {
        const perField: Record<string, string> = {}
        for (const key of Object.keys(errors)) {
          const msg = Array.isArray(errors[key]) ? errors[key][0] : errors[key]
          if (msg) perField[key] = String(msg)
        }
        setFieldErrors(perField)
        toast.error('La operación no se pudo completar -- revisa los campos marcados')
      } else {
        toast.error(err?.message || 'La operación no se pudo completar')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    setDeleting(true)
    try {
      await api.delete(`${endpoint}/${deletingItem.id}`)
      toast.success('Eliminado correctamente')
      setDeleteDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const allColumns = useMemo<ColumnDef<any, any>[]>(() => [
    ...columns,
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => openEdit(row.original)} aria-label='Editar'>
            <PencilIcon className='size-4' />
          </Button>
          <Button variant='destructive' size='sm' onClick={() => { setDeletingItem(row.original); setDeleteDialogOpen(true) }} aria-label='Eliminar'>
            <TrashIcon className='size-4' />
          </Button>
        </div>
      )
    }
  ], [columns, openEdit])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleFilterChange = (name: string, value: string) => {
    setFilterValues(prev => {
      const next = { ...prev }
      if (value) next[name] = value
      else delete next[name]
      return next
    })
    setPage(1)
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <CardTitle>{title}</CardTitle>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
            <Input placeholder='Buscar...' value={search} onChange={e => handleSearch(e.target.value)} className='w-full sm:w-64' />
            <Button onClick={openCreate}>
              <PlusIcon className='size-4 mr-2' /> Añadir nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filters.length > 0 && (
            <div className='flex flex-wrap gap-3 mb-4 p-3 bg-muted/50 rounded-md'>
              {filters.map(f => (
                <div key={f.name} className='flex flex-col gap-1'>
                  <label className='text-xs font-medium text-muted-foreground'>{f.label}</label>
                  {f.type === 'text' ? (
                    <Input
                      placeholder={f.label}
                      value={filterValues[f.name] || ''}
                      onChange={e => handleFilterChange(f.name, e.target.value)}
                      className='w-48 h-8 text-sm'
                    />
                  ) : (
                    <Select
                      value={filterValues[f.name] ?? ''}
                      onValueChange={v => handleFilterChange(f.name, v ?? '')}
                    >
                      <SelectTrigger className='w-48 h-8 text-sm'>
                        <SelectValue placeholder={`Todos los ${f.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {(filterOptions[f.name] || []).map(opt => (
                          <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
              {Object.keys(filterValues).length > 0 && (
                <div className='flex items-end'>
                  <Button variant='destructive' size='sm' onClick={resetFilters}>Restablecer</Button>
                </div>
              )}
            </div>
          )}
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  {allColumns.map(col => (
                    <TableHead key={col.id}>{typeof col.header === 'string' ? col.header : ''}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRowsSkeleton rows={5} columns={allColumns.length} />
                ) : items.length ? (
                  items.map((item, i) => (
                    <TableRow key={item.id ?? i}>
                      {allColumns.map(col => (
                        <TableCell key={col.id}>
                          {col.id === 'actions'
                            ? (col.cell as any)({ row: { original: item } })
                            : (col as any).accessorFn
                              ? (col as any).accessorFn(item, i)
                              : item[col.id as string]
                          }
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={allColumns.length} className='h-24 text-center'>Sin resultados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {paginated && pagination && (
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4'>
              <div className='flex items-center gap-2'>
                <span className='text-sm text-muted-foreground'>
                  Mostrando {((pagination.currentPage - 1) * pagination.per_page) + 1} a{' '}
                  {Math.min(pagination.currentPage * pagination.per_page, pagination.total_items)} de{' '}
                  {pagination.total_items.toLocaleString()} registros
                </span>
              </div>
              <div className='flex items-center gap-2 flex-wrap'>
                <Select value={String(perPage)} onValueChange={v => { setPerPage(Number(v)); setPage(1) }}>
                  <SelectTrigger className='w-20 h-8'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100, 250].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeftIcon className='size-4' />
                </Button>
                <span className='text-sm font-medium'>
                  Página {pagination.currentPage} de {pagination.totalPages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRightIcon className='size-4' />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingItem ? `Editar ${title}` : `Crear ${title}`}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            {fields.map(field => (
              <Field key={field.name} className='gap-2'>
                <FieldLabel>{field.label}</FieldLabel>
                {field.type === 'boolean' ? (
                  <Switch
                    checked={!!formData[field.name]}
                    onCheckedChange={v => setFormData(prev => ({ ...prev, [field.name]: v }))}
                  />
                ) : field.type === 'multiselect' ? (
                  <div className='flex max-h-44 flex-col gap-1.5 overflow-y-auto rounded-md border p-2'>
                    {(field.options ?? fieldOptions[field.name] ?? []).length === 0 && (
                      <span className='text-muted-foreground text-sm'>{field.placeholder || 'Sin opciones'}</span>
                    )}
                    {(field.options ?? fieldOptions[field.name] ?? []).map(opt => {
                      const selected: (string | number)[] = Array.isArray(formData[field.name]) ? formData[field.name] : []
                      const checked = selected.some(v => String(v) === String(opt.value))
                      return (
                        <label key={opt.value} className='flex items-center gap-2 text-sm'>
                          <input
                            type='checkbox'
                            checked={checked}
                            onChange={e => setFormData(prev => {
                              const current: (string | number)[] = Array.isArray(prev[field.name]) ? prev[field.name] : []
                              const next = e.target.checked
                                ? [...current, opt.value]
                                : current.filter(v => String(v) !== String(opt.value))
                              return { ...prev, [field.name]: next }
                            })}
                          />
                          {opt.label}
                        </label>
                      )
                    })}
                  </div>
                ) : field.type === 'select' ? (
                  <Select
                    value={formData[field.name] || ''}
                    onValueChange={v => setFormData(prev => ({ ...prev, [field.name]: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder || `Seleccionar ${field.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {!field.required && (
                        <SelectItem value='__none__'>— Ninguno —</SelectItem>
                      )}
                      {(field.options ?? fieldOptions[field.name] ?? []).map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2'
                    value={formData[field.name] || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <Input
                    type={field.type || 'text'}
                    value={formData[field.name] || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                )}
                {fieldErrors[field.name] && <FieldError>{fieldErrors[field.name]}</FieldError>}
              </Field>
            ))}
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : editingItem ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar {title}</DialogTitle>
          </DialogHeader>
          <p>¿Estás seguro de que quieres eliminar este elemento? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
