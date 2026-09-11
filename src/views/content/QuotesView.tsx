import CrudView from '@/views/CrudView'

const QuotesView = () => (
  <CrudView
    title='Frases'
    endpoint='/admin/quotes'
    fields={[
      { name: 'title', label: 'Título', required: true },
      { name: 'message', label: 'Mensaje', type: 'textarea', required: true },
      { name: 'date', label: 'Fecha' },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'title', header: 'Título', accessorKey: 'title' },
      { id: 'message', header: 'Mensaje', accessorKey: 'message' },
      { id: 'date', header: 'Fecha', accessorKey: 'date' },
    ]}
  />
)

export default QuotesView
