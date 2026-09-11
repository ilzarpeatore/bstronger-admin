import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'

const IngredientView = () => (
  <CrudView
    title='Ingredientes'
    endpoint='/admin/ingredients'
    fields={[
      { name: 'title', label: 'Título', required: true },
      { name: 'slug', label: 'Slug', type: 'slug' },
      { name: 'ingredient_category_id', label: 'ID de categoría', type: 'number', required: true },
      { name: 'calories_per_gram', label: 'Calorías por gramo', type: 'number' },
      { name: 'protein_per_gram', label: 'Proteína por gramo', type: 'number' },
      { name: 'fat_per_gram', label: 'Grasa por gramo', type: 'number' },
      { name: 'carbs_per_gram', label: 'Carbohidratos por gramo', type: 'number' },
      { name: 'density', label: 'Densidad', type: 'number' },
      { name: 'status', label: 'Estado', type: 'select', options: [{ label: 'Activo', value: 'active' }, { label: 'Inactivo', value: 'inactive' }] },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'title', header: 'Título', accessorKey: 'title' },
      { id: 'ingredient_category_id', header: 'Categoría', accessorKey: 'ingredient_category_id' },
      { id: 'calories_per_gram', header: 'Cal/g', accessorKey: 'calories_per_gram' },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{row.original.status}</Badge>,
      },
    ]}
  />
)

export default IngredientView
