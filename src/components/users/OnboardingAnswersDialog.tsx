import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError } from '@/lib/api'

export type OnboardingSection = 'par_q' | 'training' | 'nutrition'

type Option = { value: string; label: string }
// `optional` en 'bool': preguntas añadidas después (2026-09-29) que los clientes antiguos no
// respondieron -- se pueden dejar «Sin responder» al guardar.
export type Field =
  | { key: string; label: string; type: 'bool'; femaleOnly?: boolean; optional?: boolean }
  | { key: string; label: string; type: 'int'; min: number; max?: number }
  | { key: string; label: string; type: 'number'; min: number; max?: number; step: number }
  | { key: string; label: string; type: 'select'; options: Option[] }
  | { key: string; label: string; type: 'multi'; options: Option[] }
  | { key: string; label: string; type: 'date' }
  | { key: string; label: string; type: 'text'; optional?: boolean; wide?: boolean }

const opts = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }))

const PAR_Q_FIELDS: Field[] = [
  { key: 'parq_heart_condition', label: '¿Condición cardíaca conocida?', type: 'bool' },
  { key: 'parq_chest_pain_activity', label: '¿Dolor en el pecho con actividad?', type: 'bool' },
  { key: 'parq_chest_pain_rest_last_month', label: '¿Dolor en el pecho en reposo (último mes)?', type: 'bool' },
  { key: 'parq_dizziness_balance', label: '¿Mareos o pérdida de equilibrio?', type: 'bool' },
  { key: 'parq_bone_joint_problem', label: '¿Problema óseo o articular?', type: 'bool' },
  { key: 'injury_has', label: '¿Lesión o molestia a tener en cuenta?', type: 'bool', optional: true },
  { key: 'injury_zone', label: 'Zona de la lesión principal', type: 'select', options: opts([['neck', 'Cuello'], ['shoulder', 'Hombro'], ['elbow', 'Codo'], ['wrist_hand', 'Muñeca o mano'], ['upper_back', 'Espalda alta'], ['lower_back', 'Zona lumbar'], ['hip', 'Cadera'], ['knee', 'Rodilla'], ['ankle_foot', 'Tobillo o pie'], ['other', 'Otra']]) },
  { key: 'injury_phase', label: 'Fase de la lesión', type: 'select', options: opts([['acute', 'Aguda'], ['recovering', 'En recuperación'], ['chronic_controlled', 'Antigua o controlada']]) },
  { key: 'injury_worsens_with_impact', label: '¿Empeora con impacto/actividad?', type: 'select', options: opts([['yes', 'Sí'], ['no', 'No'], ['unknown', 'No lo sabe']]) },
  { key: 'injury_professional_clearance', label: 'Visto bueno profesional', type: 'select', options: opts([['cleared', 'Sí, sin limitaciones'], ['with_limits', 'Sí, con limitaciones'], ['not_consulted', 'No lo ha consultado']]) },
  { key: 'injury_painful_movement', label: 'Gesto que le provoca dolor', type: 'text', optional: true, wide: true },
  { key: 'injury_other_notes', label: 'Otras lesiones o molestias', type: 'text', optional: true, wide: true },
  { key: 'parq_bp_or_heart_medication', label: '¿Medicación para tensión/corazón?', type: 'bool' },
  { key: 'parq_reason_not_to_exercise', label: '¿Otra razón para no hacer ejercicio?', type: 'bool' },
  { key: 'parq_pregnant_or_possible', label: '¿Embarazada o posibilidad de estarlo?', type: 'bool', femaleOnly: true },
  { key: 'parq_menstrual_change_or_stress_fracture', label: '¿Cambios menstruales o fractura por estrés?', type: 'bool', femaleOnly: true },
  { key: 'parq_eating_disorder_history', label: '¿Historial de trastorno alimentario?', type: 'bool' },
  { key: 'parq_fitness_level', label: 'Nivel de forma física autopercibido (1-10)', type: 'int', min: 1, max: 10 },
  { key: 'parq_medical_history', label: 'Historial médico', type: 'text', optional: true, wide: true },
  { key: 'parq_goals', label: 'Objetivos', type: 'text', wide: true },
]

const TRAINING_FIELDS: Field[] = [
  { key: 'goal_type', label: 'Objetivo', type: 'select', options: opts([['lose_fat', 'Perder grasa'], ['gain_muscle', 'Ganar músculo'], ['recomposition', 'Recomposición'], ['maintain', 'Mantener']]) },
  { key: 'practices_other_sport', label: '¿Practica otro deporte?', type: 'bool', optional: true },
  { key: 'other_sport_description', label: 'Otro deporte (cuál y cuánto)', type: 'text', optional: true, wide: true },
  { key: 'has_target_event', label: '¿Prepara un evento o fecha?', type: 'bool', optional: true },
  { key: 'target_event_date', label: 'Fecha del evento', type: 'date' },
  { key: 'target_event_description', label: 'Evento', type: 'text', optional: true, wide: true },
  { key: 'activity_level', label: 'Nivel de actividad', type: 'select', options: opts([['sedentary', 'Sedentario'], ['light', 'Ligera'], ['moderate', 'Moderada'], ['active', 'Activa'], ['very_active', 'Muy activa']]) },
  { key: 'lifestyle_type', label: 'Estilo de vida', type: 'select', options: opts([['mostly_sitting', 'Casi siempre sentado'], ['sometimes_standing', 'A veces de pie'], ['mostly_standing', 'Casi siempre de pie'], ['always_moving', 'Siempre en movimiento'], ['heavy_labor', 'Trabajo físico pesado']]) },
  { key: 'work_schedule', label: 'Horario de trabajo/estudios', type: 'select', options: opts([['morning', 'Fijo de mañana'], ['afternoon', 'Fijo de tarde'], ['split', 'Jornada partida'], ['rotating_shifts', 'Turnos rotativos'], ['night', 'Nocturno'], ['flexible', 'Flexible'], ['not_working', 'No trabaja ni estudia']]) },
  { key: 'training_time_of_day', label: 'Hora a la que entrena', type: 'select', options: opts([['morning', 'Mañana'], ['midday', 'Mediodía'], ['afternoon', 'Tarde'], ['evening', 'Noche'], ['variable', 'Depende del día']]) },
  { key: 'sleep_hours', label: 'Horas de sueño', type: 'int', min: 3, max: 12 },
  { key: 'sleep_regularity', label: 'Horario de sueño', type: 'select', options: opts([['regular', 'Regular'], ['irregular', 'Irregular']]) },
  { key: 'stress_level', label: 'Estrés percibido (1-10)', type: 'int', min: 1, max: 10 },
  { key: 'training_experience_months', label: 'Experiencia entrenando (meses)', type: 'int', min: 0 },
  { key: 'training_days_per_week', label: 'Días de entrenamiento por semana', type: 'int', min: 1, max: 7 },
  { key: 'session_duration_preference', label: 'Duración de sesión preferida (min)', type: 'select', options: opts([['30', '30'], ['45', '45'], ['60', '60'], ['90', '90'], ['90_plus', 'Más de 90']]) },
  // Lugar + material en una sola respuesta (2026-09-29). Los 4 últimos valores son de la primera
  // versión del onboarding y solo aparecen en respuestas antiguas.
  { key: 'training_location', label: 'Dónde entrena y con qué', type: 'select', options: opts([['full_gym', 'Gimnasio completo'], ['gym_basic', 'Gimnasio con poco material'], ['gym_no_equipment', 'Gimnasio sin material'], ['home_full', 'Casa con mucho material'], ['home_basic', 'Casa con poco material'], ['home_none', 'Casa sin material'], ['basic_gym', 'Gimnasio básico (antiguo)'], ['home', 'En casa (antiguo)'], ['outdoor', 'Al aire libre (antiguo)'], ['mixed', 'Varios sitios (antiguo)']]) },
  { key: 'home_equipment', label: 'Material disponible', type: 'multi', options: opts([['dumbbells', 'Mancuernas'], ['barbell_plates', 'Barra y discos'], ['rack', 'Rack o jaula'], ['bench', 'Banco'], ['pullup_bar', 'Barra de dominadas'], ['kettlebells', 'Kettlebells'], ['bands', 'Bandas elásticas'], ['suspension', 'TRX o anillas'], ['cables', 'Poleas o máquinas'], ['cardio_machine', 'Máquina de cardio'], ['none', 'Nada (peso corporal)']]) },
  { key: 'equipment_notes', label: 'Detalles del material', type: 'text', optional: true, wide: true },
  { key: 'training_mindset', label: 'Mentalidad de entrenamiento', type: 'select', options: opts([['rushed', 'Con prisa'], ['calm', 'Tranquilo'], ['motivated', 'Motivado'], ['unmotivated', 'Desmotivado']]) },
  { key: 'previous_coaching', label: 'Coaching previo', type: 'select', options: opts([['online_coach', 'Entrenador online'], ['in_person_coach', 'Entrenador presencial'], ['self_trained', 'Por su cuenta']]) },
  { key: 'current_routine_style', label: 'Rutina actual', type: 'select', options: opts([['improvised', 'Improvisada'], ['copied', 'Copiada'], ['structured', 'Estructurada'], ['always_same', 'Siempre la misma'], ['very_varied', 'Muy variada']]) },
  { key: 'weekly_split_preference', label: 'Split semanal preferido', type: 'select', options: opts([['upper_lower', 'Torso / pierna'], ['push_pull', 'Empuje / tirón'], ['full_body', 'Cuerpo completo'], ['no_preference', 'Sin preferencia']]) },
  { key: 'technique_level', label: 'Nivel de técnica (1-10)', type: 'int', min: 1, max: 10 },
  { key: 'strength_squat_kg', label: 'Sentadilla con barra (kg)', type: 'number', min: 0, max: 500, step: 0.5 },
  { key: 'strength_squat_reps', label: 'Sentadilla con barra (reps)', type: 'int', min: 1, max: 50 },
  { key: 'strength_deadlift_kg', label: 'Peso muerto (kg)', type: 'number', min: 0, max: 500, step: 0.5 },
  { key: 'strength_deadlift_reps', label: 'Peso muerto (reps)', type: 'int', min: 1, max: 50 },
  { key: 'strength_db_bench_kg', label: 'Press banca mancuernas (kg c/u)', type: 'number', min: 0, max: 200, step: 0.5 },
  { key: 'strength_db_bench_reps', label: 'Press banca mancuernas (reps)', type: 'int', min: 1, max: 50 },
  { key: 'strength_db_row_kg', label: 'Remo con mancuerna (kg)', type: 'number', min: 0, max: 200, step: 0.5 },
  { key: 'strength_db_row_reps', label: 'Remo con mancuerna (reps)', type: 'int', min: 1, max: 50 },
  { key: 'realistic_goal', label: 'Cómo entrenaba antes', type: 'text', wide: true },
]

const NUTRITION_FIELDS: Field[] = [
  { key: 'allergies_intolerances', label: 'Alergias / intolerancias', type: 'text', wide: true },
  { key: 'medications', label: 'Medicamentos', type: 'text', optional: true },
  { key: 'supplements', label: 'Suplementos', type: 'text', optional: true },
  { key: 'current_meals_per_day', label: 'Comidas actuales por día', type: 'int', min: 1, max: 8 },
  { key: 'desired_meals_per_day', label: 'Comidas deseadas por día', type: 'int', min: 1, max: 8 },
  { key: 'typical_day_meals', label: 'Día típico de comidas', type: 'text', wide: true },
  { key: 'meal_schedule', label: 'Horario de comidas', type: 'text', optional: true },
  { key: 'intermittent_fasting', label: '¿Hace ayuno intermitente?', type: 'bool', optional: true },
  { key: 'meals_away_from_home', label: 'Dónde come al mediodía', type: 'select', options: opts([['home', 'En casa'], ['tupper', 'Tupper'], ['restaurant', 'Restaurante / menú'], ['mixed', 'Depende del día']]) },
  { key: 'disliked_foods', label: 'Alimentos que no le gustan', type: 'text', optional: true },
  { key: 'liked_foods', label: 'Alimentos favoritos', type: 'text', optional: true },
  { key: 'favorite_meats', label: 'Carnes favoritas', type: 'text', optional: true },
  { key: 'favorite_fish', label: 'Pescados favoritos', type: 'text', optional: true },
  { key: 'favorite_fruits_vegetables', label: 'Frutas / verduras favoritas', type: 'text', optional: true },
  { key: 'favorite_combined_dishes', label: 'Platos combinados favoritos', type: 'text', optional: true },
  { key: 'cooking_minutes_per_meal', label: 'Minutos de cocina por comida', type: 'int', min: 0, max: 180 },
  { key: 'cooking_skill_level', label: 'Nivel en la cocina', type: 'select', options: opts([['beginner', 'Principiante'], ['intermediate', 'Intermedio'], ['advanced', 'Avanzado']]) },
  { key: 'cooks_for_others', label: '¿Cocina para otras personas?', type: 'bool' },
  { key: 'weekly_food_budget', label: 'Presupuesto semanal de comida', type: 'select', options: opts([['under_40', 'Menos de 40 €'], ['40_70', '40-70 €'], ['70_100', '70-100 €'], ['100_150', '100-150 €'], ['over_150', 'Más de 150 €'], ['unknown', 'No lo sabe']]) },
  { key: 'alcohol_frequency', label: 'Alcohol', type: 'select', options: opts([['never', 'Nunca'], ['occasional', 'Ocasional (1-2 al mes)'], ['weekends', 'Fines de semana'], ['several_per_week', 'Varias veces por semana'], ['daily', 'A diario']]) },
  { key: 'water_intake', label: 'Agua al día', type: 'select', options: opts([['under_1l', 'Menos de 1 L'], ['1_1_5l', '1-1,5 L'], ['1_5_2l', '1,5-2 L'], ['2_3l', '2-3 L'], ['over_3l', 'Más de 3 L']]) },
  { key: 'previous_diets', label: 'Dietas previas', type: 'text', optional: true, wide: true },
]

const SECTIONS: Record<OnboardingSection, { title: string; description: string; fields: Field[]; endpoint: string; responseKey: string }> = {
  par_q: {
    title: 'Editar PAR-Q (cuestionario de salud)',
    description: 'Son datos de salud del cliente. Si marcas una respuesta de riesgo, el cliente queda marcado para revisión (la marca no se quita sola).',
    fields: PAR_Q_FIELDS,
    endpoint: '/admin/admin-onboarding-par-q-update',
    responseKey: 'par_q',
  },
  training: {
    title: 'Editar cuestionario de entrenamiento',
    description: 'El cliente verá el cambio en «Mis respuestas del onboarding» de la app.',
    fields: TRAINING_FIELDS,
    endpoint: '/admin/admin-onboarding-training-questionnaire-update',
    responseKey: 'training_questionnaire',
  },
  nutrition: {
    title: 'Editar cuestionario de nutrición',
    description: 'El cliente verá el cambio en «Mis respuestas del onboarding» de la app.',
    fields: NUTRITION_FIELDS,
    endpoint: '/admin/admin-onboarding-nutrition-questionnaire-update',
    responseKey: 'nutrition_questionnaire',
  },
}

export const ONBOARDING_FIELDS: Record<OnboardingSection, Field[]> = {
  par_q: PAR_Q_FIELDS,
  training: TRAINING_FIELDS,
  nutrition: NUTRITION_FIELDS,
}

/** Valor legible de una respuesta (etiqueta de la opción, Sí/No...), o null si está vacía. */
export function formatOnboardingValue(f: Field, raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (f.type === 'bool') return raw === true || raw === 1 || raw === '1' ? 'Sí' : 'No'
  if (f.type === 'select') return f.options.find(o => o.value === String(raw))?.label ?? String(raw)
  if (f.type === 'multi') {
    if (!Array.isArray(raw) || raw.length === 0) return null
    return raw.map(v => f.options.find(o => o.value === v)?.label ?? String(v)).join(', ')
  }
  if (f.type === 'date') return new Date(String(raw).slice(0, 10)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  return String(raw)
}

type Values = Record<string, string | boolean | string[] | null>

function initialValues(fields: Field[], initial: Record<string, unknown> | null): Values {
  const v: Values = {}
  for (const f of fields) {
    const raw = initial?.[f.key]
    if (f.type === 'bool') v[f.key] = raw === null || raw === undefined ? null : raw === true || raw === 1 || raw === '1'
    else if (f.type === 'multi') v[f.key] = Array.isArray(raw) ? raw.map(String) : []
    else if (f.type === 'date') v[f.key] = raw ? String(raw).slice(0, 10) : ''
    else v[f.key] = raw === null || raw === undefined ? '' : String(raw)
  }
  return v
}

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'

/**
 * Edición admin de las respuestas del onboarding de un cliente. Mismas preguntas y reglas que la
 * app (el backend valida con el mismo servicio). Solo guarda al pulsar «Guardar».
 */
export default function OnboardingAnswersDialog({
  section, userId, gender, initial, onClose, onSaved,
}: {
  section: OnboardingSection | null
  userId: number
  gender?: string | null
  initial: Record<string, unknown> | null
  onClose: () => void
  onSaved: () => void
}) {
  const cfg = section ? SECTIONS[section] : null
  const fields = useMemo(() => (cfg ? cfg.fields.filter(f => !(f.type === 'bool' && f.femaleOnly && gender !== 'female')) : []), [cfg, gender])
  const [values, setValues] = useState<Values>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (cfg) setValues(initialValues(fields, initial))
  }, [cfg, fields, initial])

  if (!cfg || !section) return null

  const set = (key: string, value: string | boolean | string[]) => setValues(prev => ({ ...prev, [key]: value }))

  const payload = () => {
    const body: Record<string, unknown> = { user_id: userId }
    for (const f of fields) {
      const v = values[f.key]
      if (f.type === 'bool') body[f.key] = v === null ? null : v === true
      else if (f.type === 'int' || f.type === 'number') body[f.key] = v === '' ? null : Number(v)
      else if (f.type === 'multi') body[f.key] = Array.isArray(v) && v.length > 0 ? v : null
      else body[f.key] = v === '' ? null : v
    }
    return body
  }

  const save = async () => {
    // una pregunta Sí/No sin responder no se debe guardar como «No» por accidente
    if (fields.some(f => f.type === 'bool' && !f.optional && values[f.key] === null)) {
      toast.error('Responde todas las preguntas Sí/No antes de guardar')
      return
    }
    setSaving(true)
    try {
      await api.post(cfg.endpoint, payload())
      toast.success('Respuestas guardadas')
      onSaved()
      onClose()
    } catch (err) {
      const first = err instanceof ApiError && err.data?.errors ? (Object.values(err.data.errors) as string[][])[0]?.[0] : null
      toast.error(first || (err as Error)?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className='flex! max-h-[90vh] w-[97vw]! max-w-2xl! flex-col gap-3'>
        <DialogHeader className='shrink-0'>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>

        <div className='min-h-0 flex-1 space-y-3 overflow-y-auto pr-1'>
          <div className='grid gap-3 sm:grid-cols-2'>
            {fields.map(f => {
              const id = `onb-${f.key}`
              const wide = (f.type === 'text' && f.wide) || f.type === 'multi'
              return (
                <div key={f.key} className={wide ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
                  <label htmlFor={id} className='text-xs font-medium'>{f.label}</label>
                  {f.type === 'bool' && (
                    <select
                      id={id}
                      className={selectClass}
                      value={values[f.key] === null ? '' : values[f.key] ? 'yes' : 'no'}
                      onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value === '' ? null : e.target.value === 'yes' }))}
                    >
                      {(values[f.key] === null || f.optional) && <option value=''>Sin responder</option>}
                      <option value='no'>No</option>
                      <option value='yes'>Sí</option>
                    </select>
                  )}
                  {f.type === 'int' && (
                    <Input id={id} type='number' min={f.min} max={f.max} value={(values[f.key] as string) ?? ''} onChange={e => set(f.key, e.target.value)} />
                  )}
                  {f.type === 'number' && (
                    <Input id={id} type='number' min={f.min} max={f.max} step={f.step} value={(values[f.key] as string) ?? ''} onChange={e => set(f.key, e.target.value)} />
                  )}
                  {f.type === 'date' && (
                    <Input id={id} type='date' value={(values[f.key] as string) ?? ''} onChange={e => set(f.key, e.target.value)} />
                  )}
                  {f.type === 'multi' && (
                    <div id={id} className='flex flex-wrap gap-x-4 gap-y-1.5'>
                      {f.options.map(o => {
                        const selected = (values[f.key] as string[] | null) ?? []
                        return (
                          <label key={o.value} className='flex items-center gap-1.5 text-sm'>
                            <input
                              type='checkbox'
                              checked={selected.includes(o.value)}
                              onChange={e => set(f.key, e.target.checked ? [...selected, o.value] : selected.filter(x => x !== o.value))}
                            />
                            {o.label}
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {f.type === 'select' && (
                    <select id={id} className={selectClass} value={(values[f.key] as string) ?? ''} onChange={e => set(f.key, e.target.value)}>
                      <option value=''>Sin responder</option>
                      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                  {f.type === 'text' && (wide
                    ? <Textarea id={id} className='min-h-[72px] text-sm' value={(values[f.key] as string) ?? ''} onChange={e => set(f.key, e.target.value)} />
                    : <Input id={id} value={(values[f.key] as string) ?? ''} onChange={e => set(f.key, e.target.value)} />)}
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter className='shrink-0'>
          <Button variant='outline' onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
