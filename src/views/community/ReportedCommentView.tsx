import { useState, useEffect, useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrashIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

// Mismo patrón que ReportedPostingView.tsx -- item 11 del roadmap (ver
// docs/PENDIENTE_BACKEND_ADMIN.md en el repo bsa). A diferencia de Posting,
// Comment no tiene columna `status` (sin active/inactive/banned) -- la
// única acción de moderación real que expone el backend es borrar
// (Admin\PostingController::destroyComment(), ya existía desde antes de
// esta ronda, solo faltaba esta pantalla para llegar a él desde comentarios
// reportados en vez de por ID a mano).
const ReportedCommentView = () => {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/reported-comments?per_page=100')
      setItems(res.data || [])
    } catch {
      toast.error('No se pudieron cargar los comentarios reportados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleDelete = async (item: any) => {
    if (!confirm(`¿Eliminar definitivamente este comentario (ID ${item.id})? Esta acción no se puede deshacer.`)) return
    setActingId(item.id)
    try {
      await api.post(`/admin/postings/comments/${item.id}`, {})
      setItems(prev => prev.filter(c => c.id !== item.id))
      toast.success('Comentario eliminado')
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo eliminar el comentario')
    } finally {
      setActingId(null)
    }
  }

  const truncate = (str: string, len = 60) => (str && str.length > len ? str.slice(0, len) + '...' : str)

  const columns: ColumnDef<any, any>[] = [
    { id: 'id', header: 'ID', accessorKey: 'id' },
    { id: 'user', header: 'Autor', cell: ({ row }) => row.original.users?.first_name || row.original.user_id },
    { id: 'comment', header: 'Comentario', cell: ({ row }) => truncate(row.original.comment || '') },
    { id: 'posting_id', header: 'Post', accessorKey: 'posting_id' },
    { id: 'created_at', header: 'Fecha', accessorKey: 'created_at' },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const item = row.original
        const busy = actingId === item.id
        return (
          <Button variant='destructive' size='sm' disabled={busy} onClick={() => handleDelete(item)} title='Eliminar comentario permanentemente'>
            <TrashIcon className='size-3.5' />
          </Button>
        )
      },
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comentarios reportados</CardTitle>
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

export default ReportedCommentView
