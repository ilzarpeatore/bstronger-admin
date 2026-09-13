import CrudView from '@/views/CrudView'

const UnitConversionView = () => (
  <CrudView
    title='Conversiones de unidades'
    endpoint='/admin/unit-conversions'
    fields={[
      { name: 'ingredient_id', label: 'Ingrediente', type: 'select', endpoint: '/admin/ingredients', required: true },
      { name: 'measurement_unit_id', label: 'Unidad de medida', type: 'select', endpoint: '/admin/measurement-units', required: true },
      { name: 'gram_equivalent', label: 'Equivalente en gramos', type: 'number', required: true },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'ingredient_id', header: 'Ingrediente', accessorKey: 'ingredient_id' },
      { id: 'measurement_unit_id', header: 'Unidad', accessorKey: 'measurement_unit_id' },
      { id: 'gram_equivalent', header: 'Gramos', accessorKey: 'gram_equivalent' },
    ]}
  />
)

export default UnitConversionView
