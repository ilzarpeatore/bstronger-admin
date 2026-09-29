import { ONBOARDING_FIELDS, formatOnboardingValue, type OnboardingSection } from './OnboardingAnswersDialog'

/**
 * Respuestas del onboarding añadidas el 2026-09-29 (lesión estructurada, deporte/evento, contexto
 * de vida, material, referencias de fuerza y nutrición práctica) para la ficha del cliente. Usa
 * las mismas definiciones que el diálogo de edición, así que las etiquetas no se duplican. Solo
 * muestra las que tienen valor -- los clientes anteriores no las respondieron.
 */
const EXTRA_KEYS: Record<OnboardingSection, string[]> = {
  par_q: [
    'injury_has', 'injury_zone', 'injury_phase', 'injury_worsens_with_impact', 'injury_professional_clearance',
    'injury_painful_movement', 'injury_other_notes',
  ],
  training: [
    'practices_other_sport', 'other_sport_description', 'has_target_event', 'target_event_description', 'target_event_date',
    'work_schedule', 'training_time_of_day', 'sleep_hours', 'sleep_regularity', 'stress_level',
    'training_location', 'home_equipment', 'equipment_notes',
  ],
  nutrition: [
    'meal_schedule', 'intermittent_fasting', 'meals_away_from_home', 'weekly_food_budget', 'alcohol_frequency',
    'water_intake', 'previous_diets',
  ],
}

const STRENGTH = [
  ['Sentadilla con barra', 'strength_squat_kg', 'strength_squat_reps', ''],
  ['Peso muerto', 'strength_deadlift_kg', 'strength_deadlift_reps', ''],
  ['Press banca mancuernas', 'strength_db_bench_kg', 'strength_db_bench_reps', ' c/u'],
  ['Remo con mancuerna', 'strength_db_row_kg', 'strength_db_row_reps', ''],
] as const

export default function OnboardingExtraFields({ section, data }: { section: OnboardingSection; data: Record<string, unknown> }) {
  const fields = ONBOARDING_FIELDS[section].filter(f => EXTRA_KEYS[section].includes(f.key))
  const rows = fields
    .map(f => ({ f, value: formatOnboardingValue(f, data[f.key]) }))
    .filter((r): r is { f: typeof r.f; value: string } => r.value !== null)
  const strength = section === 'training' ? STRENGTH.filter(([, kg]) => data[kg] != null) : []

  if (rows.length === 0 && strength.length === 0) return null

  return (
    <>
      {rows.map(({ f, value }) => (f.type === 'text' || f.type === 'multi'
        ? <div key={f.key} className='sm:col-span-2 pt-2 border-t'><p className='text-muted-foreground mb-1'>{f.label}</p><p className='whitespace-pre-wrap'>{value}</p></div>
        : <div key={f.key} className='flex items-center justify-between'><span className='text-muted-foreground'>{f.label}</span><span className='font-medium'>{value}</span></div>
      ))}
      {strength.length > 0 && (
        <div className='sm:col-span-2 pt-2 border-t'>
          <p className='text-muted-foreground mb-1'>Referencias de fuerza</p>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1'>
            {strength.map(([label, kg, reps, suffix]) => (
              <div key={kg} className='flex items-center justify-between'>
                <span>{label}</span>
                <span className='font-medium'>{String(data[kg])} kg{suffix}{data[reps] != null ? ` × ${String(data[reps])}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
