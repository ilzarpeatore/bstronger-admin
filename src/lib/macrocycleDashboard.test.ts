import { describe, expect, it } from 'vitest'

import {
  cargaKind,
  computeBuckets,
  formatWeeks,
  techniquesByMeso,
  muscleSetsPerWeek,
  musclesOf,
  parseNumeric,
  rangeStatus,
  statAvg,
  type PlanData,
  type PlanRow,
} from './macrocycleDashboard'

const row = (assignment_id: number, muscle: string | null, p: Partial<PlanRow>): PlanRow => ({
  assignment_id,
  exercise_id: 1,
  exercise_title: 'Ej',
  block_title: null,
  muscle,
  series: null,
  reps: null,
  rir: null,
  rpe: null,
  carga: null,
  carga_pct: null,
  descanso: null,
  ...p,
})

// M1: semana 1 (2 sesiones) y semana 2 (descarga). M2: semana 1.
const data: PlanData = {
  programs: [
    { id: 10, title: 'Macro - Mesociclo 1', mesocycle_number: 1, num_weeks: 2 },
    { id: 20, title: 'Macro - Mesociclo 2', mesocycle_number: 2, num_weeks: 1 },
  ],
  sessions: [
    { assignment_id: 1, program_id: 10, week: 1, day: 1, is_deload: false, session: 'Torso' },
    { assignment_id: 2, program_id: 10, week: 1, day: 3, is_deload: false, session: 'Pierna' },
    { assignment_id: 3, program_id: 10, week: 2, day: 1, is_deload: true, session: 'Torso' },
    { assignment_id: 4, program_id: 20, week: 1, day: 1, is_deload: false, session: 'Torso' },
  ],
  rows: [
    row(1, 'Dorsales', { series: '4', reps: '8-10', rir: '2', carga: 'Subir' }),
    row(1, 'Pecho', { series: '3', reps: '12', rpe: '8', carga: 'Mantener' }),
    row(2, 'Cuádriceps', { series: '5', reps: '6', rir: '1', carga: '80' }),
    row(3, 'Dorsales', { series: '2', reps: '12', rir: '3', carga: 'Bajar' }),
    row(4, 'Dorsales', { series: '6', reps: '10', rir: '0-1' }),
  ],
  muscle_splits: {
    Dorsales: { Dorsales: 1, 'Bíceps': 0.7 },
    Pecho: { Pecho: 1 },
    'Cuádriceps': { 'Cuádriceps': 1 },
  },
  skipped_ids: [],
}

describe('parseNumeric', () => {
  it.each([
    ['3', 3],
    ['8-10', 9],
    ['7,5', 7.5],
    ['3→2→1→FALLO', 1.5],
    ['Fallo', 0],
    ['AMRAP', null],
    [null, null],
  ])('%s → %s', (input, expected) => {
    expect(parseNumeric(input)).toBe(expected)
  })
})

describe('cargaKind', () => {
  it.each([
    ['Subir', 'subir'],
    ['subir 2,5 kg', 'subir'],
    ['+5%', 'subir'],
    ['Mantener', 'mantener'],
    ['Bajar', 'bajar'],
    ['-30%', 'bajar'],
    ['80', 'fija'],
    ['', 'sin'],
    [null, 'sin'],
  ] as const)('%s → %s', (input, expected) => {
    expect(cargaKind(input)).toBe(expected)
  })

  it('un % de carga sin indicación cuenta como fija', () => {
    expect(cargaKind(null, '75')).toBe('fija')
  })
})

describe('computeBuckets', () => {
  it('semana a semana: una columna por semana y mesociclo, en orden', () => {
    const b = computeBuckets(data, 'week', [10, 20])
    expect(b.map(x => x.label)).toEqual(['M1 S1', 'M1 S2', 'M2 S1'])
    expect(b.map(x => x.totalSets)).toEqual([12, 2, 6])
    expect(b.map(x => x.sessions)).toEqual([2, 1, 1])
    expect(b.map(x => x.isDeload)).toEqual([false, true, false])
  })

  it('por mesociclo: series por semana es la media de sus semanas', () => {
    const [m1, m2] = computeBuckets(data, 'meso', [10, 20])
    expect(m1.label).toBe('M1')
    expect(m1.weeks).toBe(2)
    expect(m1.deloadWeeks).toBe(1)
    expect(m1.totalSets).toBe(14)
    expect(m1.setsPerWeek).toBe(7)
    expect(muscleSetsPerWeek(m1, 'Dorsales', 'direct')).toBe(3)
    expect(m2.setsPerWeek).toBe(6)
  })

  it('macrociclo entero y solo los mesociclos seleccionados', () => {
    const [all] = computeBuckets(data, 'macro', [10, 20])
    expect(all.label).toBe('Macrociclo')
    expect(all.weeks).toBe(3)
    expect(all.totalSets).toBe(20)

    const [onlyM2] = computeBuckets(data, 'macro', [20])
    expect(onlyM2.totalSets).toBe(6)
    expect(onlyM2.weeks).toBe(1)
  })

  it('series indirectas reparten al músculo secundario', () => {
    const [m1] = computeBuckets(data, 'meso', [10])
    expect(m1.directSets['Bíceps']).toBeUndefined()
    expect(m1.indirectSets['Bíceps']).toBeCloseTo(0.7 * 6)
    expect(m1.indirectSets['Dorsales']).toBe(6)
  })

  it('RIR y RPE por separado, ponderados por series', () => {
    const [w1] = computeBuckets(data, 'week', [10])
    // RIR: dorsales 2 (4 series) y cuádriceps 1 (5 series) → (8 + 5) / 9
    expect(statAvg(w1.rir)).toBeCloseTo(13 / 9)
    expect(statAvg(w1.rpe)).toBe(8)
    expect(w1.carga).toEqual({ subir: 1, mantener: 1, bajar: 0, fija: 1, sin: 0 })
  })

  it('musclesOf ordena por volumen', () => {
    const buckets = computeBuckets(data, 'macro', [10, 20])
    expect(musclesOf(buckets, 'direct')).toEqual(['Dorsales', 'Cuádriceps', 'Pecho'])
  })
})

describe('rangeStatus', () => {
  const ref = { mev: 8, mrv: 18 }
  it.each([
    [6, 'low'],
    [8, 'ok'],
    [18, 'ok'],
    [19, 'high'],
  ] as const)('%s → %s', (v, expected) => {
    expect(rangeStatus(v, ref)).toBe(expected)
  })
  it('sin referencia → null', () => {
    expect(rangeStatus(5, undefined)).toBeNull()
  })
})

describe('técnicas por mesociclo', () => {
  const withTech: PlanData = {
    ...data,
    rows: [
      ...data.rows,
      row(1, 'Deltoides lateral', { exercise_title: 'Elevación lateral', series: '3', tecnica: 'rest_pause', tecnica_series: 'ultima' }),
      row(3, 'Deltoides lateral', { exercise_title: 'Elevación lateral', series: '2', tecnica: 'rest_pause', tecnica_series: 'ultima' }),
      row(2, 'Cuádriceps', { exercise_title: 'Prensa', tecnica: 'otra', tecnica_otra: 'Pausa abajo' }),
      row(4, 'Dorsales', { exercise_title: 'Remo', tecnica: 'drop_sets' }),
    ],
  }

  it('agrupa por mesociclo y técnica con sus semanas, ejercicios y alcance', () => {
    const uses = techniquesByMeso(withTech, [10, 20])
    expect(uses.map(u => [u.meso, u.key, u.otra, formatWeeks(u.weeks)])).toEqual([
      ['M1', 'otra', 'Pausa abajo', 'S1'],
      ['M1', 'rest_pause', null, 'S1-S2'],
      ['M2', 'drop_sets', null, 'S1'],
    ])
    const rp = uses.find(u => u.key === 'rest_pause')!
    expect(rp.exercises).toEqual(['Elevación lateral'])
    expect(rp.muscles).toEqual(['Deltoides lateral'])
    expect([rp.allSets, rp.lastSet]).toEqual([0, 2])
  })

  it('respeta los mesociclos seleccionados', () => {
    expect(techniquesByMeso(withTech, [20]).map(u => u.key)).toEqual(['drop_sets'])
  })

  it('formatWeeks comprime semanas seguidas', () => {
    expect(formatWeeks([5, 1, 2, 3])).toBe('S1-S3, S5')
    expect(formatWeeks([4])).toBe('S4')
    expect(formatWeeks([])).toBe('')
  })
})
