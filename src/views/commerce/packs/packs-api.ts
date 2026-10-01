import { api } from '@/lib/api'

// Packs = planes de pago único vendidos en la web (Bckbs docs/PACKS_WEB.md).
// Un pack es un Plan con is_pack = true; la duración se guarda en
// invoice_period/invoice_interval (es lo que dura el programa, no una cuota).

export type DurationUnit = 'week' | 'month'

export type Pack = {
  id: number
  name: string
  slug: string
  description: string | null
  short_description: string | null
  image_url: string | null
  is_active: boolean
  sold_on_web: boolean
  pack_url: string | null
  price: number
  currency: string
  invoice_period: number | null
  invoice_interval: string | null
  training_program_id: number | null
  meal_plan_template_id: number | null
  habit_template_ids: number[]
  resource_ids: number[]
  grants_full_workout_library: boolean
  grants_full_recipe_library: boolean
  sort_order: number | null
}

export type PackStats = {
  plan_id: number
  currency: string
  purchases: number
  revenue: number
  registered: number
  not_registered: number
  refunded: number
  last_purchase_at: string | null
}

export type Option = { id: number; title: string }

/** Formulario del editor: todo en strings/booleans para los inputs. */
export type PackForm = {
  name: string
  slug: string
  short_description: string
  description: string
  image_url: string
  price: string
  currency: string
  duration: string
  duration_unit: DurationUnit
  training_program_id: string
  meal_plan_template_id: string
  habit_template_ids: number[]
  resource_ids: number[]
  grants_full_workout_library: boolean
  grants_full_recipe_library: boolean
  is_active: boolean
  sold_on_web: boolean
}

// Dominio de la web pública, solo para mostrar el enlace antes de guardar;
// el enlace definitivo lo da el backend (pack_url, de PACKS_WEB_URL).
export const WEB_URL = (import.meta.env.VITE_PACKS_WEB_URL || 'https://bestronger.es').replace(/\/$/, '')

export const EMPTY_FORM: PackForm = {
  name: '',
  slug: '',
  short_description: '',
  description: '',
  image_url: '',
  price: '',
  currency: 'EUR',
  duration: '3',
  duration_unit: 'month',
  training_program_id: '',
  meal_plan_template_id: '',
  habit_template_ids: [],
  resource_ids: [],
  grants_full_workout_library: false,
  grants_full_recipe_library: false,
  is_active: true,
  sold_on_web: false,
}

export function packToForm(p: Pack): PackForm {
  return {
    name: p.name ?? '',
    slug: p.slug ?? '',
    short_description: p.short_description ?? '',
    description: p.description ?? '',
    image_url: p.image_url ?? '',
    price: p.price != null ? String(p.price) : '',
    currency: p.currency || 'EUR',
    duration: String(p.invoice_period || 1),
    duration_unit: p.invoice_interval === 'week' ? 'week' : 'month',
    training_program_id: p.training_program_id ? String(p.training_program_id) : '',
    meal_plan_template_id: p.meal_plan_template_id ? String(p.meal_plan_template_id) : '',
    habit_template_ids: p.habit_template_ids ?? [],
    resource_ids: p.resource_ids ?? [],
    grants_full_workout_library: !!p.grants_full_workout_library,
    grants_full_recipe_library: !!p.grants_full_recipe_library,
    is_active: !!p.is_active,
    sold_on_web: !!p.sold_on_web,
  }
}

/** Payload para POST/PUT /admin/plans: un pack es siempre pago único, sin prueba ni gracia. */
export function formToPayload(f: PackForm, slugEdited: boolean) {
  return {
    is_pack: true,
    name: f.name.trim(),
    ...(slugEdited && f.slug ? { slug: slugify(f.slug) } : {}),
    short_description: f.short_description.trim() || null,
    description: f.description.trim() || null,
    image_url: f.image_url || null,
    price: Number(f.price),
    signup_fee: 0,
    currency: f.currency,
    invoice_period: Math.max(1, parseInt(f.duration, 10) || 1),
    invoice_interval: f.duration_unit,
    trial_period: 0,
    grace_period: 0,
    training_program_id: f.training_program_id ? Number(f.training_program_id) : null,
    meal_plan_template_id: f.meal_plan_template_id ? Number(f.meal_plan_template_id) : null,
    habit_template_ids: f.habit_template_ids,
    resource_ids: f.resource_ids,
    grants_full_workout_library: f.grants_full_workout_library,
    grants_full_recipe_library: f.grants_full_recipe_library,
    is_active: f.is_active,
    sold_on_web: f.sold_on_web,
  }
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

/** Como slugify pero sin recortar guiones: para el input mientras se escribe. */
export function slugifyLive(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 100)
}

export function formatPrice(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency || 'EUR' }).format(amount || 0)
}

export function formatDuration(duration: number, unit: string): string {
  const n = duration || 1
  if (unit === 'week') return `${n} ${n === 1 ? 'semana' : 'semanas'}`
  return `${n} ${n === 1 ? 'mes' : 'meses'}`
}

/** Lo que verá el comprador en la web como "incluye" (mismo criterio que PackController::present). */
export function includesOf(f: Pick<PackForm, 'training_program_id' | 'meal_plan_template_id' | 'habit_template_ids' | 'resource_ids'>): string[] {
  return [
    f.training_program_id ? 'Programa de entrenamiento' : null,
    f.meal_plan_template_id ? 'Plan de nutrición' : null,
    f.habit_template_ids.length ? 'Hábitos diarios' : null,
    f.resource_ids.length ? 'Guías y recursos' : null,
  ].filter((x): x is string => !!x)
}

function extractList<T>(res: any): T[] {
  const list = res?.data?.data ?? res?.data ?? res
  return Array.isArray(list) ? list : []
}

export async function fetchPacks(): Promise<Pack[]> {
  return extractList<Pack>(await api.get('/admin/plans?is_pack=1&per_page=-1'))
}

export async function fetchPackStats(): Promise<PackStats[]> {
  return extractList<PackStats>(await api.get('/admin/pack-stats'))
}

export async function fetchOptions(): Promise<{
  programs: Option[]
  mealPlans: Option[]
  habits: Option[]
  resources: Option[]
}> {
  const load = (url: string) => api.get(url).then((r) => extractList<Option>(r)).catch(() => [] as Option[])
  const [programs, mealPlans, habits, resources] = await Promise.all([
    load('/admin/training-program-list?per_page=-1'),
    load('/admin/meal-plan-templates?per_page=-1'),
    load('/admin/habit-list?templates=1'),
    load('/admin/admin-resource-list?per_page=250'),
  ])
  return { programs, mealPlans, habits, resources }
}

export async function uploadPackImage(file: File): Promise<string> {
  const body = new FormData()
  body.append('image', file)
  const res = await api.post<{ data: { url: string } }>('/admin/pack-image', body)
  return res.data.url
}

export function shareOnWhatsApp(name: string, url: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(`${name}: ${url}`)}`, '_blank', 'noopener')
}
