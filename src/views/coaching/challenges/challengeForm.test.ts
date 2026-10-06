import { describe, expect, it } from 'vitest'
import {
  applyMetric,
  buildEvolution,
  emptyForm,
  filterInvitable,
  formFromChallenge,
  formatValue,
  groupByTab,
  metricHelp,
  progressPct,
  sortParticipants,
  stepOfError,
  toClientOption,
  toPayload,
  todayMadrid,
  unwrapList,
  validateChallengeForm,
  type Challenge,
  type ChallengeFormValues,
  type ChallengeMetric,
  type ChallengeParticipant,
} from './challengeForm'

const METRICS: ChallengeMetric[] = [
  { key: 'sessions', label: 'Sesiones', unit: 'sesiones', formats: ['threshold', 'leaderboard'], params: [] },
  { key: 'adherence_pct', label: 'Adherencia', unit: '%', formats: ['threshold', 'leaderboard'], params: [] },
  { key: 'steps_goal_days', label: 'Días con meta de pasos', unit: 'días', formats: ['threshold', 'leaderboard'], params: [{ key: 'goal', label: 'Meta', type: 'number' }] },
  { key: 'habit_days', label: 'Días de hábito', unit: 'días', formats: ['threshold'], params: [{ key: 'habit_template_id', label: 'Hábito', type: 'habit_template' }] },
  { key: 'benchmark_best', label: 'Benchmark', unit: 's', formats: ['threshold', 'leaderboard'], params: [{ key: 'benchmark_key', type: 'benchmark' }], description: 'Desde el catálogo' },
]

const TODAY = '2026-10-05'

const valid = (over: Partial<ChallengeFormValues> = {}): ChallengeFormValues => ({
  ...emptyForm(),
  title: 'Reto de octubre',
  metric_key: 'sessions',
  format: 'threshold',
  threshold_value: '12',
  start_date: '2026-10-10',
  end_date: '2026-11-10',
  ...over,
})

const publish = (v: ChallengeFormValues, extra: Partial<Parameters<typeof validateChallengeForm>[1]> = {}) =>
  validateChallengeForm(v, { metrics: METRICS, today: TODAY, mode: 'publish', ...extra })

describe('validateChallengeForm', () => {
  it('acepta un reto abierto completo', () => {
    expect(publish(valid())).toEqual({})
  })

  it('en borrador solo exige el título', () => {
    const errs = validateChallengeForm({ ...emptyForm(), title: 'Borrador' }, { metrics: METRICS, today: TODAY, mode: 'draft' })
    expect(errs).toEqual({})
    expect(validateChallengeForm(emptyForm(), { metrics: METRICS, today: TODAY, mode: 'draft' })).toHaveProperty('title')
  })

  it('al publicar exige métrica, objetivo y fechas', () => {
    const errs = publish({ ...emptyForm(), title: 'Algo' })
    expect(errs).toMatchObject({ metric_key: expect.any(String), threshold_value: expect.any(String), start_date: expect.any(String), end_date: expect.any(String) })
  })

  it('valida título, URL de portada y premio', () => {
    expect(publish(valid({ title: 'ab' })).title).toBeTruthy()
    expect(publish(valid({ title: 'x'.repeat(121) })).title).toBeTruthy()
    expect(publish(valid({ cover_url: 'no es url' })).cover_url).toBeTruthy()
    expect(publish(valid({ cover_url: 'ftp://x.com/a.png' })).cover_url).toBeTruthy()
    expect(publish(valid({ cover_url: 'https://cdn.x.com/a.png' })).cover_url).toBeUndefined()
    expect(publish(valid({ prize: 'p'.repeat(256) })).prize).toBeTruthy()
  })

  it('rechaza formato no permitido por la métrica (hábitos solo objetivo)', () => {
    const errs = publish(valid({ metric_key: 'habit_days', format: 'leaderboard', metric_params: { habit_template_id: '4' } }))
    expect(errs.format).toMatch(/solo admite formato objetivo/)
  })

  it('el ranking no necesita objetivo', () => {
    expect(publish(valid({ format: 'leaderboard', threshold_value: '' }))).toEqual({})
  })

  it('objetivo mayor que 0 y adherencia ≤ 100', () => {
    expect(publish(valid({ threshold_value: '0' })).threshold_value).toBeTruthy()
    expect(publish(valid({ threshold_value: 'abc' })).threshold_value).toBeTruthy()
    expect(publish(valid({ metric_key: 'adherence_pct', threshold_value: '120' })).threshold_value).toMatch(/100/)
    expect(publish(valid({ metric_key: 'adherence_pct', threshold_value: '85,5' })).threshold_value).toBeUndefined()
  })

  it('valida parámetros de la métrica', () => {
    expect(publish(valid({ metric_key: 'steps_goal_days' }))['param.goal']).toBe('Obligatorio')
    expect(publish(valid({ metric_key: 'steps_goal_days', metric_params: { goal: '-5' } }))['param.goal']).toBeTruthy()
    expect(publish(valid({ metric_key: 'steps_goal_days', metric_params: { goal: '8000' } }))).toEqual({})
    expect(publish(valid({ metric_key: 'benchmark_best', metric_params: { benchmark_key: 'Hyrox Sim!' } }))['param.benchmark_key']).toBeTruthy()
    expect(publish(valid({ metric_key: 'benchmark_best', metric_params: { benchmark_key: 'hyrox_sim' } }))).toEqual({})
  })

  it('métrica desconocida', () => {
    expect(publish(valid({ metric_key: 'volume_kg' })).metric_key).toBe('Métrica desconocida')
  })

  it('fechas: fin ≥ inicio, inicio no en el pasado salvo que no cambie', () => {
    expect(publish(valid({ end_date: '2026-10-09' })).end_date).toBeTruthy()
    expect(publish(valid({ start_date: '2026-10-01' })).start_date).toMatch(/pasado/)
    expect(publish(valid({ start_date: '2026-10-01' }), { originalStartDate: '2026-10-01' }).start_date).toBeUndefined()
    expect(publish(valid({ start_date: TODAY }))).toEqual({})
    expect(publish(valid({ start_date: '2026-13-01' })).start_date).toBe('Fecha no válida')
  })

  it('fecha límite de inscripción ≤ fin y no pasada', () => {
    expect(publish(valid({ join_deadline: '2026-11-11' })).join_deadline).toBeTruthy()
    expect(publish(valid({ join_deadline: '2026-10-01' })).join_deadline).toBe('Ya ha pasado')
    expect(publish(valid({ join_deadline: '2026-10-20' }))).toEqual({})
    expect(publish(valid({ join_deadline: '2026-10-01' }), { originalJoinDeadline: '2026-10-01' }).join_deadline).toBeUndefined()
  })

  it('mínimo y máximo de participantes', () => {
    expect(publish(valid({ min_participants: '1' })).min_participants).toBeTruthy()
    expect(publish(valid({ min_participants: '' })).min_participants).toBeTruthy()
    expect(publish(valid({ min_participants: '5', max_participants: '4' })).max_participants).toBeTruthy()
    expect(publish(valid({ max_participants: '2.5' })).max_participants).toBeTruthy()
    expect(publish(valid({ min_participants: '3', max_participants: '10' }))).toEqual({})
  })

  it('cerrado: exige invitados y respeta el máximo', () => {
    expect(publish(valid({ visibility: 'closed' })).invites).toBeTruthy()
    expect(publish(valid({ visibility: 'closed' }), { inviteCount: 4 })).toEqual({})
    expect(publish(valid({ visibility: 'closed', max_participants: '3' }), { inviteCount: 4 }).invites).toMatch(/máximo es 3/)
  })
})

describe('stepOfError', () => {
  it('mapea campos a pasos', () => {
    expect(stepOfError('title')).toBe(0)
    expect(stepOfError('param.goal')).toBe(1)
    expect(stepOfError('threshold_value')).toBe(1)
    expect(stepOfError('end_date')).toBe(2)
    expect(stepOfError('max_participants')).toBe(2)
    expect(stepOfError('invites')).toBe(3)
  })
})

describe('applyMetric / toPayload', () => {
  it('cambiar a métrica solo-objetivo fuerza threshold y limpia params', () => {
    const v = applyMetric(valid({ format: 'leaderboard', metric_params: { goal: '9000' } }), METRICS[3])
    expect(v.format).toBe('threshold')
    expect(v.metric_params).toEqual({})
    expect(v.metric_key).toBe('habit_days')
  })

  it('serializa con tipos y nulls', () => {
    const v = valid({ metric_key: 'steps_goal_days', metric_params: { goal: '8000', basura: 'x' }, description: '  ', library_program_id: '7', max_participants: '' })
    const p = toPayload(v, METRICS[2], 'scheduled')
    expect(p).toMatchObject({
      title: 'Reto de octubre', description: null, cover_url: null, prize: null,
      metric_params: { goal: 8000 }, threshold_value: 12, library_program_id: 7,
      min_participants: 3, max_participants: null, join_deadline: null, status: 'scheduled', paid_only: false,
    })
  })

  it('ranking manda threshold_value null; benchmark se queda en texto', () => {
    const p = toPayload(valid({ metric_key: 'benchmark_best', format: 'leaderboard', metric_params: { benchmark_key: 'hyrox_sim' } }), METRICS[4], 'draft')
    expect(p.threshold_value).toBeNull()
    expect(p.metric_params).toEqual({ benchmark_key: 'hyrox_sim' })
  })

  it('formFromChallenge ida y vuelta', () => {
    const c: Challenge = {
      id: 1, title: 'T', description: null, cover_url: null, prize: 'Camiseta', visibility: 'closed', metric_key: 'steps_goal_days',
      metric_params: { goal: 8000 }, format: 'threshold', threshold_value: 20, start_date: '2026-10-10', end_date: '2026-11-10T00:00:00Z',
      join_deadline: null, status: 'draft', paid_only: true, library_program_id: null, min_participants: 3, max_participants: 12,
    }
    const f = formFromChallenge(c)
    expect(f).toMatchObject({ prize: 'Camiseta', visibility: 'closed', metric_params: { goal: '8000' }, threshold_value: '20', end_date: '2026-11-10', paid_only: true, max_participants: '12', library_program_id: '' })
  })
})

describe('listas y clientes', () => {
  it('agrupa por pestaña (cancelados en Cerrados)', () => {
    const mk = (id: number, status: Challenge['status']) => ({ id, status }) as Challenge
    const g = groupByTab([mk(1, 'draft'), mk(2, 'active'), mk(3, 'cancelled'), mk(4, 'closed'), mk(5, 'finalizing')])
    expect(g.draft.map(c => c.id)).toEqual([1])
    expect(g.closed.map(c => c.id)).toEqual([3, 4])
    expect(g.finalizing.map(c => c.id)).toEqual([5])
  })

  it('filterInvitable: solo activos, sin ya invitados, búsqueda sin tildes', () => {
    const clients = [
      toClientOption({ id: 1, first_name: 'José', last_name: 'Pérez', email: 'jose@x.com', status: 'active', user_type: 'user' }),
      toClientOption({ id: 2, name: 'Ana', email: 'ana@x.com', status: 'inactive' }),
      toClientOption({ id: 3, name: 'Admin', email: 'a@x.com', status: 'active', user_type: 'admin' }),
      toClientOption({ id: 4, name: 'Pepe', email: 'pepe@x.com', status: 'active' }),
    ]
    expect(filterInvitable(clients, '', []).map(c => c.id)).toEqual([1, 4])
    expect(filterInvitable(clients, 'jose perez', []).map(c => c.id)).toEqual([1])
    expect(filterInvitable(clients, 'PEPE@', []).map(c => c.id)).toEqual([4])
    expect(filterInvitable(clients, '', [4]).map(c => c.id)).toEqual([1])
  })

  it('unwrapList acepta array, {data} y paginado', () => {
    expect(unwrapList([1])).toEqual([1])
    expect(unwrapList({ success: true, data: [2] })).toEqual([2])
    expect(unwrapList({ data: { data: [3] } })).toEqual([3])
    expect(unwrapList(null)).toEqual([])
  })

  it('metricHelp usa la descripción del catálogo o la local', () => {
    expect(metricHelp(METRICS[4])).toBe('Desde el catálogo')
    expect(metricHelp(METRICS[3])).toMatch(/botón/)
    expect(metricHelp(undefined)).toBe('')
  })
})

describe('detalle', () => {
  const p = (client_id: number, status: ChallengeParticipant['status'], rank: number | null, name = `C${client_id}`): ChallengeParticipant =>
    ({ client_id, name, alias: null, status, rank, current_value: 0 })

  it('ordena unidos por puesto y luego el resto', () => {
    const out = sortParticipants([p(1, 'excluded', 1), p(2, 'joined', null), p(3, 'invited', null), p(4, 'joined', 2), p(5, 'joined', 1)])
    expect(out.map(x => x.client_id)).toEqual([5, 4, 2, 3, 1])
  })

  it('progressPct: usa backend, si no calcula y recorta', () => {
    expect(progressPct({ progress_pct: 140, current_value: 0 }, { format: 'threshold', threshold_value: 10 })).toBe(100)
    expect(progressPct({ current_value: 5 }, { format: 'threshold', threshold_value: 20 })).toBe(25)
    expect(progressPct({ current_value: 5 }, { format: 'leaderboard', threshold_value: null })).toBeNull()
  })

  it('formatValue', () => {
    expect(formatValue(null)).toBe('—')
    expect(formatValue(85.5, '%')).toBe('85,5 %')
    expect(formatValue(125, 's')).toBe('2:05')
    expect(formatValue('12', 'sesiones')).toBe('12 sesiones')
  })

  it('buildEvolution: top N unidos, filas por fecha ordenadas, huecos a null', () => {
    const parts = [p(1, 'joined', 2), p(2, 'joined', 1), p(3, 'excluded', null), p(4, 'joined', 3)]
    const snaps = [
      { client_id: 1, snapshot_date: '2026-10-02', value: 3 },
      { client_id: 2, snapshot_date: '2026-10-01', value: 1 },
      { client_id: 2, snapshot_date: '2026-10-02', value: '4' },
      { client_id: 3, snapshot_date: '2026-10-02', value: 9 },
      { client_id: 4, snapshot_date: '2026-10-02', value: 1 },
    ]
    const { data, series } = buildEvolution(snaps, parts, 2)
    expect(series.map(s => s.client_id)).toEqual([2, 1])
    expect(data).toEqual([
      { date: '2026-10-01', c2: 1, c1: null },
      { date: '2026-10-02', c2: 4, c1: 3 },
    ])
    expect(buildEvolution(undefined, parts)).toEqual({ data: [], series: [] })
  })

  it('todayMadrid usa la zona de Madrid', () => {
    expect(todayMadrid(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05')
  })
})
