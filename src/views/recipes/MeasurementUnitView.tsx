import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'

const MeasurementUnitView = () => (
  <CrudView
    title='Unidades de medida'
    endpoint='/admin/measurement-units'
    fields={[
      { name: 'title', label: 'Título', required: true },
      { name: 'symbol', label: 'Símbolo', required: true },
      { name: 'unit_type', label: 'Tipo de unidad', type: 'select', required: true, options: [{ label: 'Peso', value: 'weight' }, { label: 'Volumen', value: 'volume' }, { label: 'Unidades', value: 'count' }] },
      { name: 'base_conversion_factor', label: 'Factor de conversión base', type: 'number', required: true },
      { name: 'status', label: 'Estado', type: 'select', options: [{ label: 'Activo', value: 'active' }, { label: 'Inactivo', value: 'inactive' }] },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'title', header: 'Título', accessorKey: 'title' },
      { id: 'symbol', header: 'Símbolo', accessorKey: 'symbol' },
      { id: 'unit_type', header: 'Tipo de unidad', accessorKey: 'unit_type' },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
      },
    ]}
  />
)

export default MeasurementUnitView
