import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'

const ProductView = () => (
  <CrudView
    title='Productos'
    endpoint='/admin/products'
    fields={[
      { name: 'title', label: 'Título', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'price', label: 'Precio', type: 'number' },
      { name: 'affiliate_link', label: 'Enlace de afiliado' },
      { name: 'status', label: 'Estado', type: 'select', options: [{ label: 'Activo', value: 'active' }, { label: 'Inactivo', value: 'inactive' }] },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'title', header: 'Título', accessorKey: 'title' },
      { id: 'price', header: 'Precio', accessorKey: 'price' },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
      },
    ]}
  />
)

export default ProductView
