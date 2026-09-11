import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'

const LanguageView = () => (
  <CrudView
    title='Idiomas'
    endpoint='/admin/languages'
    fields={[
      { name: 'language_id', label: 'ID de idioma', required: true },
      { name: 'language_name', label: 'Nombre del idioma', required: true },
      { name: 'language_code', label: 'Código del idioma', required: true },
      { name: 'country_code', label: 'Código de país', required: true },
      { name: 'status', label: 'Estado', type: 'select', options: [{ label: 'Activo', value: 'active' }, { label: 'Inactivo', value: 'inactive' }] },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'language_name', header: 'Nombre del idioma', accessorKey: 'language_name' },
      { id: 'language_code', header: 'Código del idioma', accessorKey: 'language_code' },
      { id: 'country_code', header: 'Código de país', accessorKey: 'country_code' },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
      },
    ]}
  />
)

export default LanguageView
