import { describe, expect, it } from 'vitest'
import {
  blockKindSummary,
  cleanParams,
  formatDistance,
  formatDuration,
  formatPace,
  isConditioningKind,
  normalizeKind,
  paramsForKindChange,
  parseDistance,
  parseDuration,
} from './blockKinds'

describe('formatDuration', () => {
  it('segundos → m:ss / h:mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(1200)).toBe('20:00')
    expect(formatDuration(3723)).toBe('1:02:03')
    expect(formatDuration(null)).toBe('')
    expect(formatDuration(undefined)).toBe('')
    expect(formatDuration(NaN)).toBe('')
  })
})

describe('parseDuration', () => {
  it('formatos con dos puntos', () => {
    expect(parseDuration('1:30')).toBe(90)
    expect(parseDuration('01:30')).toBe(90)
    expect(parseDuration('20:00')).toBe(1200)
    expect(parseDuration('1:02:03')).toBe(3723)
    expect(parseDuration(' 0:45 ')).toBe(45)
  })
  it('número sin unidad según bareUnit', () => {
    expect(parseDuration('90')).toBe(90)
    expect(parseDuration('20', 'min')).toBe(1200)
    expect(parseDuration('1,5', 'min')).toBe(90)
    expect(parseDuration(300)).toBe(300)
  })
  it('unidades explícitas', () => {
    expect(parseDuration('20s')).toBe(20)
    expect(parseDuration("12'")).toBe(720)
    expect(parseDuration('5min')).toBe(300)
    expect(parseDuration('1h')).toBe(3600)
  })
  it('vacío o inválido → null', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('   ')).toBeNull()
    expect(parseDuration(null)).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('1:75')).toBeNull()
    expect(parseDuration('1::2')).toBeNull()
    expect(parseDuration('-5')).toBeNull()
  })
  it('ida y vuelta', () => {
    for (const s of [0, 7, 59, 60, 61, 599, 3599, 3600, 14400]) expect(parseDuration(formatDuration(s))).toBe(s)
  })
})

describe('distancia y ritmo', () => {
  it('parseDistance', () => {
    expect(parseDistance('800')).toBe(800)
    expect(parseDistance('800 m')).toBe(800)
    expect(parseDistance('5km')).toBe(5000)
    expect(parseDistance('5,5 km')).toBe(5500)
    expect(parseDistance('')).toBeNull()
    expect(parseDistance('lejos')).toBeNull()
  })
  it('formatDistance / formatPace', () => {
    expect(formatDistance(800)).toBe('800 m')
    expect(formatDistance(5000)).toBe('5 km')
    expect(formatDistance(1500)).toBe('1,5 km')
    expect(formatPace(285)).toBe('4:45/km')
    expect(formatPace(null)).toBe('')
  })
})

describe('tipos', () => {
  it('normalizeKind / isConditioningKind', () => {
    expect(normalizeKind(null)).toBe('normal')
    expect(normalizeKind('raro')).toBe('normal')
    expect(normalizeKind('emom')).toBe('emom')
    expect(isConditioningKind('amrap')).toBe(true)
    expect(isConditioningKind('carrera')).toBe(true)
    expect(isConditioningKind('circuito')).toBe(false)
    expect(isConditioningKind(undefined)).toBe(false)
  })
  it('paramsForKindChange conserva benchmark_key', () => {
    expect(paramsForKindChange('amrap', { interval_sec: 60, benchmark_key: 'row_1000' })).toEqual({ duration_sec: 600, benchmark_key: 'row_1000' })
    expect(paramsForKindChange('normal', { rounds: 3 })).toBeNull()
    expect(paramsForKindChange('superserie', null)).toBeNull()
  })
  it('cleanParams quita vacíos', () => {
    expect(cleanParams({ rounds: 3, time_cap_sec: undefined, benchmark_key: '' })).toEqual({ rounds: 3 })
    expect(cleanParams({ rounds: NaN })).toBeNull()
    expect(cleanParams(null)).toBeNull()
  })
})

describe('blockKindSummary', () => {
  it('normal no tiene resumen', () => {
    expect(blockKindSummary(null, null, 3)).toBeNull()
    expect(blockKindSummary('normal', null, 3)).toBeNull()
  })
  it('EMOM', () => {
    expect(blockKindSummary('emom', { interval_sec: 60, rounds: 12 }, 3)).toBe("EMOM 12' · 3 ejercicios")
    expect(blockKindSummary('emom', { interval_sec: 120, rounds: 6 }, 2)).toBe("E2MOM 12' · 2 ejercicios")
    expect(blockKindSummary('emom', { interval_sec: 90, rounds: 4 })).toBe('EMOM cada 1:30 6\'')
  })
  it('AMRAP / For Time', () => {
    expect(blockKindSummary('amrap', { duration_sec: 1200 }, 1)).toBe("AMRAP 20' · 1 ejercicio")
    expect(blockKindSummary('for_time', { rounds: 3, time_cap_sec: 1500 }, 4)).toBe("For Time 3 rondas · límite 25' · 4 ejercicios")
    expect(blockKindSummary('for_time', { rounds: 1 })).toBe('For Time')
  })
  it('Intervalos y Tabata', () => {
    expect(blockKindSummary('intervalos', { work_sec: 20, rest_sec: 10, rounds: 8 }, 1)).toBe('Tabata 20/10 × 8 · 1 ejercicio')
    expect(blockKindSummary('intervalos', { work_sec: 40, rest_sec: 20, rounds: 10, sets: 3 })).toBe('Intervalos 40/20 × 10 · 3 series')
  })
  it('Carrera', () => {
    expect(blockKindSummary('carrera', { mode: 'continua', target_distance_m: 5000, target_pace_sec_km: 300 })).toBe('Carrera 5 km · @ 5:00/km')
    expect(blockKindSummary('carrera', { mode: 'intervalos', reps: 6, target_distance_m: 800, recovery_sec: 90 })).toBe('Carrera 6 × 800 m · rec 1:30')
    expect(blockKindSummary('carrera', { mode: 'continua' })).toBe('Carrera')
  })
  it('Superserie / Circuito', () => {
    expect(blockKindSummary('superserie', { rounds: 4 }, 2)).toBe('Superserie × 4 rondas · 2 ejercicios')
    expect(blockKindSummary('circuito', null, 5)).toBe('Circuito · 5 ejercicios')
  })
})
