import { http, HttpResponse } from 'msw'

// ═══════════════════════════════════════════════════════════════════
// TYPES — alineados con laravelcm/laravel-subscriptions
// ═══════════════════════════════════════════════════════════════════

type PlanInterval = 'day' | 'week' | 'month' | 'year'

type Plan = {
  id: number
  name: string
  slug: string
  description: string | null
  is_active: boolean
  price: number
  signup_fee: number
  currency: string
  trial_period: number
  trial_interval: PlanInterval
  invoice_period: number
  invoice_interval: PlanInterval
  grace_period: number
  grace_interval: PlanInterval
  prorate_day: number | null
  prorate_period: number | null
  prorate_extend_due: number | null
  active_subscribers_limit: number | null
  sort_order: number
  // MightyFitness extensions
  training_program_id: number | null
  meal_plan_template_id: number | null
  grants_full_workout_library: boolean
  grants_full_recipe_library: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

type PlanFeature = {
  id: number
  plan_id: number
  name: string
  slug: string
  description: string | null
  value: string
  resettable_period: number
  resettable_interval: PlanInterval
  sort_order: number
  created_at: string
  updated_at: string
}

type Subscription = {
  id: number
  subscriber_type: string
  subscriber_id: number
  subscriber_name: string
  plan_id: number
  plan_name: string
  plan_price: number
  name: string
  slug: string
  trial_ends_at: string | null
  starts_at: string | null
  ends_at: string | null
  canceled_at: string | null
  // Payment extensions (out of scope for the package)
  payment_status: string
  total_amount: number
  created_at: string
  updated_at: string
}

type SubscriptionUsage = {
  id: number
  subscription_id: number
  feature_id: number
  feature_name: string
  used: number
  valid_until: string | null
  created_at: string
}

type Transaction = {
  id: number
  subscription_id: number
  subscriber_id: number
  subscriber_name: string
  plan_id: number
  plan_name: string
  amount: number
  currency: string
  payment_method: string
  payment_status: 'paid' | 'pending' | 'failed'
  paid_at: string | null
  created_at: string
}

// ═══════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════

let nextPlanId = 5
let nextSubscriptionId = 4
let nextTransactionId = 9

const plans: Plan[] = [
  {
    id: 1, name: 'Básico', slug: 'basico', description: 'Plan de entrada para nuevos clientes',
    is_active: true, price: 29.99, signup_fee: 0, currency: 'EUR',
    trial_period: 7, trial_interval: 'day',
    invoice_period: 1, invoice_interval: 'month',
    grace_period: 3, grace_interval: 'day',
    prorate_day: null, prorate_period: null, prorate_extend_due: null,
    active_subscribers_limit: null, sort_order: 1,
    training_program_id: null, meal_plan_template_id: null,
    grants_full_workout_library: false, grants_full_recipe_library: false,
    is_archived: false,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 2, name: 'Premium', slug: 'premium', description: 'Plan completo con entrenamiento y nutrición',
    is_active: true, price: 49.99, signup_fee: 0, currency: 'EUR',
    trial_period: 14, trial_interval: 'day',
    invoice_period: 1, invoice_interval: 'month',
    grace_period: 5, grace_interval: 'day',
    prorate_day: null, prorate_period: null, prorate_extend_due: null,
    active_subscribers_limit: null, sort_order: 2,
    training_program_id: 1, meal_plan_template_id: 1,
    grants_full_workout_library: true, grants_full_recipe_library: false,
    is_archived: false,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 3, name: 'Pro', slug: 'pro', description: 'Plan profesional con acceso total',
    is_active: true, price: 69.99, signup_fee: 0, currency: 'EUR',
    trial_period: 14, trial_interval: 'day',
    invoice_period: 1, invoice_interval: 'month',
    grace_period: 5, grace_interval: 'day',
    prorate_day: null, prorate_period: null, prorate_extend_due: null,
    active_subscribers_limit: null, sort_order: 3,
    training_program_id: 1, meal_plan_template_id: 1,
    grants_full_workout_library: true, grants_full_recipe_library: true,
    is_archived: false,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 4, name: 'Elite', slug: 'elite', description: 'Plan élite con coaching personalizado',
    is_active: true, price: 99.99, signup_fee: 49.99, currency: 'EUR',
    trial_period: 0, trial_interval: 'day',
    invoice_period: 3, invoice_interval: 'month',
    grace_period: 7, grace_interval: 'day',
    prorate_day: null, prorate_period: null, prorate_extend_due: null,
    active_subscribers_limit: 50, sort_order: 4,
    training_program_id: 1, meal_plan_template_id: 1,
    grants_full_workout_library: true, grants_full_recipe_library: true,
    is_archived: false,
    created_at: '2026-03-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
  },
]

const features: PlanFeature[] = [
  { id: 1, plan_id: 1, name: 'Entrenamientos / semana', slug: 'workouts_per_week', description: null, value: '3', resettable_period: 1, resettable_interval: 'week', sort_order: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 2, plan_id: 1, name: 'Dietas asignadas', slug: 'diets', description: null, value: '1', resettable_period: 1, resettable_interval: 'month', sort_order: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 3, plan_id: 1, name: 'Check-ins / mes', slug: 'checkins_per_month', description: null, value: '4', resettable_period: 1, resettable_interval: 'month', sort_order: 3, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 4, plan_id: 1, name: 'Acceso a biblioteca de recetas', slug: 'recipe_library', description: null, value: 'Y', resettable_period: 0, resettable_interval: 'month', sort_order: 4, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 5, plan_id: 1, name: 'Soporte chat', slug: 'chat_support', description: 'Soporte por chat en la app', value: 'Y', resettable_period: 0, resettable_interval: 'month', sort_order: 5, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  { id: 6, plan_id: 2, name: 'Entrenamientos / semana', slug: 'workouts_per_week', description: null, value: '6', resettable_period: 1, resettable_interval: 'week', sort_order: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 7, plan_id: 2, name: 'Dietas asignadas', slug: 'diets', description: null, value: '3', resettable_period: 1, resettable_interval: 'month', sort_order: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 8, plan_id: 2, name: 'Check-ins / mes', slug: 'checkins_per_month', description: null, value: '8', resettable_period: 1, resettable_interval: 'month', sort_order: 3, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 9, plan_id: 2, name: 'Acceso a biblioteca de recetas', slug: 'recipe_library', description: null, value: 'Y', resettable_period: 0, resettable_interval: 'month', sort_order: 4, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 10, plan_id: 2, name: 'Soporte chat prioritario', slug: 'priority_chat', description: 'Soporte prioritario por chat', value: 'Y', resettable_period: 0, resettable_interval: 'month', sort_order: 5, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 11, plan_id: 2, name: 'Videollamadas / mes', slug: 'video_calls', description: null, value: '1', resettable_period: 1, resettable_interval: 'month', sort_order: 6, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  { id: 12, plan_id: 3, name: 'Entrenamientos / semana', slug: 'workouts_per_week', description: null, value: 'Ilimitado', resettable_period: 0, resettable_interval: 'month', sort_order: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 13, plan_id: 3, name: 'Dietas asignadas', slug: 'diets', description: null, value: 'Ilimitado', resettable_period: 0, resettable_interval: 'month', sort_order: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 14, plan_id: 3, name: 'Check-ins / mes', slug: 'checkins_per_month', description: null, value: 'Ilimitado', resettable_period: 0, resettable_interval: 'month', sort_order: 3, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 15, plan_id: 3, name: 'Acceso a biblioteca de recetas', slug: 'recipe_library', description: null, value: 'Y', resettable_period: 0, resettable_interval: 'month', sort_order: 4, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 16, plan_id: 3, name: 'Soporte chat + videollamada', slug: 'full_support', description: null, value: 'Y', resettable_period: 0, resettable_interval: 'month', sort_order: 5, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 17, plan_id: 3, name: 'Videollamadas / mes', slug: 'video_calls', description: null, value: '4', resettable_period: 1, resettable_interval: 'month', sort_order: 6, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 18, plan_id: 3, name: 'Grupos de entrenamiento', slug: 'group_training', description: null, value: 'Y', resettable_period: 0, resettable_interval: 'month', sort_order: 7, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  { id: 19, plan_id: 4, name: 'Entrenamientos / semana', slug: 'workouts_per_week', description: null, value: 'Ilimitado', resettable_period: 0, resettable_interval: 'month', sort_order: 1, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 20, plan_id: 4, name: 'Dietas asignadas', slug: 'diets', description: null, value: 'Ilimitado', resettable_period: 0, resettable_interval: 'month', sort_order: 2, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 21, plan_id: 4, name: 'Check-ins / mes', slug: 'checkins_per_month', description: null, value: 'Ilimitado', resettable_period: 0, resettable_interval: 'month', sort_order: 3, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 22, plan_id: 4, name: 'Coaching 1-a-1', slug: 'one_on_one', description: 'Sesiones individuales con coach dedicado', value: 'Y', resettable_period: 0, resettable_interval: 'month', sort_order: 4, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 23, plan_id: 4, name: 'Videollamadas / mes', slug: 'video_calls', description: null, value: '8', resettable_period: 1, resettable_interval: 'month', sort_order: 5, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 24, plan_id: 4, name: 'Análisis de composición corporal', slug: 'body_analysis', description: null, value: 'Y', resettable_period: 0, resettable_interval: 'month', sort_order: 6, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
]

const subscriptions: Subscription[] = [
  { id: 1, subscriber_type: 'App\\Models\\User', subscriber_id: 1, subscriber_name: 'Juan Pérez', plan_id: 2, plan_name: 'Premium', plan_price: 49.99, name: 'Suscripción Premium — Juan Pérez', slug: 'main', trial_ends_at: null, starts_at: '2026-06-01T00:00:00Z', ends_at: '2026-08-01T00:00:00Z', canceled_at: null, payment_status: 'paid', total_amount: 49.99, created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z' },
  { id: 2, subscriber_type: 'App\\Models\\User', subscriber_id: 2, subscriber_name: 'María García', plan_id: 3, plan_name: 'Pro', plan_price: 69.99, name: 'Suscripción Pro — María García', slug: 'main', trial_ends_at: null, starts_at: '2026-05-15T00:00:00Z', ends_at: '2026-08-07T00:00:00Z', canceled_at: null, payment_status: 'paid', total_amount: 69.99, created_at: '2026-05-15T00:00:00Z', updated_at: '2026-05-15T00:00:00Z' },
  { id: 3, subscriber_type: 'App\\Models\\User', subscriber_id: 3, subscriber_name: 'Carlos López', plan_id: 1, plan_name: 'Básico', plan_price: 29.99, name: 'Suscripción Básico — Carlos López', slug: 'main', trial_ends_at: null, starts_at: '2026-07-01T00:00:00Z', ends_at: '2026-08-30T00:00:00Z', canceled_at: null, payment_status: 'paid', total_amount: 29.99, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 4, subscriber_type: 'App\\Models\\User', subscriber_id: 4, subscriber_name: 'Ana Martínez', plan_id: 2, plan_name: 'Premium', plan_price: 49.99, name: 'Suscripción Premium — Ana Martínez', slug: 'main', trial_ends_at: null, starts_at: '2026-04-01T00:00:00Z', ends_at: '2026-09-15T00:00:00Z', canceled_at: null, payment_status: 'paid', total_amount: 149.97, created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z' },
  { id: 5, subscriber_type: 'App\\Models\\User', subscriber_id: 5, subscriber_name: 'Luis Rodríguez', plan_id: 4, plan_name: 'Elite', plan_price: 99.99, name: 'Suscripción Elite — Luis Rodríguez', slug: 'main', trial_ends_at: null, starts_at: '2026-07-20T00:00:00Z', ends_at: '2026-08-06T00:00:00Z', canceled_at: null, payment_status: 'paid', total_amount: 299.97, created_at: '2026-07-20T00:00:00Z', updated_at: '2026-07-20T00:00:00Z' },
  { id: 6, subscriber_type: 'App\\Models\\User', subscriber_id: 6, subscriber_name: 'Sofía Hernández', plan_id: 1, plan_name: 'Básico', plan_price: 29.99, name: 'Suscripción Básico — Sofía Hernández', slug: 'main', trial_ends_at: null, starts_at: '2026-06-15T00:00:00Z', ends_at: '2026-07-15T00:00:00Z', canceled_at: null, payment_status: 'paid', total_amount: 29.99, created_at: '2026-06-15T00:00:00Z', updated_at: '2026-06-15T00:00:00Z' },
  { id: 7, subscriber_type: 'App\\Models\\User', subscriber_id: 7, subscriber_name: 'Miguel Torres', plan_id: 2, plan_name: 'Premium', plan_price: 49.99, name: 'Suscripción Premium — Miguel Torres', slug: 'main', trial_ends_at: null, starts_at: '2026-08-01T00:00:00Z', ends_at: '2026-08-31T00:00:00Z', canceled_at: '2026-08-02T00:00:00Z', payment_status: 'paid', total_amount: 49.99, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-02T00:00:00Z' },
  { id: 8, subscriber_type: 'App\\Models\\User', subscriber_id: 8, subscriber_name: 'Laura Gómez', plan_id: 3, plan_name: 'Pro', plan_price: 69.99, name: 'Suscripción Pro — Laura Gómez', slug: 'main', trial_ends_at: '2026-08-10T00:00:00Z', starts_at: '2026-08-01T00:00:00Z', ends_at: '2026-09-01T00:00:00Z', canceled_at: null, payment_status: 'pending', total_amount: 69.99, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
]

const paymentMethods = ['bizum', 'efectivo', 'transferencia', 'tarjeta', 'otro']

const transactions: Transaction[] = subscriptions.map((s, i) => ({
  id: i + 1,
  subscription_id: s.id,
  subscriber_id: s.subscriber_id,
  subscriber_name: s.subscriber_name,
  plan_id: s.plan_id,
  plan_name: s.plan_name,
  amount: s.total_amount,
  currency: 'EUR',
  payment_method: paymentMethods[i % paymentMethods.length],
  payment_status: s.payment_status === 'paid' ? 'paid' : i % 3 === 0 ? 'failed' : 'pending',
  paid_at: s.payment_status === 'paid' ? s.created_at : null,
  created_at: s.created_at,
}))

const usages: SubscriptionUsage[] = [
  { id: 1, subscription_id: 1, feature_id: 6, feature_name: 'Entrenamientos / semana', used: 4, valid_until: null, created_at: '2026-07-28T00:00:00Z' },
  { id: 2, subscription_id: 1, feature_id: 7, feature_name: 'Dietas asignadas', used: 2, valid_until: null, created_at: '2026-07-15T00:00:00Z' },
  { id: 3, subscription_id: 1, feature_id: 8, feature_name: 'Check-ins / mes', used: 6, valid_until: null, created_at: '2026-07-20T00:00:00Z' },
  { id: 4, subscription_id: 2, feature_id: 12, feature_name: 'Entrenamientos / semana', used: 8, valid_until: null, created_at: '2026-07-25T00:00:00Z' },
  { id: 5, subscription_id: 2, feature_id: 13, feature_name: 'Dietas asignadas', used: 5, valid_until: null, created_at: '2026-07-18T00:00:00Z' },
  { id: 6, subscription_id: 3, feature_id: 1, feature_name: 'Entrenamientos / semana', used: 2, valid_until: null, created_at: '2026-08-03T00:00:00Z' },
]

// ═══════════════════════════════════════════════════════════════════
// MSW HANDLERS
// ═══════════════════════════════════════════════════════════════════

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function paginate(items: any[], search: string | null, per_page: number = 50) {
  let filtered = items
  if (search) {
    const q = search.toLowerCase()
    filtered = items.filter(item =>
      Object.values(item).some(v => String(v).toLowerCase().includes(q))
    )
  }
  return { data: filtered.slice(0, Number(per_page)), total: filtered.length }
}

function toStartOfDay(iso: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  return d
}

function toMonthlyPrice(price: number, interval: PlanInterval, period: number): number {
  if (period <= 0 || price <= 0) return 0
  switch (interval) {
    case 'day': return price * period * 30
    case 'week': return price * period * 4
    case 'month': return price * period
    case 'year': return (price * period) / 12
  }
}

function computeStats(today: Date) {
  const active = subscriptions.filter(s => {
    const ends = toStartOfDay(s.ends_at)
    return !s.canceled_at && ends && ends >= today
  })
  const expired = subscriptions.filter(s => {
    const ends = toStartOfDay(s.ends_at)
    return ends && ends < today
  })
  const canceledThisMonth = subscriptions.filter(s => {
    if (!s.canceled_at) return false
    const canceled = new Date(s.canceled_at)
    return canceled.getFullYear() === today.getFullYear() && canceled.getMonth() === today.getMonth()
  })

  const mrr = active.reduce((sum, s) => {
    const plan = plans.find(p => p.id === s.plan_id)
    if (!plan) return sum
    return sum + toMonthlyPrice(s.plan_price, plan.invoice_interval, plan.invoice_period)
  }, 0)

  const activeSubscribers = new Set(active.map(s => s.subscriber_id)).size
  const arpu = activeSubscribers > 0 ? mrr / activeSubscribers : 0

  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const revenueThisMonth = transactions
    .filter(t => t.payment_status === 'paid' && t.paid_at && new Date(t.paid_at) >= currentMonthStart)
    .reduce((sum, t) => sum + t.amount, 0)

  const pendingAmount = transactions
    .filter(t => t.payment_status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0)

  return {
    mrr: Number(mrr.toFixed(2)),
    arpu: Number(arpu.toFixed(2)),
    active_subscriptions: active.length,
    expired_subscriptions: expired.length,
    canceled_this_month: canceledThisMonth.length,
    expiring_soon: active.filter(s => {
      const ends = toStartOfDay(s.ends_at)
      if (!ends) return false
      const diff = Math.ceil((ends.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return diff >= 0 && diff <= 7
    }).length,
    revenue_this_month: Number(revenueThisMonth.toFixed(2)),
    pending_amount: Number(pendingAmount.toFixed(2)),
  }
}

export const CommerceHandlers = [

  // ═══ PLANS CRUD ═════════════════════════════════════════════════
  http.get('*/admin/plans', ({ request }) => {
    const url = new URL(request.url)
    const per_page = url.searchParams.get('per_page') || '50'
    const search = url.searchParams.get('search')
    const result = paginate(plans, search, Number(per_page))
    return HttpResponse.json({ status: 200, data: result.data, total: result.total })
  }),

  http.get('*/admin/plan-features', ({ request }) => {
    const url = new URL(request.url)
    const planId = url.searchParams.get('plan_id')
    const list = planId ? features.filter(f => f.plan_id === Number(planId)) : features
    return HttpResponse.json({ status: 200, data: list })
  }),

  http.post('*/admin/plans', async ({ request }) => {
    const body = (await request.json()) as any
    const id = nextPlanId++
    const plan: Plan = {
      id, name: body.name || '', slug: slugify(body.name || ''),
      description: body.description || null,
      is_active: body.is_active !== undefined ? body.is_active : true,
      price: Number(body.price) || 0, signup_fee: Number(body.signup_fee) || 0,
      currency: body.currency || 'EUR',
      trial_period: Number(body.trial_period) || 0,
      trial_interval: body.trial_interval || 'day',
      invoice_period: Number(body.invoice_period) || 1,
      invoice_interval: body.invoice_interval || 'month',
      grace_period: Number(body.grace_period) || 0,
      grace_interval: body.grace_interval || 'day',
      prorate_day: body.prorate_day ?? null,
      prorate_period: body.prorate_period ?? null,
      prorate_extend_due: body.prorate_extend_due ?? null,
      active_subscribers_limit: body.active_subscribers_limit ?? null,
      sort_order: Number(body.sort_order) || 0,
      training_program_id: body.training_program_id ?? null,
      meal_plan_template_id: body.meal_plan_template_id ?? null,
      grants_full_workout_library: !!body.grants_full_workout_library,
      grants_full_recipe_library: !!body.grants_full_recipe_library,
      is_archived: !!body.is_archived,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    plans.push(plan)
    return HttpResponse.json({ status: 200, data: plan, msg: 'Plan creado' })
  }),

  http.put('*/admin/plans/:id', async ({ request, params }) => {
    const id = Number(params.id)
    const idx = plans.findIndex(p => p.id === id)
    if (idx === -1) return HttpResponse.json({ status: 404, msg: 'Plan no encontrado' }, { status: 404 })
    const body = (await request.json()) as any
    const existing = plans[idx]
    plans[idx] = {
      ...existing,
      name: body.name ?? existing.name,
      slug: body.name ? slugify(body.name) : existing.slug,
      description: body.description !== undefined ? body.description : existing.description,
      is_active: body.is_active !== undefined ? body.is_active : existing.is_active,
      is_archived: body.is_archived !== undefined ? !!body.is_archived : existing.is_archived,
      price: body.price !== undefined ? Number(body.price) : existing.price,
      signup_fee: body.signup_fee !== undefined ? Number(body.signup_fee) : existing.signup_fee,
      currency: body.currency ?? existing.currency,
      trial_period: body.trial_period !== undefined ? Number(body.trial_period) : existing.trial_period,
      trial_interval: body.trial_interval ?? existing.trial_interval,
      invoice_period: body.invoice_period !== undefined ? Number(body.invoice_period) : existing.invoice_period,
      invoice_interval: body.invoice_interval ?? existing.invoice_interval,
      grace_period: body.grace_period !== undefined ? Number(body.grace_period) : existing.grace_period,
      grace_interval: body.grace_interval ?? existing.grace_interval,
      prorate_day: body.prorate_day !== undefined ? body.prorate_day : existing.prorate_day,
      prorate_period: body.prorate_period !== undefined ? body.prorate_period : existing.prorate_period,
      prorate_extend_due: body.prorate_extend_due !== undefined ? body.prorate_extend_due : existing.prorate_extend_due,
      active_subscribers_limit: body.active_subscribers_limit !== undefined ? body.active_subscribers_limit : existing.active_subscribers_limit,
      sort_order: body.sort_order !== undefined ? Number(body.sort_order) : existing.sort_order,
      training_program_id: body.training_program_id !== undefined ? body.training_program_id : existing.training_program_id,
      meal_plan_template_id: body.meal_plan_template_id !== undefined ? body.meal_plan_template_id : existing.meal_plan_template_id,
      grants_full_workout_library: body.grants_full_workout_library !== undefined ? !!body.grants_full_workout_library : existing.grants_full_workout_library,
      grants_full_recipe_library: body.grants_full_recipe_library !== undefined ? !!body.grants_full_recipe_library : existing.grants_full_recipe_library,
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json({ status: 200, data: plans[idx], msg: 'Plan actualizado' })
  }),

  http.delete('*/admin/plans/:id', async ({ params }) => {
    const id = Number(params.id)
    const idx = plans.findIndex(p => p.id === id)
    if (idx === -1) return HttpResponse.json({ status: 404, msg: 'Plan no encontrado' }, { status: 404 })
    plans.splice(idx, 1)
    return HttpResponse.json({ status: 200, msg: 'Plan eliminado' })
  }),

  // ═══ SUBSCRIPTIONS CRUD ═════════════════════════════════════════
  http.get('*/admin/plan-subscriptions', ({ request }) => {
    const url = new URL(request.url)
    const per_page = url.searchParams.get('per_page') || '50'
    const search = url.searchParams.get('search')
    const result = paginate(subscriptions, search, Number(per_page))
    return HttpResponse.json({ status: 200, data: result.data, total: result.total })
  }),

  http.post('*/admin/plan-subscriptions-grant', async ({ request }) => {
    const body = (await request.json()) as any
    const plan = plans.find(p => p.id === Number(body.plan_id))
    if (!plan) return HttpResponse.json({ status: 404, msg: 'Plan no encontrado' }, { status: 404 })
    const id = nextSubscriptionId++
    const now = new Date()
    const ends = new Date(now)
    ends.setMonth(ends.getMonth() + (plan.invoice_interval === 'year' ? plan.invoice_period * 12 : plan.invoice_period))
    const sub: Subscription = {
      id, subscriber_type: 'App\\Models\\User', subscriber_id: Number(body.subscriber_id),
      subscriber_name: body.subscriber_name || `Usuario ${body.subscriber_id}`,
      plan_id: plan.id, plan_name: plan.name, plan_price: plan.price,
      name: `Suscripción ${plan.name} — ${body.subscriber_name || `Usuario ${body.subscriber_id}`}`,
      slug: 'main', trial_ends_at: null, starts_at: now.toISOString(),
      ends_at: ends.toISOString(), canceled_at: null,
      payment_status: 'paid', total_amount: plan.price + plan.signup_fee,
      created_at: now.toISOString(), updated_at: now.toISOString(),
    }
    subscriptions.push(sub)
    const tx: Transaction = {
      id: nextTransactionId++, subscription_id: sub.id, subscriber_id: sub.subscriber_id,
      subscriber_name: sub.subscriber_name, plan_id: plan.id, plan_name: plan.name,
      amount: sub.total_amount, currency: plan.currency, payment_method: 'otro',
      payment_status: 'paid', paid_at: now.toISOString(), created_at: now.toISOString(),
    }
    transactions.push(tx)
    return HttpResponse.json({ status: 200, data: sub, msg: 'Suscripción concedida' })
  }),

  // ═══ SUBSCRIPTION USAGE ═════════════════════════════════════════
  http.get('*/admin/subscription-usage', ({ request }) => {
    const url = new URL(request.url)
    const subId = url.searchParams.get('subscription_id')
    const list = subId ? usages.filter(u => u.subscription_id === Number(subId)) : usages
    return HttpResponse.json({ status: 200, data: list })
  }),

  // ═══ SUBSCRIPTION STATS ═══════════════════════════════════════════
  http.get('*/admin/subscriptions/stats', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return HttpResponse.json({ status: 200, data: computeStats(today) })
  }),

  // ═══ SUBSCRIPTION RENEWAL REMINDER ════════════════════════════════
  http.post('*/admin/subscription/reminder', async ({ request }) => {
    const body = (await request.json()) as any
    const ids = Array.isArray(body.subscription_ids) ? body.subscription_ids : [body.subscription_id]
    const found = subscriptions.filter(s => ids.includes(s.id))
    if (found.length === 0) {
      return HttpResponse.json({ status: 404, msg: 'Suscripción no encontrada' }, { status: 404 })
    }
    return HttpResponse.json({
      status: 200,
      msg: `Aviso de renovación enviado a ${found.length} suscripción(es)`,
      data: { sent: found.length, ids: found.map(s => s.id) },
    })
  }),

  // ═══ REVOKE CLIENT ACCESS ═════════════════════════════════════════
  http.post('*/admin/users/:id/revoke-access', async ({ request, params }) => {
    const userId = Number(params.id)
    const body = (await request.json()) as any
    const sub = subscriptions.find(s => s.subscriber_id === userId)
    if (sub) {
      sub.canceled_at = new Date().toISOString()
      sub.ends_at = new Date().toISOString()
      sub.updated_at = new Date().toISOString()
    }
    return HttpResponse.json({
      status: 200,
      msg: 'Acceso revocado y suscripción marcada como vencida',
      data: { user_id: userId, reason: body.reason || null },
    })
  }),

  // ═══ TRANSACTIONS ═══════════════════════════════════════════════════
  http.get('*/admin/transactions', ({ request }) => {
    const url = new URL(request.url)
    const per_page = url.searchParams.get('per_page') || '50'
    const search = url.searchParams.get('search')
    const method = url.searchParams.get('payment_method')
    const status = url.searchParams.get('payment_status')
    let filtered = transactions
    if (search) {
      const q = search.toLowerCase()
      filtered = transactions.filter(t =>
        t.subscriber_name.toLowerCase().includes(q) ||
        t.plan_name.toLowerCase().includes(q)
      )
    }
    if (method) filtered = filtered.filter(t => t.payment_method === method)
    if (status) filtered = filtered.filter(t => t.payment_status === status)
    const result = {
      data: filtered.slice(0, Number(per_page)),
      total: filtered.length,
    }
    return HttpResponse.json({ status: 200, data: result.data, total: result.total })
  }),

  // ═══ REVENUE SUMMARY ════════════════════════════════════════════════
  http.get('*/admin/revenue-summary', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const stats = computeStats(today)
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const previousMonthEnd = new Date(currentMonthStart.getTime() - 1)

    const revenueCurrentMonth = transactions
      .filter(t => t.payment_status === 'paid' && t.paid_at && new Date(t.paid_at) >= currentMonthStart)
      .reduce((sum, t) => sum + t.amount, 0)
    const revenuePreviousMonth = transactions
      .filter(t => t.payment_status === 'paid' && t.paid_at && new Date(t.paid_at) >= previousMonthStart && new Date(t.paid_at) <= previousMonthEnd)
      .reduce((sum, t) => sum + t.amount, 0)

    const changePct = revenuePreviousMonth > 0
      ? Number((((revenueCurrentMonth - revenuePreviousMonth) / revenuePreviousMonth) * 100).toFixed(2))
      : 0

    const byPlan: Record<string, { count: number; revenue: number }> = {}
    transactions.filter(t => t.payment_status === 'paid').forEach(t => {
      if (!byPlan[t.plan_name]) byPlan[t.plan_name] = { count: 0, revenue: 0 }
      byPlan[t.plan_name].count += 1
      byPlan[t.plan_name].revenue += t.amount
    })

    return HttpResponse.json({
      status: 200,
      data: {
        revenue_current: Number(revenueCurrentMonth.toFixed(2)),
        revenue_previous: Number(revenuePreviousMonth.toFixed(2)),
        revenue_change_pct: changePct,
        mrr: stats.mrr,
        arpu: stats.arpu,
        active_subscriptions: stats.active_subscriptions,
        users_active: stats.active_subscriptions,
        users_free: 0,
        users_total: stats.active_subscriptions + stats.expired_subscriptions,
        expiring_soon: subscriptions.filter(s => {
          const ends = toStartOfDay(s.ends_at)
          if (!ends || s.canceled_at) return false
          const diff = Math.ceil((ends.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          return diff >= 0 && diff <= 7
        }).map(s => ({ id: s.id, subscriber_name: s.subscriber_name, plan_name: s.plan_name, ends_at: s.ends_at, days_left: Math.ceil((new Date(s.ends_at!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) })),
        by_plan: byPlan,
      },
    })
  }),

  // ═══ CLIENT SUBSCRIPTION STATUS ═══════════════════════════════════
  http.get('*/api/client/subscription', ({ request }) => {
    const url = new URL(request.url)
    const clientId = Number(url.searchParams.get('client_id')) || 1
    const sub = subscriptions.find(s => s.subscriber_id === clientId)
    if (!sub) {
      return HttpResponse.json({ status: 200, data: null })
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const ends = sub.ends_at ? new Date(sub.ends_at) : null
    const diff = ends ? Math.ceil((ends.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null
    return HttpResponse.json({
      status: 200,
      data: {
        subscription: sub,
        is_active: !sub.canceled_at && !!ends && ends >= today,
        is_trial: !!sub.trial_ends_at && new Date(sub.trial_ends_at) > today,
        days_until_expiration: diff,
        expires_soon: diff !== null && diff >= 0 && diff <= 7,
      },
    })
  }),
]
