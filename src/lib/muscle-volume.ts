// Reparto del volumen de cada serie entre los musculos implicados, segun la
// activacion muscular medida por estudios EMG (%MVIC). El musculo primario
// recibe el 100% del volumen (multiplicador 1) y los secundarios una fraccion.
// Los valores iniciales se han basado en:
//   - Dickie et al. 2017 (pull-ups): biceps ~80-95% MVIC, braquiorradial 90-97%.
//   - Mayo Clinic suspension rows (PMC7734360): trapecios 43-94%, deltoides
//     posterior 45-88%, dorsal 12-48%.
//   - Contreras et al. 2015 (hip thrust vs squat) y revisión sistematica del
//     deadlift (PMC7046193).
//   - Inara/EMG squat synthesis: cuadriceps 82-88%, gluteo mayor 75%, isquios
//     42%, gemelos 38%, lumbar 55%.

type VolumeRule = {
  match: string[]
  multipliers: Record<string, number>
}

const RULES: VolumeRule[] = [
  {
    match: ['dorsales', 'dorsal', 'lat', 'lats', 'latissimus'],
    multipliers: {
      'Bíceps': 0.7,
      'Antebrazo': 0.6,
      'Trapecios': 0.3,
      'Deltoides posterior': 0.3,
      'Espalda alta': 0.4,
      'Lumbar': 0.2,
    },
  },
  {
    match: ['espalda alta', 'trapecios', 'trap', 'traps', 'espalda'],
    multipliers: {
      'Dorsales': 0.5,
      'Bíceps': 0.5,
      'Antebrazo': 0.35,
      'Deltoides posterior': 0.5,
      'Trapecios': 0.8,
      'Lumbar': 0.25,
    },
  },
  {
    match: ['hombros', 'hombro', 'deltoides', 'deltoide'],
    multipliers: {
      'Tríceps': 0.5,
      'Trapecios': 0.3,
      'Pecho': 0.3,
    },
  },
  {
    match: ['pecho', 'pectoral', 'pectorales'],
    multipliers: {
      'Tríceps': 0.6,
      'Deltoides anterior': 0.4,
      'Deltoides lateral': 0.15,
    },
  },
  {
    match: ['cuadriceps', 'cuádriceps', 'quadriceps'],
    multipliers: {
      'Gluteo mayor': 0.7,
      'Gluteo medio': 0.4,
      'Isquiotibiales': 0.45,
      'Gemelos': 0.35,
      'Lumbar': 0.4,
    },
  },
  {
    match: ['isquiotibiales', 'isquios', 'isquio', 'femoral', 'femorales', 'lumbar', 'lumbares'],
    multipliers: {
      'Lumbar': 0.9,
      'Gluteo mayor': 0.8,
      'Cuádriceps': 0.5,
      'Trapecios': 0.4,
      'Antebrazo': 0.4,
    },
  },
  {
    match: ['gluteo mayor', 'gluteos', 'gluteo', 'hip thrust', 'glute'],
    multipliers: {
      'Gluteo medio': 0.4,
      'Gluteo menor': 0.25,
      'Isquiotibiales': 0.5,
      'Lumbar': 0.3,
    },
  },
]

function normalizeMuscle(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// Devuelve { musculo: multiplicador } para el grupo primario dado. El primario
// siempre lleva multiplicador 1; los secundarios salen de la regla del patron.
export function getMuscleSplit(primaryGroup: string | null): Record<string, number> {
  const base = primaryGroup || ''
  if (!base) return {}
  const key = normalizeMuscle(base)
  for (const rule of RULES) {
    if (!rule.match.includes(key)) continue
    const out: Record<string, number> = { [base]: 1 }
    for (const [muscle, mult] of Object.entries(rule.multipliers)) {
      if (normalizeMuscle(muscle) !== key) out[muscle] = mult
    }
    return out
  }
  return { [base]: 1 }
}

// Reparte el volumen de una serie (peso x reps) entre los musculos implicados.
export function getMuscleVolumeSplit(primaryGroup: string | null, setVolume: number): Record<string, number> {
  const split = getMuscleSplit(primaryGroup)
  const out: Record<string, number> = {}
  for (const [muscle, mult] of Object.entries(split)) {
    out[muscle] = setVolume * mult
  }
  return out
}
