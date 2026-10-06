import { http, HttpResponse } from 'msw'
import { nameScore } from 'src/views/reports/payment-client-utils'

const MONTH_LABELS: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

type Source = 'user' | 'external'
type MockClient = { id: number; source: Source; name: string; email: string | null; status: string; monthly_fee: number; notes?: string | null }

const clients: MockClient[] = [
  { id: 201, source: 'user', name: 'Marta Fernández', email: 'marta.fernandez@example.com', status: 'active', monthly_fee: 60 },
  { id: 202, source: 'user', name: 'Javier Ortega', email: 'javier.ortega@example.com', status: 'active', monthly_fee: 45 },
  { id: 203, source: 'user', name: 'Lucía Vidal', email: 'lucia.vidal@example.com', status: 'active', monthly_fee: 60 },
  { id: 204, source: 'user', name: 'Diego Ramos', email: 'diego.ramos@example.com', status: 'active', monthly_fee: 50 },
  { id: 205, source: 'user', name: 'Sara Molina', email: 'sara.molina@example.com', status: 'active', monthly_fee: 60 },
]

// Usuarios de la app que aún no están en el seguimiento de pagos (para
// probar "Revisar duplicados": p. ej. Hamza Bilbao de Notion = Hamsa Dris Bakkali).
const otherUsers: MockClient[] = [
  { id: 301, source: 'user', name: 'Hamsa Dris Bakkali', email: 'hamsa@example.com', status: 'active', monthly_fee: 0 },
  { id: 302, source: 'user', name: 'Antonio Pérez', email: 'toni@example.com', status: 'active', monthly_fee: 0 },
  { id: 303, source: 'user', name: 'Nerea Sánchez', email: 'nerea@example.com', status: 'active', monthly_fee: 0 },
  { id: 304, source: 'user', name: 'Borja Betanzos', email: 'borja@example.com', status: 'active', monthly_fee: 0 },
]
let nextExternalId = 1

type Record_ = { paid: boolean; amount: number; paid_at: string | null; notes: string | null }
const records = new Map<string, Record_>()
const key = (source: Source, id: number, year: number, month: number) => `${source}:${id}:${year}:${month}`
const findClient = (source: Source, id: number) => clients.find((c) => c.source === source && c.id === id)

// Semilla determinista: los meses ya pasados de este año aparecen pagados
// para poder ver el panel con datos desde el primer render.
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
clients.forEach((c, i) => {
  for (let m = 1; m < currentMonth; m++) {
    if ((m + i) % 7 === 0) continue // deja algún hueco "sin pagar" de vez en cuando
    records.set(key(c.source, c.id, currentYear, m), {
      paid: true,
      amount: c.monthly_fee,
      paid_at: `${currentYear}-${String(m).padStart(2, '0')}-05`,
      notes: null,
    })
  }
})

// ═══ Control de impago (Bckbs docs/AVISO_IMPAGO.md), versión simplificada ═══
const billingGlobal = { enabled: false, since: null as string | null }
const billingControls = new Map<number, { exempt: boolean; due_day: number; grace_until: string | null }>()
const todayIso = () => new Date().toISOString().slice(0, 10)

function mockBilling(c: MockClient) {
  const control = billingControls.get(c.id) ?? { exempt: false, due_day: 1, grace_until: null }
  const now = new Date()
  const due = now.getDate() >= control.due_day
    ? new Date(now.getFullYear(), now.getMonth(), control.due_day)
    : new Date(now.getFullYear(), now.getMonth() - 1, control.due_day)
  const year = due.getFullYear()
  const month = due.getMonth() + 1
  const record = records.get(key('user', c.id, year, month))
  const anchor = billingGlobal.enabled && billingGlobal.since && new Date(billingGlobal.since) > due ? new Date(billingGlobal.since) : billingGlobal.enabled ? due : new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - anchor.getTime()) / 86400000) + 1
  const blockDate = new Date(anchor.getTime() + 3 * 86400000).toISOString().slice(0, 10)
  const state: 'ok' | 'exempt' | 'grace' | 'warning' | 'blocked' = control.exempt
    ? 'exempt'
    : record?.paid
      ? 'ok'
      : control.grace_until && control.grace_until >= todayIso()
        ? 'grace'
        : day <= 3 ? 'warning' : 'blocked'
  const pending = state === 'warning' || state === 'blocked' || state === 'grace'
  return {
    state,
    effective_state: billingGlobal.enabled ? state : (pending ? 'ok' : state),
    enforcement_enabled: billingGlobal.enabled,
    day: pending ? day : null,
    block_date: pending ? blockDate : null,
    due_day: control.due_day,
    exempt: control.exempt,
    grace_until: control.grace_until,
    period: { year, month, label: `${MONTH_LABELS[month]} ${year}` },
    due_date: due.toISOString().slice(0, 10),
    paid: !!record?.paid,
    amount: record?.amount ?? c.monthly_fee,
    currency: 'EUR',
    days_until_block: state === 'warning' ? 4 - day : null,
    message: null,
  }
}

function billingSettingsPayload() {
  const counts = { ok: 0, grace: 0, warning: 0, blocked: 0, exempt: 0 }
  clients.filter((c) => c.source === 'user').forEach((c) => { counts[mockBilling(c).state]++ })
  return { enabled: billingGlobal.enabled, stored_enabled: billingGlobal.enabled, force_off: false, since: billingGlobal.since, warning_days: 3, counts }
}

function buildClientsPayload(year: number) {
  return clients.map((c) => {
    const months: Record<number, Record_> = {}
    for (let m = 1; m <= 12; m++) {
      months[m] = records.get(key(c.source, c.id, year, m)) ?? { paid: false, amount: c.monthly_fee, paid_at: null, notes: null }
    }
    return { id: c.id, source: c.source, name: c.name, email: c.email, status: c.status, monthly_fee: c.monthly_fee, months, billing: c.source === 'user' ? mockBilling(c) : null }
  })
}

async function saveMonth(source: Source, request: Request, params: Record<string, unknown>) {
  const id = Number(params.id)
  const year = Number(params.year)
  const month = Number(params.month)
  const client = findClient(source, id)
  if (!client) return HttpResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 })

  const body = (await request.json()) as { paid: boolean; amount?: number; paid_at?: string | null; notes?: string | null }
  const amount = body.amount ?? client.monthly_fee
  const record: Record_ = {
    paid: !!body.paid,
    amount,
    paid_at: body.paid_at ?? (body.paid ? new Date().toISOString().slice(0, 10) : null),
    notes: body.notes ?? null,
  }
  records.set(key(source, id, year, month), record)

  return HttpResponse.json({ data: { client_id: id, source, year, month, ...record } })
}

export const SubscriptionPaymentsHandlers = [
  http.get('*/admin/payment-control/settings', () => HttpResponse.json({ data: billingSettingsPayload() })),

  http.put('*/admin/payment-control/settings', async ({ request }) => {
    const body = (await request.json()) as { enabled: boolean }
    if (body.enabled && !billingGlobal.enabled) billingGlobal.since = todayIso()
    billingGlobal.enabled = !!body.enabled
    return HttpResponse.json({ data: billingSettingsPayload() })
  }),

  http.get('*/admin/users/:userId/payment-control', ({ params }) => {
    const client = findClient('user', Number(params.userId))
    if (!client) return HttpResponse.json({ data: { user_id: Number(params.userId), applies: false, settings: { exempt: false, due_day: 1, grace_until: null }, status: null } })
    const control = billingControls.get(client.id) ?? { exempt: false, due_day: 1, grace_until: null }
    return HttpResponse.json({ data: { user_id: client.id, applies: true, settings: control, status: mockBilling(client) } })
  }),

  http.put('*/admin/users/:userId/payment-control', async ({ request, params }) => {
    const client = findClient('user', Number(params.userId))
    if (!client) return HttpResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 })
    const body = (await request.json()) as { exempt?: boolean; due_day?: number; grace_days?: number }
    const control = { ...(billingControls.get(client.id) ?? { exempt: false, due_day: 1, grace_until: null }) }
    if (body.exempt !== undefined) control.exempt = body.exempt
    if (body.due_day !== undefined) control.due_day = body.due_day
    if (body.grace_days !== undefined) {
      control.grace_until = body.grace_days > 0 ? new Date(Date.now() + body.grace_days * 86400000).toISOString().slice(0, 10) : null
    }
    billingControls.set(client.id, control)
    return HttpResponse.json({ data: { user_id: client.id, applies: true, settings: control, status: mockBilling(client) } })
  }),

  http.get('*/admin/subscription-payments/summary', ({ request }) => {
    const url = new URL(request.url)
    const year = Number(url.searchParams.get('year')) || currentYear
    const totalClients = clients.length

    let totalYear = 0
    let monthsWithData = 0
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const paidRows = clients
        .map((c) => records.get(key(c.source, c.id, year, m)))
        .filter((r): r is Record_ => !!r?.paid)
      const total = paidRows.reduce((sum, r) => sum + r.amount, 0)
      if (total > 0) monthsWithData++
      totalYear += total
      return { month: m, label: MONTH_LABELS[m], total, paid_count: paidRows.length, unpaid_count: Math.max(totalClients - paidRows.length, 0) }
    })

    return HttpResponse.json({
      data: {
        year,
        monthly,
        total_year: totalYear,
        average_month: monthsWithData > 0 ? totalYear / monthsWithData : 0,
        average_client: totalClients > 0 ? totalYear / totalClients : 0,
        total_clients: totalClients,
      },
    })
  }),

  http.get('*/admin/subscription-payments/years', () => {
    const years = new Set<number>([currentYear])
    records.forEach((_, k) => years.add(Number(k.split(':')[2])))
    return HttpResponse.json({ data: Array.from(years).sort((a, b) => b - a) })
  }),

  http.get('*/admin/subscription-payments', ({ request }) => {
    const url = new URL(request.url)
    const year = Number(url.searchParams.get('year')) || currentYear
    return HttpResponse.json({ data: { year, month_labels: MONTH_LABELS, clients: buildClientsPayload(year) } })
  }),

  // Clientes externos: solo existen en el seguimiento de pagos, sin cuenta en la app.
  http.post('*/admin/subscription-payments/external', async ({ request }) => {
    const body = (await request.json()) as { name?: string; email?: string | null; monthly_fee?: number; notes?: string | null }
    const name = body.name?.trim()
    if (!name) return HttpResponse.json({ message: 'El nombre es obligatorio.' }, { status: 422 })
    const client: MockClient = {
      id: nextExternalId++,
      source: 'external',
      name,
      email: body.email?.trim() || null,
      status: 'active',
      monthly_fee: Number(body.monthly_fee) || 0,
      notes: body.notes ?? null,
    }
    clients.push(client)
    return HttpResponse.json({ data: client }, { status: 201 })
  }),

  http.get('*/admin/subscription-payments/merge-candidates', () => {
    const users = [...clients.filter((c) => c.source === 'user'), ...otherUsers]
    const data = clients.filter((c) => c.source === 'external').map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      monthly_fee: c.monthly_fee,
      payments_count: Array.from(records.keys()).filter((k) => k.startsWith(`external:${c.id}:`)).length,
      candidates: users
        .map((u) => ({ id: u.id, name: u.name, email: u.email, is_personal_client: clients.includes(u), score: nameScore(c.name, u.name) }))
        .filter((u) => u.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    }))
    return HttpResponse.json({ data })
  }),

  http.post('*/admin/subscription-payments/external/:id/merge', async ({ request, params }) => {
    const external = findClient('external', Number(params.id))
    const { user_id } = (await request.json()) as { user_id: number }
    let user = findClient('user', user_id)
    if (!user) {
      const index = otherUsers.findIndex((u) => u.id === user_id)
      if (index !== -1) { user = otherUsers.splice(index, 1)[0]; clients.push(user) }
    }
    if (!external || !user) return HttpResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 })

    let moved = 0
    let skipped = 0
    Array.from(records.entries()).forEach(([k, record]) => {
      if (!k.startsWith(`external:${external.id}:`)) return
      const [, , year, month] = k.split(':').map(Number)
      const target = key('user', user.id, year, month)
      const existing = records.get(target)
      records.delete(k)
      if (existing && (existing.paid || !record.paid)) { skipped++; return }
      records.set(target, record)
      moved++
    })
    if (!user.monthly_fee) user.monthly_fee = external.monthly_fee
    clients.splice(clients.indexOf(external), 1)
    return HttpResponse.json({ data: { user_id: user.id, moved, skipped } })
  }),

  http.put('*/admin/subscription-payments/external/:id/:year/:month', ({ request, params }) => saveMonth('external', request, params)),

  http.put('*/admin/subscription-payments/external/:id', async ({ request, params }) => {
    const client = findClient('external', Number(params.id))
    if (!client) return HttpResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 })
    const body = (await request.json()) as Partial<Pick<MockClient, 'name' | 'email' | 'monthly_fee' | 'notes'>>
    Object.assign(client, body)
    return HttpResponse.json({ data: client })
  }),

  http.delete('*/admin/subscription-payments/external/:id', ({ params }) => {
    const id = Number(params.id)
    const index = clients.findIndex((c) => c.source === 'external' && c.id === id)
    if (index === -1) return HttpResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 })
    clients.splice(index, 1)
    Array.from(records.keys()).forEach((k) => { if (k.startsWith(`external:${id}:`)) records.delete(k) })
    return HttpResponse.json({ data: { id } })
  }),

  http.put('*/admin/subscription-payments/:id/:year/:month', ({ request, params }) => saveMonth('user', request, params)),

  http.put('*/admin/users/:userId/monthly-fee', async ({ request, params }) => {
    const client = findClient('user', Number(params.userId))
    if (!client) return HttpResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 })

    const body = (await request.json()) as { monthly_fee: number }
    client.monthly_fee = body.monthly_fee
    return HttpResponse.json({ data: { id: client.id, monthly_fee: client.monthly_fee } })
  }),
]
