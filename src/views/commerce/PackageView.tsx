import CrudView from '@/views/CrudView'
import { Badge } from '@/components/ui/badge'

// Solo planes de suscripción: los packs de pago único tienen su propia
// página (PacksView, /packs) con un formulario sin campos de facturación.
const PLAN_LIST_PARAMS = { is_pack: '0' }

const PlanView = () => (
  <CrudView
    title='Planes'
    endpoint='/admin/plans'
    listParams={PLAN_LIST_PARAMS}
    fields={[
      { name: 'name', label: 'Nombre', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'is_active', label: 'Activo', type: 'boolean', placeholder: 'Desmarcar para desactivar el plan' },
      { name: 'is_archived', label: 'Archivado', type: 'boolean', placeholder: 'Marcar para archivar y ocultar de la venta' },
      { name: 'price', label: 'Precio', type: 'number', required: true },
      { name: 'signup_fee', label: 'Cuota de alta', type: 'number', placeholder: 'Pago único al suscribirse' },
      { name: 'currency', label: 'Moneda', type: 'select', required: true, options: [
        { label: 'EUR (€)', value: 'EUR' },
        { label: 'USD ($)', value: 'USD' },
        { label: 'GBP (£)', value: 'GBP' },
      ]},
      { name: 'invoice_period', label: 'Período de facturación', type: 'number', required: true, placeholder: '1' },
      { name: 'invoice_interval', label: 'Intervalo de facturación', type: 'select', required: true, options: [
        { label: 'Día', value: 'day' }, { label: 'Semana', value: 'week' },
        { label: 'Mes', value: 'month' }, { label: 'Año', value: 'year' },
      ]},
      { name: 'trial_period', label: 'Período de prueba', type: 'number', placeholder: 'Días de prueba gratis' },
      { name: 'trial_interval', label: 'Unidad de prueba', type: 'select', options: [
        { label: 'Día', value: 'day' }, { label: 'Semana', value: 'week' },
        { label: 'Mes', value: 'month' },
      ]},
      { name: 'grace_period', label: 'Período de gracia', type: 'number', placeholder: 'Días extra antes de suspender' },
      { name: 'grace_interval', label: 'Unidad de gracia', type: 'select', options: [
        { label: 'Día', value: 'day' }, { label: 'Semana', value: 'week' },
      ]},
      { name: 'active_subscribers_limit', label: 'Límite de suscriptores', type: 'number', placeholder: 'Vacío = ilimitado' },
      { name: 'sort_order', label: 'Orden', type: 'number', placeholder: '0' },
      {
        name: 'training_program_id',
        label: 'Programa de entrenamiento',
        type: 'select',
        endpoint: '/admin/training-program-list',
        optionLabel: 'title',
        optionValue: 'id',
        placeholder: 'Ninguno',
      },
      {
        name: 'meal_plan_template_id',
        label: 'Plantilla de comidas',
        type: 'select',
        endpoint: '/admin/meal-plan-templates',
        optionLabel: 'title',
        optionValue: 'id',
        placeholder: 'Ninguno',
      },
      {
        name: 'habit_template_ids',
        label: 'Hábitos incluidos',
        type: 'multiselect',
        endpoint: '/admin/habit-list?templates=1',
        optionLabel: 'title',
        optionValue: 'id',
        placeholder: 'No hay plantillas de hábitos',
      },
      {
        name: 'resource_ids',
        label: 'Recursos incluidos',
        type: 'multiselect',
        endpoint: '/admin/admin-resource-list?per_page=250',
        optionLabel: 'title',
        optionValue: 'id',
        placeholder: 'No hay recursos',
      },
      {
        name: 'grants_full_workout_library',
        label: 'Acceso total a entrenamientos',
        type: 'boolean',
        placeholder: 'Desbloquea todos los entrenamientos premium',
      },
      {
        name: 'grants_full_recipe_library',
        label: 'Acceso total a recetas',
        type: 'boolean',
        placeholder: 'Desbloquea todas las recetas premium',
      },
    ]}
    columns={[
      { id: 'id', header: 'ID', accessorKey: 'id' },
      { id: 'name', header: 'Plan', accessorKey: 'name' },
      { id: 'price', header: 'Precio', cell: ({ row }) => `${row.original.price} ${row.original.currency}` },
      { id: 'invoice', header: 'Facturación', cell: ({ row }) => `${row.original.invoice_period} ${row.original.invoice_interval}` },
      {
        id: 'trial',
        header: 'Prueba',
        cell: ({ row }) => row.original.trial_period > 0 ? `${row.original.trial_period} ${row.original.trial_interval}` : '—',
      },
      {
        id: 'is_active',
        header: 'Estado',
        cell: ({ row }) => {
          const { is_active, is_archived } = row.original
          if (is_archived) return <Badge variant='secondary'>Archivado</Badge>
          return <Badge variant={is_active ? 'default' : 'outline'}>{is_active ? 'Activo' : 'Inactivo'}</Badge>
        },
      },
      { id: 'sort_order', header: 'Orden', accessorKey: 'sort_order' },
    ]}
  />
)

export default PlanView
