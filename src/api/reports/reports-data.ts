import { http, HttpResponse } from 'msw'

type ChangePct = { periodo_actual: number; periodo_anterior: number; cambio_pct: number }

type DashboardKpis = {
  altas_mes: ChangePct
  retencion: ChangePct
  entrenamientos_completados: ChangePct
  cumplimiento_dietas: ChangePct
  checkins_enviados: ChangePct
  checkins_respondidos: ChangePct
  tasa_respuesta: ChangePct
  ingresos: ChangePct
  nuevas_suscripciones: ChangePct
}

type SummaryRow = { label: string; value: number }
type SummariesPayload = { period_label: string; data: SummaryRow[]; total: number }

type SessionRow = {
  date: string; client: string; coach: string; type: string
  status: 'completed' | 'cancelled' | 'no_show'; duration_min: number; gym: string
  program: string; subscription: string; payment_amount: number; subscription_status: string
}
type CoachMetric = {
  coach_id: number; coach_name: string; clientes_activos: number
  pct_con_plan: number; pct_completan_80: number; total_clientes: number
}

// ═══════════════════════════════════════════════════════════════════
// GENERACIÓN DE MOCK DATA (determinista basada en la fecha actual)
// ═══════════════════════════════════════════════════════════════════
const monthIdx = new Date().getMonth()

const coaches = [
  { id: 1, name: 'Carlos Martínez' },
  { id: 2, name: 'Ana García' },
  { id: 3, name: 'Luis Rodríguez' },
  { id: 4, name: 'María López' },
]
const gyms = ['Be Stronger Central', 'Be Stronger Norte', 'Be Stronger Sur', 'Online']
const programs = ['Premium', 'Básico', 'Pro', 'Elite']
const clients = Array.from({ length: 120 }, (_, i) => ({
  id: i + 1,
  name: `Cliente ${i + 1}`,
  gym: gyms[i % 4],
  coach_id: coaches[i % 4].id,
  coach_name: coaches[i % 4].name,
  program: programs[i % 4],
  registered_at: new Date(2026, monthIdx - 1, (i % 28) + 1).toISOString().slice(0, 10),
}))

const sessionTypes = ['Pecho y tríceps', 'Espalda y bíceps', 'Pierna', 'Hombro', 'Full Body', 'Cardio', 'HIIT', 'Yoga']
const statuses: ('completed' | 'cancelled' | 'no_show')[] = ['completed', 'completed', 'completed', 'completed', 'cancelled', 'no_show']

function makeSessions(count: number): SessionRow[] {
  return Array.from({ length: count }, (_, i) => {
    const c = clients[i % clients.length]
    const d = new Date(2026, monthIdx, (i % 28) + 1)
    return {
      date: d.toISOString().slice(0, 10),
      client: c.name,
      coach: coaches[c.coach_id - 1].name,
      type: sessionTypes[i % sessionTypes.length],
      status: statuses[i % statuses.length],
      duration_min: [45, 60, 30, 90][i % 4],
      gym: gyms[i % 4],
      program: programs[i % 4],
      subscription: programs[i % 4],
      payment_amount: [49.99, 29.99, 69.99, 99.99][i % 4],
      subscription_status: i % 5 === 0 ? 'expirada' : 'activa',
    }
  })
}

const sessions: SessionRow[] = makeSessions(180)

// ═══════════════════════════════════════════════════════════════════
// MOCK HANDLERS
// ═══════════════════════════════════════════════════════════════════

function randomBetween(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10
}

export const ReportsHandlers = [

  // ═══ DASHBOARD KPIs ═════════════════════════════════════════════
  http.get('*/admin/reports/dashboard-kpis', ({ request }) => {
    const url = new URL(request.url)
    const period = url.searchParams.get('period') || 'month'

    const kpis: DashboardKpis = period === 'week'
      ? {
          altas_mes: { periodo_actual: 34, periodo_anterior: 28, cambio_pct: 21.4 },
          retencion: { periodo_actual: 87.5, periodo_anterior: 85.0, cambio_pct: 2.94 },
          entrenamientos_completados: { periodo_actual: 412, periodo_anterior: 390, cambio_pct: 5.64 },
          cumplimiento_dietas: { periodo_actual: 72.3, periodo_anterior: 68.1, cambio_pct: 6.17 },
          checkins_enviados: { periodo_actual: 180, periodo_anterior: 175, cambio_pct: 2.86 },
          checkins_respondidos: { periodo_actual: 148, periodo_anterior: 140, cambio_pct: 5.71 },
          tasa_respuesta: { periodo_actual: 82.2, periodo_anterior: 80.0, cambio_pct: 2.75 },
          ingresos: { periodo_actual: 8450, periodo_anterior: 7920, cambio_pct: 6.69 },
          nuevas_suscripciones: { periodo_actual: 22, periodo_anterior: 19, cambio_pct: 15.79 },
        }
      : {
          altas_mes: { periodo_actual: 142, periodo_anterior: 128, cambio_pct: 10.94 },
          retencion: { periodo_actual: 85.2, periodo_anterior: 82.4, cambio_pct: 3.40 },
          entrenamientos_completados: { periodo_actual: 1850, periodo_anterior: 1720, cambio_pct: 7.56 },
          cumplimiento_dietas: { periodo_actual: 70.8, periodo_anterior: 66.5, cambio_pct: 6.47 },
          checkins_enviados: { periodo_actual: 720, periodo_anterior: 685, cambio_pct: 5.11 },
          checkins_respondidos: { periodo_actual: 590, periodo_anterior: 548, cambio_pct: 7.66 },
          tasa_respuesta: { periodo_actual: 81.9, periodo_anterior: 80.0, cambio_pct: 2.38 },
          ingresos: { periodo_actual: 32400, periodo_anterior: 29850, cambio_pct: 8.54 },
          nuevas_suscripciones: { periodo_actual: 85, periodo_anterior: 76, cambio_pct: 11.84 },
        }

    return HttpResponse.json({ status: 200, data: kpis, period })
  }),

  // ═══ USERS SUMMARY ══════════════════════════════════════════════
  http.get('*/admin/reports/users-summary', ({ request }) => {
    const url = new URL(request.url)
    const groupBy = url.searchParams.get('group_by') || 'day'

    const groups: SummaryRow[] = groupBy === 'month'
      ? [
          { label: 'Enero', value: 118 },
          { label: 'Febrero', value: 125 },
          { label: 'Marzo', value: 132 },
          { label: 'Abril', value: 140 },
          { label: 'Mayo', value: 138 },
          { label: 'Junio', value: 142 },
          { label: 'Julio', value: 155 },
          { label: 'Agosto', value: 148 },
        ]
      : groupBy === 'gym'
        ? [
            { label: 'Be Stronger Central', value: 42 },
            { label: 'Be Stronger Norte', value: 35 },
            { label: 'Be Stronger Sur', value: 28 },
            { label: 'Online', value: 37 },
          ]
        : groupBy === 'coach'
          ? coaches.map(c => ({ label: c.name, value: randomBetween(25, 40) }))
          : [
              { label: 'Lun', value: 22 },
              { label: 'Mar', value: 25 },
              { label: 'Mié', value: 19 },
              { label: 'Jue', value: 28 },
              { label: 'Vie', value: 24 },
              { label: 'Sáb', value: 14 },
              { label: 'Dom', value: 10 },
            ]

    return HttpResponse.json({
      status: 200,
      data: { period_label: groupBy === 'day' ? 'por día' : groupBy === 'month' ? 'por mes' : `por ${groupBy}`, data: groups, total: 142 },
    } satisfies { status: number; data: SummariesPayload })
  }),

  // ═══ SESSIONS ═══════════════════════════════════════════════════
  http.get('*/admin/reports/sessions', ({ request }) => {
    const url = new URL(request.url)
    const groupBy = url.searchParams.get('group_by') || 'day'
    const coach = url.searchParams.get('coach')
    const gym = url.searchParams.get('gym')

    let filtered = sessions
    if (coach) filtered = filtered.filter(s => s.coach === coach)
    if (gym) filtered = filtered.filter(s => s.gym === gym)

    const completed = filtered.filter(s => s.status === 'completed').length
    const cancelled = filtered.filter(s => s.status === 'cancelled').length
    const noShow = filtered.filter(s => s.status === 'no_show').length

    const groups: SummaryRow[] = groupBy === 'type'
      ? sessionTypes.map(t => ({ label: t, value: filtered.filter(s => s.type === t).length }))
      : groupBy === 'coach'
        ? coaches.map(c => ({ label: c.name, value: filtered.filter(s => s.coach === c.name).length }))
        : groupBy === 'gym'
          ? gyms.map(g => ({ label: g, value: filtered.filter(s => s.gym === g).length }))
          : [
              { label: 'Completadas', value: completed },
              { label: 'Canceladas', value: cancelled },
              { label: 'No asistió', value: noShow },
            ]

    return HttpResponse.json({
      status: 200,
      data: {
        period_label: groupBy === 'day' ? 'por estado' : `por ${groupBy}`,
        data: groups,
        total: filtered.length,
        completed,
        cancelled,
        no_show: noShow,
        rows: filtered.slice(0, 50),
      },
    })
  }),

  // ═══ CHECKINS ═══════════════════════════════════════════════════
  http.get('*/admin/reports/checkins', ({ request }) => {
    const url = new URL(request.url)
    const groupBy = url.searchParams.get('group_by') || 'day'

    const groups: SummaryRow[] = groupBy === 'coach'
      ? coaches.map(c => ({
          label: c.name,
          value: randomBetween(80, 160),
        }))
      : groupBy === 'month'
        ? [
            { label: 'Enero', value: 560 },
            { label: 'Febrero', value: 590 },
            { label: 'Marzo', value: 612 },
            { label: 'Abril', value: 640 },
            { label: 'Mayo', value: 670 },
            { label: 'Junio', value: 695 },
            { label: 'Julio', value: 720 },
            { label: 'Agosto', value: 720 },
          ]
        : [
            { label: 'Lun', value: 98 },
            { label: 'Mar', value: 105 },
            { label: 'Mié', value: 92 },
            { label: 'Jue', value: 112 },
            { label: 'Vie', value: 108 },
            { label: 'Sáb', value: 88 },
            { label: 'Dom', value: 87 },
          ]

    const enviados = groups.reduce((sum, g) => sum + g.value, 0)
    const respondidos = Math.round(enviados * 0.82)
    return HttpResponse.json({
      status: 200,
      data: {
        period_label: `por ${groupBy}`,
        data: groups,
        total: enviados,
        enviados,
        respondidos,
        tasa_respuesta: 82,
        responded: [],
      },
    })
  }),

  // ═══ SUBSCRIPTIONS ══════════════════════════════════════════════
  http.get('*/admin/reports/subscriptions', ({ request }) => {
    const url = new URL(request.url)
    const groupBy = url.searchParams.get('group_by') || 'month'

    const groups: SummaryRow[] = groupBy === 'plan'
      ? programs.map(p => ({ label: p, value: [45, 38, 32, 27][programs.indexOf(p)] }))
      : groupBy === 'gym'
        ? gyms.map(g => ({
            label: g,
            value: [42, 35, 28, 37][gyms.indexOf(g)],
          }))
        : [
            { label: 'Enero', value: 105 },
            { label: 'Febrero', value: 112 },
            { label: 'Marzo', value: 118 },
            { label: 'Abril', value: 125 },
            { label: 'Mayo', value: 130 },
            { label: 'Junio', value: 135 },
            { label: 'Julio', value: 142 },
            { label: 'Agosto', value: 142 },
          ]

    return HttpResponse.json({
      status: 200,
      data: {
        period_label: `por ${groupBy}`,
        data: groups,
        total: 142,
        ingresos: 32400,
        rows: sessions.filter(s => s.status === 'completed').slice(0, 50),
      },
    })
  }),

  // ═══ COACHING METRICS ══════════════════════════════════════════
  http.get('*/admin/reports/coaching-metrics', () => {
    const metrics: CoachMetric[] = coaches.map((c, i) => ({
      coach_id: c.id,
      coach_name: c.name,
      total_clientes: [30, 24, 18, 21][i],
      clientes_activos: [27, 20, 15, 18][i],
      pct_con_plan: [90, 83, 87, 76][i],
      pct_completan_80: [73, 68, 75, 62][i],
    }))

    return HttpResponse.json({
      status: 200,
      data: {
        metrics,
        totals: {
          total_clientes: 142,
          clientes_activos: 115,
          pct_con_plan_promedio: 84,
          pct_completan_80_promedio: 69.5,
        },
      },
    })
  }),

  // ═══ EXPORT CSV ═════════════════════════════════════════════════
  http.get('*/admin/reports/export', ({ request }) => {
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'users'

    const csv =
      type === 'users'
        ? 'Nombre,Gimnasio,Coach,Programa,Fecha Registro\n'
          + clients.map(c => `${c.name},${c.gym},${c.coach_name},${c.program},${c.registered_at}`).join('\n')
        : type === 'sessions'
          ? 'Fecha,Cliente,Coach,Tipo,Estado,Duración (min),Gimnasio\n'
            + sessions.slice(0, 50).map(s => `${s.date},${s.client},${s.coach},${s.type},${s.status},${s.duration_min},${s.gym}`).join('\n')
          : type === 'subscriptions'
            ? 'Cliente,Plan,Importe,Estado\n'
              + sessions.filter(s => s.status === 'completed').slice(0, 30)
                  .map(s => `${s.client},${s.subscription},${s.payment_amount},${s.subscription_status}`).join('\n')
            : 'Coach,Clientes Activos,% Con Plan,% Completan ≥80%\n'
              + coaches.map(c => `${c.name},${randomBetween(15, 30)},${randomBetween(70, 95)},${randomBetween(55, 80)}`).join('\n')

    return new HttpResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=reporte-${type}.csv`,
      },
    })
  }),

  // ═══ PAYMENTS SUMMARY ═══════════════════════════════════════════
  http.get('*/admin/reports/payments', ({ request }) => {
    const url = new URL(request.url)
    const groupBy = url.searchParams.get('group_by') || 'month'

    const groups: SummaryRow[] = groupBy === 'month'
      ? [
          { label: 'Enero', value: monthIdx >= 0 ? 4500 : 0 },
          { label: 'Febrero', value: monthIdx >= 1 ? 5200 : 0 },
          { label: 'Marzo', value: monthIdx >= 2 ? 6100 : 0 },
          { label: 'Abril', value: monthIdx >= 3 ? 5800 : 0 },
          { label: 'Mayo', value: monthIdx >= 4 ? 7200 : 0 },
          { label: 'Junio', value: monthIdx >= 5 ? 8100 : 0 },
          { label: 'Julio', value: monthIdx >= 6 ? 9400 : 0 },
        ].filter(g => g.value > 0)
      : [
          { label: 'Premium', value: 12400 },
          { label: 'Básico', value: 8600 },
          { label: 'Pro', value: 7200 },
          { label: 'Elite', value: 5200 },
        ]

    return HttpResponse.json({
      status: 200,
      data: {
        period_label: `por ${groupBy}`,
        data: groups,
        total: 33400,
        rows: sessions.filter(s => s.status === 'completed').slice(0, 30),
      },
    })
  }),
]
