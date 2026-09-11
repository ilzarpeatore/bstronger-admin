import CrudView from '@/views/CrudView'

const ScreenView = () => (
  <CrudView
    title='Pantallas'
    endpoint='/admin/screens'
    fields={[
      { name: 'screenId', label: 'ID de pantalla', required: true },
      { name: 'screenName', label: 'Nombre de pantalla', required: true },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'screenId', header: 'ID de pantalla', accessorKey: 'screenId' },
      { id: 'screenName', header: 'Nombre de pantalla', accessorKey: 'screenName' },
    ]}
  />
)

export default ScreenView
