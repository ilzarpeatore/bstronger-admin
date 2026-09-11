import CrudView from '@/views/CrudView'

const ProductCategoryView = () => (
  <CrudView
    title='Categorías de productos'
    endpoint='/admin/product-categories'
    fields={[
      { name: 'title', label: 'Título', required: true },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'title', header: 'Título', accessorKey: 'title' },
    ]}
  />
)

export default ProductCategoryView
