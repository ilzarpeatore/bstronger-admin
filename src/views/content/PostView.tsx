import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'

const PostView = () => (
  <CrudView
    title='Entradas'
    endpoint='/admin/posts'
    fields={[
      { name: 'title', label: 'Título', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'is_featured', label: 'Destacado', type: 'select', options: [{ label: 'Sí', value: '1' }, { label: 'No', value: '0' }] },
      { name: 'status', label: 'Estado', type: 'select', options: [{ label: 'Publicado', value: 'publish' }, { label: 'Borrador', value: 'draft' }] },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'title', header: 'Título', accessorKey: 'title' },
      { id: 'is_featured', header: 'Destacado', accessorKey: 'is_featured' },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => <Badge variant={row.original.status === 'publish' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
      },
    ]}
  />
)

export default PostView
