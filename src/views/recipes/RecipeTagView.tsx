import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'

const RecipeTagView = () => (
  <CrudView
    title='Etiquetas de recetas'
    endpoint='/admin/recipe-tags'
    fields={[
      { name: 'title', label: 'Título', required: true },
      { name: 'status', label: 'Estado', type: 'select', options: [{ label: 'Activo', value: 'active' }, { label: 'Inactivo', value: 'inactive' }] },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'title', header: 'Título', accessorKey: 'title' },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
      },
    ]}
  />
)

export default RecipeTagView
