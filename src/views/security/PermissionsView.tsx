import CrudView from '@/views/CrudView'

// FIX (auditoría 2026-09-13): era de solo lectura aunque el backend ya
// soporta crear/borrar permisos (POST/DELETE /admin/permissions).
const PermissionsView = () => (
  <CrudView
    title='Permisos'
    endpoint='/admin/permissions'
    fields={[
      { name: 'name', label: 'Nombre del permiso', required: true, placeholder: 'ej. clients.view' },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'name', header: 'Nombre', accessorKey: 'name' },
      { id: 'guard_name', header: 'Guard', accessorKey: 'guard_name' },
    ]}
  />
)

export default PermissionsView
