
import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'

const EquipmentView = () => (
  <CrudView
    title='Equipo'
    endpoint='/admin/equipment'
    fields={[
      { name: 'title', label: 'Título', required: true },
      { name: 'status', label: 'Estado', type: 'select', options: [{ label: 'Activo', value: 'active' }, { label: 'Inactivo', value: 'inactive' }] },
      // FIX (auditoría 2026-09-13): load_type (añadido esta sesión para el
      // redondeo de carga del motor de auto-regulación) no se podía
      // clasificar desde el panel -- un equipo nuevo quedaba sin tipo y
      // caía al RoundingMode genérico de la regla en vez del redondeo real.
      {
        name: 'load_type',
        label: 'Tipo de carga',
        type: 'select',
        options: [
          { label: 'Discos / máquina (1.25kg)', value: 'plate' },
          { label: 'Mancuernas (1kg / 2.5kg)', value: 'dumbbell' },
          { label: 'Sin carga variable', value: 'fixed' },
        ],
      },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'title', header: 'Título', accessorKey: 'title' },
      { id: 'load_type', header: 'Tipo de carga', accessorKey: 'load_type' },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
      },
    ]}
  />
)

export default EquipmentView
