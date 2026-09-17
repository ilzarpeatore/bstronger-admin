import { http, HttpResponse } from 'msw'

const MONTH_LABELS: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

type MockClient = { id: number; name: string; email: string; status: string; monthly_fee: number }

const clients: MockClient[] = [
  { id: 201, name: 'Marta Fernández', email: 'marta.fernandez@example.com', status: 'active', monthly_fee: 60 },
  { id: 202, name: 'Javier Ortega', email: 'javier.ortega@example.com', status: 'active', monthly_fee: 45 },
  { id: 203, name: 'Lucía Vidal', email: 'lucia.vidal@example.com', status: 'active', monthly_fee: 60 },
  { id: 204, name: 'Diego Ramos', email: 'diego.ramos@example.com', status: 'active', monthly_fee: 50 },
  { id: 205, name: 'Sara Molina', email: 'sara.molina@example.com', status: 'active', monthly_fee: 60 },
]

type Record_ = { paid: boolean; amount: number; paid_at: string | null; notes: string | null }
const records = new Map<string, Record_>()
const key = (userId: number, year: number, month: number) => `${userId}-${year}-${month}`

// Semilla determinista: los meses ya pasados de este año aparecen pagados
// para poder ver el panel con datos desde el primer render.
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
clients.forEach((c, i) => {
  for (let m = 1; m < currentMonth; m++) {
    if ((m + i) % 7 === 0) continue // deja algún hueco "sin pagar" de vez en cuando
    records.set(key(c.id, currentYear, m), {
      paid: true,
      amount: c.monthly_fee,
      paid_at: `${currentYear}-${String(m).padStart(2, '0')}-05`,
      notes: null,
    })
  }
})

function buildClientsPayload(year: number) {
  return clients.map((c) => {
    const months: Record<number, Record_> = {}
    for (let m = 1; m <= 12; m++) {
      months[m] = records.get(key(c.id, year, m)) ?? { paid: false, amount: c.monthly_fee, paid_at: null, notes: null }
    }
    return { id: c.id, name: c.name, email: c.email, status: c.status, monthly_fee: c.monthly_fee, months }
  })
}

export const SubscriptionPaymentsHandlers = [
  http.get('*/admin/subscription-payments/summary', ({ request }) => {
    const url = new URL(request.url)
    const year = Number(url.searchParams.get('year')) || currentYear
    const totalClients = clients.length

    let totalYear = 0
    let monthsWithData = 0
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const paidRows = clients
        .map((c) => records.get(key(c.id, year, m)))
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
    records.forEach((_, k) => years.add(Number(k.split('-')[1])))
    return HttpResponse.json({ data: Array.from(years).sort((a, b) => b - a) })
  }),

  http.get('*/admin/subscription-payments', ({ request }) => {
    const url = new URL(request.url)
    const year = Number(url.searchParams.get('year')) || currentYear
    return HttpResponse.json({ data: { year, month_labels: MONTH_LABELS, clients: buildClientsPayload(year) } })
  }),

  http.put('*/admin/subscription-payments/:userId/:year/:month', async ({ request, params }) => {
    const userId = Number(params.userId)
    const year = Number(params.year)
    const month = Number(params.month)
    const client = clients.find((c) => c.id === userId)
    if (!client) return HttpResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 })

    const body = (await request.json()) as { paid: boolean; amount?: number; paid_at?: string | null; notes?: string | null }
    const amount = body.amount ?? client.monthly_fee
    const record: Record_ = {
      paid: !!body.paid,
      amount,
      paid_at: body.paid_at ?? (body.paid ? new Date().toISOString().slice(0, 10) : null),
      notes: body.notes ?? null,
    }
    records.set(key(userId, year, month), record)

    return HttpResponse.json({ data: { user_id: userId, year, month, ...record } })
  }),

  http.put('*/admin/users/:userId/monthly-fee', async ({ request, params }) => {
    const userId = Number(params.userId)
    const client = clients.find((c) => c.id === userId)
    if (!client) return HttpResponse.json({ message: 'Cliente no encontrado.' }, { status: 404 })

    const body = (await request.json()) as { monthly_fee: number }
    client.monthly_fee = body.monthly_fee
    return HttpResponse.json({ data: { id: client.id, monthly_fee: client.monthly_fee } })
  }),
]
