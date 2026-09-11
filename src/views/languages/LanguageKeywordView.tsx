import { useState, useEffect, useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon, PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { api } from '@/lib/api'

const LanguageKeywordView = () => {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (search) params.set('search', search)
      const res = await api.get(`/admin/language-keywords?${params}`)
      setItems(res.data || [])
    } catch {
      toast.error('No se pudieron cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openCreate = () => {
    setEditingItem(null)
    setFormData({})
    setDialogOpen(true)
  }

  const openEdit = (item: any) => {
    setEditingItem(item)
    setFormData({
      language_id: item.language_id ?? '',
      keyword_id: item.keyword_id ?? '',
      screen_id: item.screen_id ?? '',
      keyword_value: item.keyword_value ?? '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await api.post('/admin/language-keywords/bulk-update', { keywords: [formData] })
      toast.success(editingItem ? 'Actualizado correctamente' : 'Creado correctamente')
      setDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Operación fallida')
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<any, any>[] = [
    { id: 'id', header: 'ID', accessorKey: 'id' },
    { id: 'language_id', header: 'Idioma', accessorKey: 'language_id' },
    { id: 'keyword_id', header: 'Palabra clave', accessorKey: 'keyword_id' },
    { id: 'screen_id', header: 'Pantalla', accessorKey: 'screen_id' },
    { id: 'keyword_value', header: 'Valor', accessorKey: 'keyword_value' },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <Button variant='outline' size='sm' onClick={() => openEdit(row.original)}>
          <PencilIcon className='size-4' />
        </Button>
      ),
    },
  ]

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Palabras clave del idioma</CardTitle>
          <div className='flex items-center gap-2'>
            <Input placeholder='Buscar...' value={search} onChange={e => setSearch(e.target.value)} className='w-64' />
            <Button onClick={openCreate}>
              <PlusIcon className='size-4 mr-2' /> Añadir nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => (
                    <TableHead key={col.id}>{typeof col.header === 'string' ? col.header : ''}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className='h-24 text-center'>
                      <div className='flex justify-center'>
                        <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((item, i) => (
                    <TableRow key={item.id ?? i}>
                      {columns.map(col => (
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
                    <TableCell colSpan={columns.length} className='h-24 text-center'>Sin resultados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar palabra clave del idioma' : 'Crear palabra clave del idioma'}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>ID de idioma</FieldLabel>
              <Input type='number' value={formData.language_id || ''} onChange={e => setFormData(prev => ({ ...prev, language_id: e.target.value }))} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>ID de palabra clave</FieldLabel>
              <Input type='number' value={formData.keyword_id || ''} onChange={e => setFormData(prev => ({ ...prev, keyword_id: e.target.value }))} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>ID de pantalla</FieldLabel>
              <Input type='number' value={formData.screen_id || ''} onChange={e => setFormData(prev => ({ ...prev, screen_id: e.target.value }))} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Valor de la palabra clave</FieldLabel>
              <Input value={formData.keyword_value || ''} onChange={e => setFormData(prev => ({ ...prev, keyword_value: e.target.value }))} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : editingItem ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default LanguageKeywordView
