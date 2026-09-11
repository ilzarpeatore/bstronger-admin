
import CrudView from '@/views/CrudView'

const RolesView = () => (
  <CrudView
    title='Roles'
    endpoint='/admin/roles'
    fields={[
      { name: 'name', label: 'Nombre del rol', required: true },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'name', header: 'Nombre del rol', accessorKey: 'name' },
    ]}
  />
)

export default RolesView
