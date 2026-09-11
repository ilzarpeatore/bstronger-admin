
import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'

const SubAdminView = () => (
  <CrudView
    title='Subadministradores'
    endpoint='/admin/sub-admins'
    fields={[
      { name: 'first_name', label: 'Nombre', required: true },
      { name: 'last_name', label: 'Apellido', required: true },
      { name: 'email', label: 'Correo electrónico', type: 'email', required: true },
      { name: 'password', label: 'Contraseña', type: 'password' },
      { name: 'status', label: 'Estado', type: 'select', options: [{ label: 'Activo', value: 'active' }, { label: 'Bloqueado', value: 'banned' }] },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'first_name', header: 'Nombre', accessorKey: 'first_name' },
      { id: 'last_name', header: 'Apellido', accessorKey: 'last_name' },
      { id: 'email', header: 'Correo electrónico', accessorKey: 'email' },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
      },
    ]}
  />
)

export default SubAdminView
