import { describe, expect, it } from 'vitest'
import { benchmarkLabel, benchmarkScoreKind, benchmarkTitle, benchmarkValue, formatDiff, hasConditioningData, normalizeComparison, normalizeConditioningStats } from './conditioningStats'

describe('normalizeConditioningStats', () => {
  it('acepta {success, data} y ordena benchmarks por fecha', () => {
    const s = normalizeConditioningStats({
      success: true,
      data: {
        weeks: 2,
        weekly_km: [{ week_start: '2026-09-21', km: 10.5 }, { week_start: '2026-09-28', km: '4' }],
        weekly_minutes: [{ week_start: '2026-09-21', minutes: 40 }],
        avg_pace_sec_km: 300,
        conditioning_minutes: 40,
        results_count: 3,
        benchmarks: { row_1000: [{ performed_date: '2026-09-30', time_sec: 230 }, { performed_date: '2026-09-01', time_sec: 240 }], vacio: [] },
      },
    })!
    expect(s.total_km).toBe(14.5)
    expect(s.weekly_km[1].km).toBe(4)
    expect(s.benchmarks.row_1000.map(e => e.time_sec)).toEqual([240, 230])
    expect(s.benchmarks.vacio).toBeUndefined()
    expect(hasConditioningData(s)).toBe(true)
  })
  it('vacío o basura', () => {
    expect(normalizeConditioningStats(null)).toBeNull()
    expect(normalizeConditioningStats({ data: [] })).toBeNull()
    const empty = normalizeConditioningStats({ data: {} })
    expect(empty?.weekly_km).toEqual([])
    expect(hasConditioningData(empty)).toBe(false)
  })
})

describe('benchmarks', () => {
  it('tipo de marca y valor', () => {
    expect(benchmarkScoreKind([{ performed_date: 'x', score_type: 'rounds_reps', rounds: 5 }])).toBe('rounds')
    expect(benchmarkScoreKind([{ performed_date: 'x', score_type: 'time', time_sec: 90 }])).toBe('time')
    expect(benchmarkValue({ performed_date: 'x', rounds: 5, extra_reps: 12 }, 'rounds')).toBe(5.12)
    expect(benchmarkValue({ performed_date: 'x', time_sec: 1421 }, 'time')).toBe(1421)
  })
  it('etiquetas', () => {
    expect(benchmarkLabel({ performed_date: 'x', rounds: 5, extra_reps: 12 })).toBe('5 + 12')
    expect(benchmarkLabel({ performed_date: 'x', time_sec: 1421 })).toBe('23:41')
    expect(benchmarkLabel({ performed_date: 'x', time_sec: 1500, capped: true })).toBe('25:00 (límite)')
    expect(benchmarkLabel({ performed_date: 'x', distance_m: 5000, time_sec: 1450 })).toBe('5 km en 24:10')
    expect(benchmarkTitle('hyrox_full_sim')).toBe('Hyrox full sim')
  })
})

describe('fase 2: comparación y nuevos campos', () => {
  it('normaliza ritmo semanal, zonas y último simulacro', () => {
    const s = normalizeConditioningStats({
      data: {
        weekly_km: [],
        weekly_pace: [{ week_start: '2026-09-28', pace_sec_km: '300' }, { week_start: '2026-10-05', pace_sec_km: null }],
        pace_change_sec_km: -12.5,
        hr_max_estimate: 187,
        hr_zone_minutes: [{ zone: 2, minutes: 30 }, { zone: 9, minutes: 1 }],
        last_simulation: {
          benchmark_key: 'hyrox_full_sim',
          current: { performed_date: '2026-10-01', time_sec: 4000 },
          previous: null,
          total_diff_sec: null,
          splits: [{ label: 'Carrera', t_sec: 300, is_run: true }, { t_sec: '400' }],
        },
      },
    })!
    expect(s.weekly_pace[0].pace_sec_km).toBe(300)
    expect(s.weekly_pace[1].pace_sec_km).toBeNull()
    expect(s.pace_change_sec_km).toBe(-12.5)
    expect(s.hr_zone_minutes).toEqual([{ zone: 2, minutes: 30 }])
    expect(s.last_simulation?.splits[1]).toMatchObject({ index: 1, label: 'Paso 2', t_sec: 400, previous_t_sec: null, is_run: false })
  })
  it('backend sin fase 2: valores vacíos', () => {
    const s = normalizeConditioningStats({ data: { weekly_km: [] } })!
    expect(s.weekly_pace).toEqual([])
    expect(s.hr_zone_minutes).toBeNull()
    expect(s.last_simulation).toBeNull()
    expect(normalizeComparison(null)).toBeNull()
  })
  it('formatDiff', () => {
    expect(formatDiff(-12)).toBe('−0:12')
    expect(formatDiff(65)).toBe('+1:05')
    expect(formatDiff(0)).toBe('=')
    expect(formatDiff(null)).toBe('')
  })
})
