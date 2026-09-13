import CrudView from '@/views/CrudView'

const DefaultKeywordView = () => (
  <CrudView
    title='Palabras clave predeterminadas'
    endpoint='/admin/default-keywords'
    fields={[
      // DefaultKeywordController valida 'screen_id' contra screens.id (el PK
      // interno), no contra el campo screenId visible en /admin/screens --
      // por eso optionValue queda en el 'id' por defecto, no un override.
      { name: 'screen_id', label: 'Pantalla', type: 'select', endpoint: '/admin/screens', optionLabel: 'screenName', required: true },
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
