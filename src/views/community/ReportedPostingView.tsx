import { useState, useEffect, useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { TrashIcon, BanIcon, CheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

const ReportedPostingView = () => {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actingId, setActingId] = useState<number | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (search) params.set('search', search)
      const res = await api.get(`/admin/reported-postings?${params}`)
      setItems(res.data || [])
    } catch {
      toast.error('No se pudieron cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchItems() }, [fetchItems])

  // FIX (auditoría 2026-09-13): esta vista solo listaba, sin ninguna acción
  // de moderación -- el backend ya tenía admin-posting-delete y
  // postings/{id}/status, no estaban conectados.
  const handleSetStatus = async (item: any, status: 'active' | 'inactive' | 'banned') => {
    setActingId(item.id)
    try {
      await api.post(`/admin/postings/${item.id}/status`, { status })
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status } : p))
      toast.success(status === 'active' ? 'Publicación restaurada' : status === 'banned' ? 'Publicación baneada' : 'Publicación desactivada')
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo actualizar el estado')
    } finally {
      setActingId(null)
    }
  }

  const handleDelete = async (item: any) => {
    if (!confirm(`¿Eliminar definitivamente esta publicación (ID ${item.id})? Esta acción no se puede deshacer.`)) return
    setActingId(item.id)
    try {
      await api.post('/admin/admin-posting-delete', { id: item.id })
      setItems(prev => prev.filter(p => p.id !== item.id))
      toast.success('Publicación eliminada')
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo eliminar la publicación')
    } finally {
      setActingId(null)
    }
  }

  const truncate = (str: string, len = 50) => str && str.length > len ? str.slice(0, len) + '...' : str

  const columns: ColumnDef<any, any>[] = [
    { id: 'id', header: 'ID', accessorKey: 'id' },
    { id: 'user', header: 'Usuario', cell: ({ row }) => row.original.user?.name || row.original.user_id },
    {
      id: 'description',
      header: 'Descripción',
      cell: ({ row }) => truncate(row.original.description || row.original.posting?.description || ''),
    },
    {
      id: 'reports_count',
      header: 'Número de reportes',
      cell: ({ row }) => row.original.reports_count ?? row.original.reports?.length ?? 0,
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const item = row.original
        const busy = actingId === item.id
        return (
          <div className='flex gap-1.5'>
            {item.status !== 'active' && (
              <Button variant='outline' size='sm' disabled={busy} onClick={() => handleSetStatus(item, 'active')} title='Descartar reporte y restaurar la publicación'>
                <CheckIcon className='size-3.5' />
              </Button>
            )}
            {item.status !== 'banned' && (
              <Button variant='outline' size='sm' disabled={busy} onClick={() => handleSetStatus(item, 'banned')} title='Banear publicación (ocultar sin borrar)'>
                <BanIcon className='size-3.5' />
              </Button>
            )}
            <Button variant='destructive' size='sm' disabled={busy} onClick={() => handleDelete(item)} title='Eliminar publicación permanentemente'>
              <TrashIcon className='size-3.5' />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <Card>
      <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <CardTitle>Publicaciones reportadas</CardTitle>
        <Input placeholder='Buscar...' value={search} onChange={e => setSearch(e.target.value)} className='w-full sm:w-64' />
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
                        {(col as any).accessorFn
                          ? (col as any).accessorFn(item, i)
                          : col.cell
                            ? (col.cell as any)({ row: { original: item } })
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
  )
}

export default ReportedPostingView
