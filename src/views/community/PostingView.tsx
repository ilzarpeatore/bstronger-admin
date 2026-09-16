import { useState, useEffect, useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/lib/api'

const PostingView = () => {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (search) params.set('search', search)
      const res = await api.get(`/admin/postings?${params}`)
      setItems(res.data || [])
    } catch {
      toast.error('No se pudieron cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchItems() }, [fetchItems])

  const toggleStatus = async (item: any) => {
    const newStatus = item.status === 'active' ? 'inactive' : 'active'
    setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: newStatus } : p))
    try {
      await api.post(`/admin/postings/${item.id}/status`, { status: newStatus })
      toast.success('Estado actualizado')
    } catch {
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: item.status } : p))
      toast.error('No se pudo actualizar el estado')
    }
  }

  const truncate = (str: string, len = 50) => str && str.length > len ? str.slice(0, len) + '...' : str

  const columns: ColumnDef<any, any>[] = [
    { id: 'id', header: 'ID', accessorKey: 'id' },
    { id: 'user', header: 'Usuario', cell: ({ row }) => row.original.user?.name || row.original.user_id },
    {
      id: 'description',
      header: 'Descripción',
      cell: ({ row }) => truncate(row.original.description || row.original.content || ''),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === 'active' ? 'default' : 'secondary'}
          className='cursor-pointer'
          onClick={() => toggleStatus(row.original)}
        >
          {row.original.status}
        </Badge>
      ),
    },
    { id: 'created_at', header: 'Creado el', accessorKey: 'created_at' },
  ]

  return (
    <Card>
      <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <CardTitle>Publicaciones</CardTitle>
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

export default PostingView
