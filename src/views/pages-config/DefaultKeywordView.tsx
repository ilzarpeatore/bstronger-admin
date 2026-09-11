import CrudView from '@/views/CrudView'

const DefaultKeywordView = () => (
  <CrudView
    title='Palabras clave predeterminadas'
    endpoint='/admin/default-keywords'
    fields={[
      { name: 'screen_id', label: 'ID de pantalla', required: true },
      { name: 'keyword_id', label: 'ID de palabra clave', required: true },
      { name: 'keyword_name', label: 'Nombre de la palabra clave', required: true },
      { name: 'keyword_value', label: 'Valor de la palabra clave', required: true },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'screen_id', header: 'ID de pantalla', accessorKey: 'screen_id' },
      { id: 'keyword_name', header: 'Nombre de la palabra clave', accessorKey: 'keyword_name' },
      { id: 'keyword_value', header: 'Valor de la palabra clave', accessorKey: 'keyword_value' },
    ]}
  />
)

export default DefaultKeywordView
