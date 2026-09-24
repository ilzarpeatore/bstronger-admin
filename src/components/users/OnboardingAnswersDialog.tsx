import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError } from '@/lib/api'

export type OnboardingSection = 'par_q' | 'training' | 'nutrition'

type Option = { value: string; label: string }
type Field =
  | { key: string; label: string; type: 'bool'; femaleOnly?: boolean }
  | { key: string; label: string; type: 'int'; min: number; max?: number }
  | { key: string; label: string; type: 'select'; options: Option[] }
  | { key: string; label: string; type: 'text'; optional?: boolean; wide?: boolean }

const opts = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }))

const PAR_Q_FIELDS: Field[] = [
  { key: 'parq_heart_condition', label: '¿Condición cardíaca conocida?', type: 'bool' },
  { key: 'parq_chest_pain_activity', label: '¿Dolor en el pecho con actividad?', type: 'bool' },
  { key: 'parq_chest_pain_rest_last_month', label: '¿Dolor en el pecho en reposo (último mes)?', type: 'bool' },
  { key: 'parq_dizziness_balance', label: '¿Mareos o pérdida de equilibrio?', type: 'bool' },
  { key: 'parq_bone_joint_problem', label: '¿Problema óseo o articular?', type: 'bool' },
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
  { key: 'activity_level', label: 'Nivel de actividad', type: 'select', options: opts([['sedentary', 'Sedentario'], ['light', 'Ligera'], ['moderate', 'Moderada'], ['active', 'Activa'], ['very_active', 'Muy activa']]) },
  { key: 'lifestyle_type', label: 'Estilo de vida', type: 'select', options: opts([['mostly_sitting', 'Casi siempre sentado'], ['sometimes_standing', 'A veces de pie'], ['mostly_standing', 'Casi siempre de pie'], ['always_moving', 'Siempre en movimiento'], ['heavy_labor', 'Trabajo físico pesado']]) },
  { key: 'training_experience_months', label: 'Experiencia entrenando (meses)', type: 'int', min: 0 },
  { key: 'training_days_per_week', label: 'Días de entrenamiento por semana', type: 'int', min: 1, max: 7 },
  { key: 'session_duration_preference', label: 'Duración de sesión preferida (min)', type: 'select', options: opts([['30', '30'], ['45', '45'], ['60', '60'], ['90', '90'], ['90_plus', 'Más de 90']]) },
  { key: 'training_mindset', label: 'Mentalidad de entrenamiento', type: 'select', options: opts([['rushed', 'Con prisa'], ['calm', 'Tranquilo'], ['motivated', 'Motivado'], ['unmotivated', 'Desmotivado']]) },
  { key: 'previous_coaching', label: 'Coaching previo', type: 'select', options: opts([['online_coach', 'Entrenador online'], ['in_person_coach', 'Entrenador presencial'], ['self_trained', 'Por su cuenta']]) },
  { key: 'current_routine_style', label: 'Rutina actual', type: 'select', options: opts([['improvised', 'Improvisada'], ['copied', 'Copiada'], ['structured', 'Estructurada'], ['always_same', 'Siempre la misma'], ['very_varied', 'Muy variada']]) },
  { key: 'weekly_split_preference', label: 'Split semanal preferido', type: 'select', options: opts([['upper_lower', 'Torso / pierna'], ['push_pull', 'Empuje / tirón'], ['full_body', 'Cuerpo completo'], ['no_preference', 'Sin preferencia']]) },
  { key: 'technique_level', label: 'Nivel de técnica (1-10)', type: 'int', min: 1, max: 10 },
  { key: 'realistic_goal', label: 'Objetivo realista', type: 'text', wide: true },
]

const NUTRITION_FIELDS: Field[] = [
  { key: 'allergies_intolerances', label: 'Alergias / intolerancias', type: 'text', wide: true },
  { key: 'medications', label: 'Medicamentos', type: 'text', optional: true },
  { key: 'supplements', label: 'Suplementos', type: 'text', optional: true },
  { key: 'current_meals_per_day', label: 'Comidas actuales por día', type: 'int', min: 1, max: 8 },
  { key: 'desired_meals_per_day', label: 'Comidas deseadas por día', type: 'int', min: 1, max: 8 },
  { key: 'typical_day_meals', label: 'Día típico de comidas', type: 'text', wide: true },
  { key: 'disliked_foods', label: 'Alimentos que no le gustan', type: 'text', optional: true },
  { key: 'liked_foods', label: 'Alimentos favoritos', type: 'text', optional: true },
  { key: 'favorite_meats', label: 'Carnes favoritas', type: 'text', optional: true },
  { key: 'favorite_fish', label: 'Pescados favoritos', type: 'text', optional: true },
  { key: 'favorite_fruits_vegetables', label: 'Frutas / verduras favoritas', type: 'text', optional: true },
  { key: 'favorite_combined_dishes', label: 'Platos combinados favoritos', type: 'text', optional: true },
  { key: 'cooking_minutes_per_meal', label: 'Minutos de cocina por comida', type: 'int', min: 0, max: 180 },
  { key: 'cooking_skill_level', label: 'Nivel en la cocina', type: 'select', options: opts([['beginner', 'Principiante'], ['intermediate', 'Intermedio'], ['advanced', 'Avanzado']]) },
  { key: 'cooks_for_others', label: '¿Cocina para otras personas?', type: 'bool' },
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

type Values = Record<string, string | boolean | null>

function initialValues(fields: Field[], initial: Record<string, unknown> | null): Values {
  const v: Values = {}
  for (const f of fields) {
    const raw = initial?.[f.key]
    if (f.type === 'bool') v[f.key] = raw === null || raw === undefined ? null : raw === true || raw === 1 || raw === '1'
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

  const set = (key: string, value: string | boolean) => setValues(prev => ({ ...prev, [key]: value }))

  const payload = () => {
    const body: Record<string, unknown> = { user_id: userId }
    for (const f of fields) {
      const v = values[f.key]
      if (f.type === 'bool') body[f.key] = v === true
      else if (f.type === 'int') body[f.key] = v === '' ? null : Number(v)
      else body[f.key] = v === '' ? null : v
    }
    return body
  }

  const save = async () => {
    // una pregunta Sí/No sin responder no se debe guardar como «No» por accidente
    if (fields.some(f => f.type === 'bool' && values[f.key] === null)) {
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
              const wide = f.type === 'text' && f.wide
              return (
                <div key={f.key} className={wide ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
                  <label htmlFor={id} className='text-xs font-medium'>{f.label}</label>
                  {f.type === 'bool' && (
                    <select
                      id={id}
                      className={selectClass}
                      value={values[f.key] === null ? '' : values[f.key] ? 'yes' : 'no'}
                      onChange={e => set(f.key, e.target.value === 'yes')}
                    >
                      {values[f.key] === null && <option value=''>Sin responder</option>}
                      <option value='no'>No</option>
                      <option value='yes'>Sí</option>
                    </select>
                  )}
                  {f.type === 'int' && (
                    <Input id={id} type='number' min={f.min} max={f.max} value={(values[f.key] as string) ?? ''} onChange={e => set(f.key, e.target.value)} />
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
