import CrudView from '@/views/CrudView'

const PushNotificationView = () => (
  <CrudView
    title='Notificaciones push'
    endpoint='/admin/push-notifications'
    fields={[
      { name: 'title', label: 'Título', required: true },
      { name: 'message', label: 'Mensaje', type: 'textarea', required: true },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'title', header: 'Título', accessorKey: 'title' },
      { id: 'message', header: 'Mensaje', accessorKey: 'message' },
    ]}
  />
)

export default PushNotificationView
