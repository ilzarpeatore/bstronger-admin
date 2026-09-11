import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'

const DietView = () => (
  <CrudView
    title='Dietas'
    endpoint='/admin/diets'
    fields={[
      { name: 'title', label: 'Título', required: true },
      { name: 'slug', label: 'Slug', type: 'slug' },
      { name: 'categorydiet_id', label: 'ID de categoría de dieta', type: 'number', required: true },
      { name: 'calories', label: 'Calorías', type: 'number', required: true },
      { name: 'carbs', label: 'Carbohidratos', type: 'number' },
      { name: 'protein', label: 'Proteína', type: 'number' },
      { name: 'fat', label: 'Grasa', type: 'number' },
      { name: 'servings', label: 'Porciones', type: 'number' },
      { name: 'total_time', label: 'Tiempo total' },
      { name: 'is_featured', label: 'Destacado', type: 'select', options: [{ label: 'Sí', value: '1' }, { label: 'No', value: '0' }] },
      { name: 'is_premium', label: 'Premium', type: 'select', options: [{ label: 'Sí', value: '1' }, { label: 'No', value: '0' }] },
      { name: 'visibility', label: 'Visibilidad', type: 'select', options: [{ label: 'Todos', value: 'all' }, { label: 'Premium', value: 'premium' }] },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'status', label: 'Estado', type: 'select', options: [{ label: 'Activo', value: 'active' }, { label: 'Inactivo', value: 'inactive' }] },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'title', header: 'Título', accessorKey: 'title' },
      { id: 'categorydiet_id', header: 'Categoría', accessorKey: 'categorydiet_id' },
      { id: 'calories', header: 'Calorías', accessorKey: 'calories' },
      {
        id: 'is_premium',
        header: 'Premium',
        cell: ({ row }) => <Badge variant={row.original.is_premium === '1' || row.original.is_premium === 1 ? 'default' : 'secondary'}>{row.original.is_premium === '1' || row.original.is_premium === 1 ? 'Sí' : 'No'}</Badge>,
      },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
      },
    ]}
  />
)

export default DietView
