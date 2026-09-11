
import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'

const WorkoutView = () => (
  <CrudView
    title='Entrenamientos'
    endpoint='/admin/workouts'
    fields={[
      { name: 'title', label: 'Título', required: true },
      { name: 'slug', label: 'Slug', type: 'slug' },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'workout_type_id', label: 'ID de tipo de entrenamiento', type: 'number', required: true },
      { name: 'level_id', label: 'ID de nivel', type: 'number', required: true },
      { name: 'is_premium', label: 'Premium', type: 'select', options: [{ label: 'Sí', value: '1' }, { label: 'No', value: '0' }] },
      { name: 'visibility', label: 'Visibilidad', type: 'select', options: [{ label: 'Todos', value: 'all' }, { label: 'Premium', value: 'premium' }] },
      { name: 'status', label: 'Estado', type: 'select', options: [{ label: 'Activo', value: 'active' }, { label: 'Inactivo', value: 'inactive' }] },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'title', header: 'Título', accessorKey: 'title' },
      { id: 'workout_type_id', header: 'Tipo', accessorKey: 'workout_type_id' },
      { id: 'level_id', header: 'Nivel', accessorKey: 'level_id' },
      {
        id: 'is_premium',
        header: 'Premium',
        cell: ({ row }) => <Badge variant={row.original.is_premium === '1' || row.original.is_premium === 1 ? 'default' : 'secondary'}>{row.original.is_premium === '1' || row.original.is_premium === 1 ? 'Sí' : 'No'}</Badge>,
      },
      { id: 'visibility', header: 'Visibilidad', accessorKey: 'visibility' },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
      },
    ]}
  />
)

export default WorkoutView
