
import CrudView from '@/views/CrudView'

const ClassScheduleView = () => (
  <CrudView
    title='Horarios de clases'
    endpoint='/admin/class-schedules'
    fields={[
      { name: 'class_name', label: 'Nombre de la clase', required: true },
      { name: 'workout_title', label: 'Título del entrenamiento' },
      { name: 'start_date', label: 'Fecha de inicio', type: 'text', required: true },
      { name: 'end_date', label: 'Fecha de fin', type: 'text', required: true },
      { name: 'start_time', label: 'Hora de inicio', type: 'text', required: true },
      { name: 'end_time', label: 'Hora de fin', type: 'text', required: true },
      { name: 'is_paid', label: 'Es de pago', type: 'select', options: [{ label: 'Sí', value: '1' }, { label: 'No', value: '0' }] },
      { name: 'price', label: 'Precio', type: 'number' },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'class_name', header: 'Nombre de la clase', accessorKey: 'class_name' },
      { id: 'start_date', header: 'Fecha de inicio', accessorKey: 'start_date' },
      { id: 'end_date', header: 'Fecha de fin', accessorKey: 'end_date' },
      { id: 'start_time', header: 'Hora de inicio', accessorKey: 'start_time' },
      { id: 'end_time', header: 'Hora de fin', accessorKey: 'end_time' },
      { id: 'price', header: 'Precio', accessorKey: 'price' },
    ]}
  />
)

export default ClassScheduleView
