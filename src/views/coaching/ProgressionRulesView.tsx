import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RefreshCw, Plus, Pencil, Trash2, FlaskConical, BarChart3, TrendingUp, Repeat,
  TrendingDown, AlertTriangle, MoonStar, Wrench, ArrowLeft, X as XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CoachOption } from '@/lib/coachExceptions'

// Motor de Auto-Regulación de Carga -- pantalla de administración de
// reglas de progresión (nunca existió antes, siempre se creaban por API
// directa). Patrón visual/código calcado de CoachExceptionsView.tsx
// (selector de coach, fetch, lista, acciones) y CoachExceptionsCard.tsx
// (diálogos de edición con campos numéricos prellenados).
//
// NOTA sobre la plantilla 5 (readiness_band): el motor SÍ evalúa esta
// variable contra datos reales de readiness_scores (Fase 4, activada el
// mismo día que esta pantalla) -- readiness_band es texto ('bajo'/
// 'reducido'/'optimo'/'dato_insuficiente') pero threshold_value en el
// backend es numérico, así que se compara contra una escala ordinal fija
// (bajo=0, reducido=1, optimo=2, ver SessionProgressionRuleEngine::
// resolveReadinessValue()) -- por eso esta plantilla manda threshold_value
// = 0 (exactamente "bajo") en vez de exponer un selector de texto. Sin
// dato de readiness ese día (cliente sin cuestionario/wearable), la
// condición simplemente no se cumple -- mismo comportamiento que cualquier
// otra variable sin dato disponible en el motor, no es un caso especial.

// ═══ Tipos que reflejan 1:1 los enums reales del backend (verificados en
// app/Enums/*.php hoy) ═══════════════════════════════════════════════════

type ScopeTypeVal = 'global' | 'categoria_ejercicio' | 'ejercicio_especifico' | 'programa_especifico' | 'cliente_especifico'
type RuleModeVal = 'automatico' | 'sugerido_pendiente_aprobacion'
type FallbackBehaviorVal = 'aplicar_igual' | 'mantener_sin_cambio' | 'escalar_a_notificacion_urgente'
type ConditionVariableVal =
  | 'rir_delta_sesion' | 'completion_ratio' | 'tendencia_rir' | 'sesiones_consecutivas_sin_cambio'
  | 'peor_serie' | 'sin_dato_suficiente' | 'e1rm_delta' | 'readiness_band' | 'hrv_z_score' | 'sueno_z_score'
type ConditionOperatorVal = 'gte' | 'lte' | 'eq' | 'between' | 'no_change_for_n'
type ActionTypeVal =
  | 'ajustar_carga_pct' | 'ajustar_carga_absoluta' | 'ajustar_reps' | 'mantener'
  | 'bajar_carga_pct' | 'sustituir_ejercicio' | 'bloquear_progresion' | 'marcar_para_coach'
type RoundingVal = 'nearest_1kg' | 'nearest_2_5kg' | 'none'
type BaseReferenceVal = 'ultimo_prescrito' | 'ultimo_efectivo' | 'e1rm_estimado' | 'primera_semana_mesociclo'

type ApiCondition = {
  variable: ConditionVariableVal
  operator: ConditionOperatorVal
  threshold_value?: number | null
  threshold_min?: number | null
  threshold_max?: number | null
  ventana_sesiones?: number | null
  logic_group?: number | null
  min_condiciones_requeridas?: number | null
}

type ApiAction = {
  type: ActionTypeVal
  value?: number | null
  rounding: RoundingVal
  base_reference: BaseReferenceVal
}

type RuleItem = {
  id: number
  coach_id: number
  name: string
  scope_type: ScopeTypeVal
  scope_id: number | null
  priority: number
  active: boolean
  mode: RuleModeVal
  fallback_behavior: FallbackBehaviorVal
  shadow_mode: boolean
  conditions: ApiCondition[]
  action: ApiAction | null
}

type PickOption = { id: number; label: string }

// ═══ Etiquetas en lenguaje llano para los enums crudos ═════════════════

const SCOPE_LABELS: Record<ScopeTypeVal, string> = {
  global: 'Global (todos los ejercicios)',
  categoria_ejercicio: 'Categoría de ejercicio (parte del cuerpo)',
  ejercicio_especifico: 'Ejercicio específico',
  programa_especifico: 'Programa de entrenamiento específico',
  cliente_especifico: 'Cliente específico',
}
const MODE_LABELS: Record<RuleModeVal, string> = {
  automatico: 'Automático (se aplica sin aprobación)',
  sugerido_pendiente_aprobacion: 'Sugerido (requiere tu aprobación)',
}
const FALLBACK_LABELS: Record<FallbackBehaviorVal, string> = {
  aplicar_igual: 'Si no respondes a tiempo: aplicar igual',
  mantener_sin_cambio: 'Si no respondes a tiempo: mantener sin cambio',
  escalar_a_notificacion_urgente: 'Si no respondes a tiempo: notificación urgente',
}
const VARIABLE_LABELS: Record<ConditionVariableVal, string> = {
  rir_delta_sesion: 'Diferencia de RIR en la sesión',
  completion_ratio: 'Ratio de series/reps completadas',
  tendencia_rir: 'Tendencia de RIR (tramo reciente)',
  sesiones_consecutivas_sin_cambio: 'Sesiones consecutivas sin cambio de carga',
  peor_serie: 'RIR de la peor serie',
  sin_dato_suficiente: 'Dato insuficiente (1 = sí, 0 = no)',
  e1rm_delta: 'Cambio de e1RM estimado',
  readiness_band: 'Banda de readiness (0=bajo, 1=reducido, 2=óptimo)',
  hrv_z_score: 'Z-score de HRV (requiere wearable)',
  sueno_z_score: 'Z-score de sueño (requiere wearable)',
}
const OPERATOR_LABELS: Record<ConditionOperatorVal, string> = {
  gte: 'mayor o igual que',
  lte: 'menor o igual que',
  eq: 'igual a',
  between: 'entre',
  no_change_for_n: 'sin cambio durante N sesiones',
}
const ACTION_TYPE_LABELS: Record<ActionTypeVal, string> = {
  ajustar_carga_pct: 'Subir carga (%)',
  ajustar_carga_absoluta: 'Ajustar carga (valor absoluto)',
  ajustar_reps: 'Ajustar repeticiones',
  mantener: 'Mantener carga',
  bajar_carga_pct: 'Bajar carga (%)',
  sustituir_ejercicio: 'Sustituir ejercicio',
  bloquear_progresion: 'Bloquear progresión',
  marcar_para_coach: 'Avisar al coach (sin actuar solo)',
}
const ROUNDING_LABELS: Record<RoundingVal, string> = {
  nearest_1kg: 'Redondear al 1 kg más cercano',
  nearest_2_5kg: 'Redondear al 2.5 kg más cercano',
  none: 'Sin redondeo',
}
const BASE_REFERENCE_LABELS: Record<BaseReferenceVal, string> = {
  ultimo_prescrito: 'Sobre el último peso prescrito',
  ultimo_efectivo: 'Sobre el último peso efectivo',
  e1rm_estimado: 'Sobre el e1RM estimado',
  primera_semana_mesociclo: 'Sobre la primera semana del mesociclo',
}
const REASON_LABELS: Record<string, string> = {
  sin_cliente: 'Cliente no encontrado',
  bloqueo_por_dolor: 'Bloqueada por dolor reportado',
  excluida_sin_dato_suficiente: 'Excluida — datos insuficientes',
  no_matchea: 'No cumple las condiciones de la regla',
  evaluado: 'Evaluada',
  regla_sin_accion: 'Regla sin acción configurada',
  accion_no_reconocida: 'Acción no reconocida',
  sustitucion_propuesta: 'Sustitución de ejercicio propuesta',
  posible_sobreentrenamiento_completion_ratio_bajando: 'Posible sobreentrenamiento (completion ratio bajando)',
  sustitucion_bloqueada_por_readiness_bajo: 'Sustitución bloqueada por readiness bajo',
  sustitucion_sin_variante_definida: 'Sin variante de sustitución definida',
}

// readiness_band/hrv_z_score/sueno_z_score se resuelven contra
// readiness_scores real (Fase 4) -- solo tienen dato los días en que el
// cliente completó el cuestionario diario o tiene wearable conectado.
// readiness_band se compara en escala ordinal (bajo=0, reducido=1,
// optimo=2), ver TEMPLATES[readiness_bajo] arriba.
const READINESS_VARIABLES: ConditionVariableVal[] = ['readiness_band', 'hrv_z_score', 'sueno_z_score']

// ═══ Plantillas (documento de fundamento §5 plantillas, verificadas hoy
// contra el backend real) ════════════════════════════════════════════════

type TemplateParamField = { key: string; label: string; suffix?: string; step?: number; min?: number; max?: number }

type Template = {
  id: string
  title: string
  icon: typeof TrendingUp
  summary: string
  foundation: string
  suggestedName: string
  paramFields: TemplateParamField[]
  defaultParams: Record<string, number>
  build: (params: Record<string, number>) => { conditions: ApiCondition[]; action: ApiAction }
  match: (rule: RuleItem) => Record<string, number> | null
  caveat?: string
}

const approxEq = (a: number | null | undefined, b: number, eps = 0.001) => a != null && Math.abs(a - b) < eps

const TEMPLATES: Template[] = [
  {
    id: 'rir_clasica',
    title: 'Progresión RIR clásica',
    icon: TrendingUp,
    summary: 'Si la sesión se sintió al menos 1 repetición más fácil de lo previsto, sube la carga un 2.5%.',
    foundation: 'Basado en autorregulación por RIR (Zourdos, Helms).',
    suggestedName: 'Progresión RIR clásica',
    paramFields: [
      { key: 'threshold', label: 'Umbral de RIR (repeticiones más fácil de lo previsto)', min: 0, step: 0.5 },
      { key: 'pct', label: 'Subida de carga', suffix: '%', min: 0, step: 0.5 },
    ],
    defaultParams: { threshold: 1, pct: 2.5 },
    build: (p) => ({
      conditions: [{ variable: 'rir_delta_sesion', operator: 'gte', threshold_value: p.threshold, logic_group: 0 }],
      action: { type: 'ajustar_carga_pct', value: p.pct, rounding: 'nearest_2_5kg', base_reference: 'ultimo_prescrito' },
    }),
    match: (r) => {
      const c = r.conditions
      if (c.length !== 1 || c[0].variable !== 'rir_delta_sesion' || c[0].operator !== 'gte') return null
      if (!r.action || r.action.type !== 'ajustar_carga_pct') return null
      return { threshold: c[0].threshold_value ?? 1, pct: r.action.value ?? 2.5 }
    },
  },
  {
    id: 'doble_progresion',
    title: 'Doble progresión',
    icon: Repeat,
    summary: 'Si el cliente completa todas las repeticiones prescritas 3 sesiones seguidas, sube la carga un 2.5%.',
    foundation: 'Principio clásico de progresión en fuerza.',
    suggestedName: 'Doble progresión',
    paramFields: [
      { key: 'sesiones', label: 'Sesiones seguidas completando todo', min: 1, step: 1 },
      { key: 'pct', label: 'Subida de carga', suffix: '%', min: 0, step: 0.5 },
    ],
    defaultParams: { sesiones: 3, pct: 2.5 },
    build: (p) => ({
      conditions: [{ variable: 'completion_ratio', operator: 'no_change_for_n', threshold_value: 1.0, ventana_sesiones: p.sesiones, logic_group: 0 }],
      action: { type: 'ajustar_carga_pct', value: p.pct, rounding: 'nearest_2_5kg', base_reference: 'ultimo_prescrito' },
    }),
    match: (r) => {
      const c = r.conditions
      if (c.length !== 1 || c[0].variable !== 'completion_ratio' || c[0].operator !== 'no_change_for_n') return null
      if (!r.action || r.action.type !== 'ajustar_carga_pct') return null
      return { sesiones: c[0].ventana_sesiones ?? 3, pct: r.action.value ?? 2.5 }
    },
  },
  {
    id: 'bajar_carga',
    title: 'Bajar carga si la sesión costó mucho más',
    icon: TrendingDown,
    summary: 'Si la sesión se sintió 2 o más repeticiones más difícil de lo previsto, baja la carga un 7.5%.',
    foundation: 'Autorregulación por RIR ante sesiones inusualmente duras.',
    suggestedName: 'Bajar carga por sesión difícil',
    paramFields: [
      { key: 'threshold', label: 'Umbral de RIR (repeticiones más difícil de lo previsto, en negativo)', step: 0.5 },
      { key: 'pct', label: 'Bajada de carga', suffix: '%', min: 0, step: 0.5 },
    ],
    defaultParams: { threshold: -2, pct: 7.5 },
    build: (p) => ({
      conditions: [{ variable: 'rir_delta_sesion', operator: 'lte', threshold_value: p.threshold, logic_group: 0 }],
      action: { type: 'bajar_carga_pct', value: p.pct, rounding: 'nearest_2_5kg', base_reference: 'ultimo_prescrito' },
    }),
    match: (r) => {
      const c = r.conditions
      if (c.length !== 1 || c[0].variable !== 'rir_delta_sesion' || c[0].operator !== 'lte') return null
      if (!r.action || r.action.type !== 'bajar_carga_pct') return null
      return { threshold: c[0].threshold_value ?? -2, pct: r.action.value ?? 7.5 }
    },
  },
  {
    id: 'estancamiento_aviso',
    title: 'Estancamiento — aviso al coach',
    icon: AlertTriangle,
    summary: 'Si el mismo peso se siente cada vez más difícil (RIR empeorando) durante 3+ sesiones seguidas sin cambio, avisa al coach en vez de actuar solo.',
    foundation: 'No sustituye ni ajusta nada automáticamente — solo marca la excepción para revisión humana.',
    suggestedName: 'Estancamiento — aviso al coach',
    paramFields: [
      { key: 'sesiones', label: 'Sesiones consecutivas sin cambio', min: 1, step: 1 },
    ],
    defaultParams: { sesiones: 3 },
    build: (p) => ({
      conditions: [
        { variable: 'tendencia_rir', operator: 'lte', threshold_value: -1, logic_group: 0 },
        { variable: 'sesiones_consecutivas_sin_cambio', operator: 'gte', threshold_value: p.sesiones, logic_group: 0 },
      ],
      action: { type: 'marcar_para_coach', rounding: 'none', base_reference: 'ultimo_prescrito' },
    }),
    match: (r) => {
      const c = r.conditions
      if (c.length !== 2) return null
      const trend = c.find(x => x.variable === 'tendencia_rir' && x.operator === 'lte')
      const streak = c.find(x => x.variable === 'sesiones_consecutivas_sin_cambio' && x.operator === 'gte')
      if (!trend || !streak || trend.logic_group !== streak.logic_group) return null
      if (!r.action || r.action.type !== 'marcar_para_coach') return null
      return { sesiones: streak.threshold_value ?? 3 }
    },
  },
  {
    id: 'readiness_bajo',
    title: 'Reducir por readiness bajo',
    icon: MoonStar,
    summary: 'Si el readiness del cliente está en banda "bajo" ese día, mantén la carga en vez de progresar.',
    foundation: 'Readiness informado por cuestionario diario / HRV / sueño (Kellmann, Buchheit) — solo actúa si hay dato de readiness ese día; sin dato, no se cumple, igual que el resto de condiciones del motor.',
    suggestedName: 'Mantener carga con readiness bajo',
    paramFields: [],
    defaultParams: {},
    build: () => ({
      conditions: [{ variable: 'readiness_band', operator: 'eq', threshold_value: 0, logic_group: 0 }],
      action: { type: 'mantener', rounding: 'none', base_reference: 'ultimo_prescrito' },
    }),
    match: (r) => {
      const c = r.conditions
      if (c.length !== 1 || c[0].variable !== 'readiness_band' || c[0].operator !== 'eq') return null
      if (!approxEq(c[0].threshold_value, 0)) return null
      if (!r.action || r.action.type !== 'mantener') return null
      return {}
    },
  },
]

function matchRuleToTemplate(rule: RuleItem): { template: Template; params: Record<string, number> } | null {
  for (const template of TEMPLATES) {
    const params = template.match(rule)
    if (params) return { template, params }
  }
  return null
}

// ═══ Formularios crudos (modo avanzado) ═════════════════════════════════

type ConditionForm = {
  variable: ConditionVariableVal
  operator: ConditionOperatorVal
  threshold_value: string
  threshold_min: string
  threshold_max: string
  ventana_sesiones: string
  logic_group: string
  min_condiciones_requeridas: string
}

type ActionForm = {
  type: ActionTypeVal
  value: string
  rounding: RoundingVal
  base_reference: BaseReferenceVal
}

type MetaForm = {
  name: string
  scope_type: ScopeTypeVal
  scope_id: string
  priority: string
  active: boolean
  mode: RuleModeVal
  fallback_behavior: FallbackBehaviorVal
  shadow_mode: boolean
}

const blankCondition = (): ConditionForm => ({
  variable: 'rir_delta_sesion', operator: 'gte', threshold_value: '', threshold_min: '', threshold_max: '', ventana_sesiones: '', logic_group: '0', min_condiciones_requeridas: '',
})
const blankAction = (): ActionForm => ({ type: 'ajustar_carga_pct', value: '', rounding: 'nearest_2_5kg', base_reference: 'ultimo_prescrito' })
// Decisión de seguridad ya tomada (documento de fundamento): una regla
// nueva NUNCA arranca en modo automático por defecto.
const DEFAULT_META: MetaForm = {
  name: '', scope_type: 'global', scope_id: '', priority: '0', active: true,
  mode: 'sugerido_pendiente_aprobacion', fallback_behavior: 'mantener_sin_cambio', shadow_mode: false,
}

const toConditionForm = (c: ApiCondition): ConditionForm => ({
  variable: c.variable, operator: c.operator,
  threshold_value: c.threshold_value != null ? String(c.threshold_value) : '',
  threshold_min: c.threshold_min != null ? String(c.threshold_min) : '',
  threshold_max: c.threshold_max != null ? String(c.threshold_max) : '',
  ventana_sesiones: c.ventana_sesiones != null ? String(c.ventana_sesiones) : '',
  logic_group: c.logic_group != null ? String(c.logic_group) : '0',
  min_condiciones_requeridas: c.min_condiciones_requeridas != null ? String(c.min_condiciones_requeridas) : '',
})
const toActionForm = (a: ApiAction): ActionForm => ({
  type: a.type, value: a.value != null ? String(a.value) : '', rounding: a.rounding, base_reference: a.base_reference,
})
const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s))

const fromConditionForm = (c: ConditionForm): ApiCondition => ({
  variable: c.variable, operator: c.operator,
  threshold_value: numOrNull(c.threshold_value),
  threshold_min: numOrNull(c.threshold_min),
  threshold_max: numOrNull(c.threshold_max),
  ventana_sesiones: numOrNull(c.ventana_sesiones),
  logic_group: numOrNull(c.logic_group) ?? 0,
  min_condiciones_requeridas: numOrNull(c.min_condiciones_requeridas),
})
const fromActionForm = (a: ActionForm): ApiAction => ({
  type: a.type, value: numOrNull(a.value), rounding: a.rounding, base_reference: a.base_reference,
})

// Payload completo desde una regla ya cargada (para el toggle activo/
// inactivo de la lista) -- manda TODOS los campos, nunca un patch parcial,
// porque el backend espera el objeto completo en update() (doUpdate()
// reemplaza conditions/action enteros si vienen presentes en el body).
function ruleToFullPayload(rule: RuleItem, overrides: Partial<Pick<RuleItem, 'active'>> = {}) {
  return {
    name: rule.name,
    scope_type: rule.scope_type,
    scope_id: rule.scope_id,
    priority: rule.priority,
    active: overrides.active ?? rule.active,
    mode: rule.mode,
    fallback_behavior: rule.fallback_behavior,
    shadow_mode: rule.shadow_mode,
    conditions: rule.conditions.map(c => ({
      variable: c.variable, operator: c.operator,
      threshold_value: c.threshold_value ?? null,
      threshold_min: c.threshold_min ?? null,
      threshold_max: c.threshold_max ?? null,
      ventana_sesiones: c.ventana_sesiones ?? null,
      logic_group: c.logic_group ?? 0,
      min_condiciones_requeridas: c.min_condiciones_requeridas ?? null,
    })),
    action: rule.action
      ? { type: rule.action.type, value: rule.action.value ?? null, rounding: rule.action.rounding, base_reference: rule.action.base_reference }
      : null,
  }
}

function summarizeConditions(rule: RuleItem): string {
  if (!rule.conditions.length) return 'Sin condiciones (siempre coincide)'
  const parts = rule.conditions.map(c => {
    let val = ''
    if (c.operator === 'between') val = `${c.threshold_min ?? '?'} - ${c.threshold_max ?? '?'}`
    else if (c.operator === 'no_change_for_n') val = `${c.ventana_sesiones ?? '?'} sesiones`
    else val = c.threshold_value != null ? String(c.threshold_value) : '—'
    return `${VARIABLE_LABELS[c.variable] || c.variable} ${OPERATOR_LABELS[c.operator] || c.operator} ${val}`
  })

  // Grupos con min_condiciones_requeridas seteado -- operador "N de M" en vez
  // del AND clásico entre condiciones del mismo logic_group.
  const groups = new Map<number, ApiCondition[]>()
  for (const c of rule.conditions) {
    const g = c.logic_group ?? 0
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(c)
  }
  for (const [group, conds] of groups) {
    const min = conds.find(c => c.min_condiciones_requeridas != null)?.min_condiciones_requeridas
    if (min != null) parts.push(`Grupo ${group}: requiere ${min} de ${conds.length} condiciones del grupo`)
  }

  return parts.join('  ·  ')
}

// ═══ Componente ══════════════════════════════════════════════════════════

const ProgressionRulesView = () => {
  const [coaches, setCoaches] = useState<CoachOption[]>([])
  const [coachId, setCoachId] = useState('')

  const [rules, setRules] = useState<RuleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actingOn, setActingOn] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RuleItem | null>(null)

  const [clients, setClients] = useState<PickOption[]>([])
  const [exercises, setExercises] = useState<PickOption[]>([])
  const [bodyParts, setBodyParts] = useState<PickOption[]>([])
  const [trainingPrograms, setTrainingPrograms] = useState<PickOption[]>([])

  // Asistente de creación/edición (2 pasos: elegir plantilla -> formulario).
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<'pick' | 'form'>('pick')
  const [formMode, setFormMode] = useState<'template' | 'advanced'>('template')
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null)
  const [templateParams, setTemplateParams] = useState<Record<string, number>>({})
  const [meta, setMeta] = useState<MetaForm>(DEFAULT_META)
  const [conditions, setConditions] = useState<ConditionForm[]>([blankCondition()])
  const [action, setAction] = useState<ActionForm>(blankAction())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Simular (dry-run).
  const [simTarget, setSimTarget] = useState<RuleItem | null>(null)
  const [simClientId, setSimClientId] = useState('')
  const [simExerciseId, setSimExerciseId] = useState('')
  const [simLoading, setSimLoading] = useState(false)
  const [simResults, setSimResults] = useState<any[] | null>(null)
  const [simMeta, setSimMeta] = useState<{ sessions_evaluated: number; next_session_targets_untouched: boolean } | null>(null)

  // Auditoría.
  const [auditTarget, setAuditTarget] = useState<RuleItem | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditData, setAuditData] = useState<{ total_logs: number; counts: Record<string, number>; percentages: Record<string, number>; targets_generated: number } | null>(null)

  const fetchCoaches = useCallback(async () => {
    try {
      const res = await api.get('/admin/coach-exceptions/coaches')
      setCoaches(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar la lista de coaches')
    }
  }, [])

  useEffect(() => { fetchCoaches() }, [fetchCoaches])
  useEffect(() => {
    if (!coachId && coaches.length > 0) setCoachId(String(coaches[0].id))
  }, [coachId, coaches])

  // Listas de apoyo para los selects de scope_id / simulación -- baratas,
  // se cargan una vez (mismo patrón que HabitsView.tsx/SectionsView.tsx).
  useEffect(() => {
    api.get('/admin/users?per_page=500').then(res => {
      const data = res.data?.data || res.data || []
      setClients(data.map((u: any) => ({ id: u.id, label: `${u.display_name || u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Cliente'} (${u.email || u.id})` })))
    }).catch(() => {})
    api.get('/admin/exercises?per_page=500').then(res => {
      const data = res.data?.data || res.data || []
      setExercises(data.map((e: any) => ({ id: e.id, label: e.title || e.name || `Ejercicio #${e.id}` })))
    }).catch(() => {})
    api.get('/admin/body-parts').then(res => {
      const data = res.data?.data || res.data || []
      setBodyParts(data.map((b: any) => ({ id: b.id, label: b.title || b.name || `Parte #${b.id}` })))
    }).catch(() => {})
    api.get('/admin/training-program-list?per_page=500').then(res => {
      const data = res.data?.data || res.data || []
      setTrainingPrograms(data.map((p: any) => ({ id: p.id, label: p.title || `Programa #${p.id}` })))
    }).catch(() => {})
  }, [])

  const fetchRules = useCallback(async () => {
    if (!coachId) { setRules([]); return }
    setLoading(true)
    try {
      const res = await api.get(`/admin/session-progression/rules?coach_id=${coachId}`)
      setRules(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar las reglas de progresión')
    } finally {
      setLoading(false)
    }
  }, [coachId])

  useEffect(() => { fetchRules() }, [fetchRules])

  // ── Asistente de creación/edición ────────────────────────────────────

  const resetWizard = () => {
    setWizardStep('pick')
    setFormMode('template')
    setActiveTemplate(null)
    setTemplateParams({})
    setMeta(DEFAULT_META)
    setConditions([blankCondition()])
    setAction(blankAction())
    setEditingId(null)
  }

  const openCreate = () => {
    resetWizard()
    setWizardOpen(true)
  }

  const pickTemplate = (template: Template) => {
    setActiveTemplate(template)
    setTemplateParams({ ...template.defaultParams })
    setMeta({ ...DEFAULT_META, name: template.suggestedName })
    setFormMode('template')
    setWizardStep('form')
  }

  const pickCustom = () => {
    setActiveTemplate(null)
    setFormMode('advanced')
    setMeta({ ...DEFAULT_META })
    setConditions([blankCondition()])
    setAction(blankAction())
    setWizardStep('form')
  }

  const switchToAdvanced = () => {
    // Si veníamos de una plantilla, arrastramos sus condiciones/acción
    // actuales al editor crudo para no perder lo ya configurado.
    if (activeTemplate) {
      const built = activeTemplate.build(templateParams)
      setConditions(built.conditions.map(toConditionForm))
      setAction(toActionForm(built.action))
    }
    setActiveTemplate(null)
    setFormMode('advanced')
  }

  const openEdit = (rule: RuleItem) => {
    setEditingId(rule.id)
    setMeta({
      name: rule.name,
      scope_type: rule.scope_type,
      scope_id: rule.scope_id != null ? String(rule.scope_id) : '',
      priority: String(rule.priority ?? 0),
      active: rule.active,
      mode: rule.mode,
      fallback_behavior: rule.fallback_behavior,
      shadow_mode: !!rule.shadow_mode,
    })
    const matched = matchRuleToTemplate(rule)
    if (matched) {
      setFormMode('template')
      setActiveTemplate(matched.template)
      setTemplateParams(matched.params)
    } else {
      setFormMode('advanced')
      setActiveTemplate(null)
      setConditions(rule.conditions.length ? rule.conditions.map(toConditionForm) : [blankCondition()])
      setAction(rule.action ? toActionForm(rule.action) : blankAction())
    }
    setWizardStep('form')
    setWizardOpen(true)
  }

  const addCondition = () => setConditions(prev => [...prev, blankCondition()])
  const removeCondition = (idx: number) => setConditions(prev => prev.filter((_, i) => i !== idx))
  const updateCondition = (idx: number, patch: Partial<ConditionForm>) =>
    setConditions(prev => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))

  const handleSave = async () => {
    if (!meta.name.trim()) { toast.error('El nombre es obligatorio'); return }
    if (meta.scope_type !== 'global' && meta.scope_id.trim() === '') {
      toast.error('Este scope requiere un ID (cliente, ejercicio o categoría)')
      return
    }

    let finalConditions: ApiCondition[]
    let finalAction: ApiAction | null
    if (formMode === 'template' && activeTemplate) {
      const built = activeTemplate.build(templateParams)
      finalConditions = built.conditions
      finalAction = built.action
    } else {
      finalConditions = conditions
        .filter(c => c.variable && c.operator)
        .map(fromConditionForm)
      finalAction = action.type ? fromActionForm(action) : null
    }

    const payload: any = {
      name: meta.name.trim(),
      scope_type: meta.scope_type,
      scope_id: meta.scope_type === 'global' ? null : Number(meta.scope_id),
      priority: meta.priority.trim() !== '' ? Number(meta.priority) : 0,
      active: meta.active,
      mode: meta.mode,
      fallback_behavior: meta.fallback_behavior,
      shadow_mode: meta.shadow_mode,
      conditions: finalConditions,
      action: finalAction,
    }

    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/admin/session-progression/rules/${editingId}`, payload)
        toast.success('Regla actualizada')
      } else {
        await api.post('/admin/session-progression/rules', { ...payload, coach_id: Number(coachId) })
        toast.success('Regla creada')
      }
      setWizardOpen(false)
      fetchRules()
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar la regla')
    } finally {
      setSaving(false)
    }
  }

  // ── Acciones de la lista ─────────────────────────────────────────────

  const handleToggleActive = async (rule: RuleItem) => {
    setActingOn(rule.id)
    try {
      await api.put(`/admin/session-progression/rules/${rule.id}`, ruleToFullPayload(rule, { active: !rule.active }))
      toast.success(rule.active ? 'Regla desactivada' : 'Regla activada')
      fetchRules()
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar la regla')
    } finally {
      setActingOn(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActingOn(deleteTarget.id)
    try {
      await api.delete(`/admin/session-progression/rules/${deleteTarget.id}`)
      toast.success('Regla eliminada')
      setDeleteTarget(null)
      fetchRules()
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar la regla')
    } finally {
      setActingOn(null)
    }
  }

  // ── Simular ───────────────────────────────────────────────────────────

  const openSimulate = (rule: RuleItem) => {
    setSimTarget(rule)
    setSimClientId('')
    setSimExerciseId(rule.scope_type === 'ejercicio_especifico' && rule.scope_id ? String(rule.scope_id) : '')
    setSimResults(null)
    setSimMeta(null)
  }

  const runSimulate = async () => {
    if (!simTarget) return
    if (!simClientId) { toast.error('Selecciona un cliente'); return }
    setSimLoading(true)
    try {
      const body: any = { client_id: Number(simClientId) }
      if (simExerciseId.trim() !== '') body.exercise_id = Number(simExerciseId)
      const res = await api.post(`/admin/session-progression/rules/${simTarget.id}/simulate`, body)
      setSimResults(res.data?.data || [])
      setSimMeta(res.data?.meta || null)
    } catch (err: any) {
      toast.error(err?.message || 'Error al simular la regla')
    } finally {
      setSimLoading(false)
    }
  }

  // ── Auditoría ─────────────────────────────────────────────────────────

  const openAudit = async (rule: RuleItem) => {
    setAuditTarget(rule)
    setAuditData(null)
    setAuditLoading(true)
    try {
      const res = await api.get(`/admin/session-progression/rules/${rule.id}/audit`)
      setAuditData(res.data?.data || res.data)
    } catch {
      toast.error('Error al cargar la auditoría')
    } finally {
      setAuditLoading(false)
    }
  }

  const clientLabel = useMemo(() => {
    const m = new Map(clients.map(c => [c.id, c.label]))
    return (id: number | null) => (id != null ? m.get(id) || `Cliente #${id}` : '')
  }, [clients])
  const exerciseLabel = useMemo(() => {
    const m = new Map(exercises.map(c => [c.id, c.label]))
    return (id: number | null) => (id != null ? m.get(id) || `Ejercicio #${id}` : '')
  }, [exercises])
  const bodyPartLabel = useMemo(() => {
    const m = new Map(bodyParts.map(c => [c.id, c.label]))
    return (id: number | null) => (id != null ? m.get(id) || `Categoría #${id}` : '')
  }, [bodyParts])
  const programLabel = useMemo(() => {
    const m = new Map(trainingPrograms.map(c => [c.id, c.label]))
    return (id: number | null) => (id != null ? m.get(id) || `Programa #${id}` : '')
  }, [trainingPrograms])

  const scopeDetail = (rule: RuleItem): string => {
    if (rule.scope_type === 'global' || rule.scope_id == null) return SCOPE_LABELS[rule.scope_type]
    if (rule.scope_type === 'cliente_especifico') return clientLabel(rule.scope_id)
    if (rule.scope_type === 'ejercicio_especifico') return exerciseLabel(rule.scope_id)
    if (rule.scope_type === 'programa_especifico') return programLabel(rule.scope_id)
    if (rule.scope_type === 'categoria_ejercicio') return bodyPartLabel(rule.scope_id)
    return String(rule.scope_id)
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between flex-wrap gap-3'>
          <div>
            <CardTitle>Reglas de progresión</CardTitle>
            <CardDescription>
              Motor de Auto-Regulación de Carga — define cuándo subir, bajar o mantener la carga de un cliente
              según cómo le fue en la sesión.
            </CardDescription>
          </div>
          <div className='flex items-center gap-2'>
            <Select value={coachId} onValueChange={v => setCoachId(v ?? '')}>
              <SelectTrigger className='w-64'><SelectValue placeholder='Seleccionar coach' /></SelectTrigger>
              <SelectContent>
                {coaches.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant='outline' size='icon' onClick={fetchRules} disabled={loading} title='Actualizar'>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
            <Button onClick={openCreate} disabled={!coachId}>
              <Plus className='size-4 mr-1' /> Nueva regla
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex justify-center py-12'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
          ) : rules.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-muted-foreground text-sm'>
              <p>{coachId ? 'Este coach todavía no tiene ninguna regla de progresión.' : 'Selecciona un coach para ver sus reglas.'}</p>
            </div>
          ) : (
            <div className='space-y-2.5'>
              {rules.map(rule => {
                const matched = matchRuleToTemplate(rule)
                const busy = actingOn === rule.id
                return (
                  <div key={rule.id} className='rounded-lg border p-3.5'>
                    <div className='flex items-start justify-between gap-3 flex-wrap'>
                      <div className='min-w-0'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <p className='text-sm font-medium'>{rule.name}</p>
                          <Badge variant={rule.active ? 'default' : 'secondary'}>{rule.active ? 'Activa' : 'Inactiva'}</Badge>
                          <Badge variant='outline'>{MODE_LABELS[rule.mode]}</Badge>
                          {matched && <Badge variant='outline' className='text-primary'>{matched.template.title}</Badge>}
                          {rule.shadow_mode && <Badge variant='outline'>Modo sombra</Badge>}
                        </div>
                        <p className='text-xs text-muted-foreground mt-1'>
                          Scope: {SCOPE_LABELS[rule.scope_type]}{rule.scope_id != null && <> — {scopeDetail(rule)}</>} · Prioridad {rule.priority}
                        </p>
                        <p className='text-xs text-muted-foreground mt-1'>
                          Si se cumple: {summarizeConditions(rule)}
                        </p>
                        <p className='text-xs text-muted-foreground mt-1'>
                          Acción: {rule.action ? ACTION_TYPE_LABELS[rule.action.type] : '—'}
                          {rule.action?.value != null && <> ({rule.action.value})</>}
                        </p>
                      </div>
                      <div className='flex items-center gap-1.5 shrink-0'>
                        <div className='flex items-center gap-1.5 mr-2' title='Activar/desactivar'>
                          <Switch checked={rule.active} disabled={busy} onCheckedChange={() => handleToggleActive(rule)} />
                        </div>
                        <Button size='sm' variant='outline' disabled={busy} onClick={() => openSimulate(rule)}>
                          <FlaskConical className='size-3.5 mr-1' /> Simular
                        </Button>
                        <Button size='sm' variant='outline' disabled={busy} onClick={() => openAudit(rule)}>
                          <BarChart3 className='size-3.5 mr-1' /> Auditoría
                        </Button>
                        <Button size='sm' variant='ghost' disabled={busy} onClick={() => openEdit(rule)}>
                          <Pencil className='size-3.5 mr-1' /> Editar
                        </Button>
                        <Button size='sm' variant='ghost' disabled={busy} className='text-destructive hover:text-destructive' onClick={() => setDeleteTarget(rule)}>
                          <Trash2 className='size-3.5 mr-1' /> Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Asistente de creación/edición ─────────────────────────────── */}
      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) setWizardOpen(false) }}>
        <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar regla de progresión' : wizardStep === 'pick' ? 'Nueva regla — elige una plantilla' : 'Nueva regla de progresión'}
            </DialogTitle>
            {wizardStep === 'pick' && (
              <DialogDescription>
                Empieza por una plantilla basada en principios de autorregulación por RIR/RPE, o crea una regla
                100% personalizada si necesitas control total sobre las condiciones y la acción.
              </DialogDescription>
            )}
          </DialogHeader>

          {wizardStep === 'pick' && (
            <div className='space-y-3'>
              <div className='grid gap-2.5 sm:grid-cols-2'>
                {TEMPLATES.map(t => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.id}
                      type='button'
                      onClick={() => pickTemplate(t)}
                      className='text-left rounded-lg border p-3.5 hover:border-primary hover:bg-accent/40 transition-colors'
                    >
                      <div className='flex items-center gap-2 mb-1.5'>
                        <div className='flex size-8 items-center justify-center rounded-lg bg-background border shrink-0'>
                          <Icon className='size-4' />
                        </div>
                        <p className='text-sm font-medium'>{t.title}</p>
                      </div>
                      <p className='text-xs text-muted-foreground'>{t.summary}</p>
                      <p className='text-[11px] text-muted-foreground mt-1 italic'>{t.foundation}</p>
                    </button>
                  )
                })}
              </div>
              <Button variant='outline' className='w-full' onClick={pickCustom}>
                <Wrench className='size-4 mr-1.5' /> Regla personalizada (constructor avanzado)
              </Button>
            </div>
          )}

          {wizardStep === 'form' && (
            <div className='space-y-5'>
              <div className='flex items-center justify-between flex-wrap gap-2'>
                {!editingId ? (
                  <Button variant='ghost' size='sm' onClick={() => setWizardStep('pick')}>
                    <ArrowLeft className='size-3.5 mr-1' /> Elegir otra plantilla
                  </Button>
                ) : <span />}
                {formMode === 'template' && (
                  <Button variant='ghost' size='sm' onClick={switchToAdvanced}>
                    <Wrench className='size-3.5 mr-1' /> Cambiar a modo avanzado
                  </Button>
                )}
              </div>

              {formMode === 'template' && activeTemplate && (
                <div className='rounded-lg border bg-muted/30 p-3'>
                  <p className='text-sm font-medium'>{activeTemplate.title}</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>{activeTemplate.summary}</p>
                  {activeTemplate.caveat && (
                    <p className='text-xs text-amber-700 dark:text-amber-500 mt-2 flex items-start gap-1.5'>
                      <AlertTriangle className='size-3.5 shrink-0 mt-0.5' /> {activeTemplate.caveat}
                    </p>
                  )}
                </div>
              )}

              <FieldGroup className='gap-4'>
                <Field className='gap-2'>
                  <FieldLabel>Nombre de la regla</FieldLabel>
                  <Input value={meta.name} onChange={e => setMeta(m => ({ ...m, name: e.target.value }))} />
                </Field>

                <div className='grid grid-cols-2 gap-3'>
                  <Field className='gap-2'>
                    <FieldLabel>Alcance (scope)</FieldLabel>
                    <Select value={meta.scope_type} onValueChange={v => setMeta(m => ({ ...m, scope_type: (v as ScopeTypeVal) ?? 'global', scope_id: '' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SCOPE_LABELS) as ScopeTypeVal[]).map(k => <SelectItem key={k} value={k}>{SCOPE_LABELS[k]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field className='gap-2'>
                    <FieldLabel>Prioridad (desempate dentro del mismo scope)</FieldLabel>
                    <Input type='number' step='1' value={meta.priority} onChange={e => setMeta(m => ({ ...m, priority: e.target.value }))} />
                  </Field>
                </div>

                {meta.scope_type === 'cliente_especifico' && (
                  <Field className='gap-2'>
                    <FieldLabel>Cliente</FieldLabel>
                    <Select value={meta.scope_id} onValueChange={v => setMeta(m => ({ ...m, scope_id: v ?? '' }))}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar cliente' /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {meta.scope_type === 'ejercicio_especifico' && (
                  <Field className='gap-2'>
                    <FieldLabel>Ejercicio</FieldLabel>
                    <Select value={meta.scope_id} onValueChange={v => setMeta(m => ({ ...m, scope_id: v ?? '' }))}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar ejercicio' /></SelectTrigger>
                      <SelectContent>
                        {exercises.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {meta.scope_type === 'categoria_ejercicio' && (
                  <Field className='gap-2'>
                    <FieldLabel>Categoría (parte del cuerpo)</FieldLabel>
                    <Select value={meta.scope_id} onValueChange={v => setMeta(m => ({ ...m, scope_id: v ?? '' }))}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar categoría' /></SelectTrigger>
                      <SelectContent>
                        {bodyParts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {meta.scope_type === 'programa_especifico' && (
                  <Field className='gap-2'>
                    <FieldLabel>Programa de entrenamiento</FieldLabel>
                    <Select value={meta.scope_id} onValueChange={v => setMeta(m => ({ ...m, scope_id: v ?? '' }))}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar programa' /></SelectTrigger>
                      <SelectContent>
                        {trainingPrograms.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className='text-[11px] text-muted-foreground'>
                      Aplica a cualquier cliente que esté corriendo este programa — útil para dar una lógica de
                      progresión propia a un bloque/mesociclo (p. ej. fuerza vs. hipertrofia), distinta de la regla
                      general del cliente. Gana sobre ejercicio/categoría/global, pero pierde frente a una regla de
                      cliente específico.
                    </p>
                  </Field>
                )}

                <div className='grid grid-cols-2 gap-3'>
                  <Field className='gap-2'>
                    <FieldLabel>Modo</FieldLabel>
                    <Select value={meta.mode} onValueChange={v => setMeta(m => ({ ...m, mode: (v as RuleModeVal) ?? 'sugerido_pendiente_aprobacion' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(MODE_LABELS) as RuleModeVal[]).map(k => <SelectItem key={k} value={k}>{MODE_LABELS[k]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field className='gap-2'>
                    <FieldLabel>Comportamiento de fallback</FieldLabel>
                    <Select value={meta.fallback_behavior} onValueChange={v => setMeta(m => ({ ...m, fallback_behavior: (v as FallbackBehaviorVal) ?? 'mantener_sin_cambio' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FALLBACK_LABELS) as FallbackBehaviorVal[]).map(k => <SelectItem key={k} value={k}>{FALLBACK_LABELS[k]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className='flex items-center justify-between rounded-lg border p-3'>
                  <div>
                    <p className='text-sm font-medium'>Activa</p>
                    <p className='text-xs text-muted-foreground'>Una regla inactiva no se evalúa nunca.</p>
                  </div>
                  <Switch checked={meta.active} onCheckedChange={v => setMeta(m => ({ ...m, active: v }))} />
                </div>
                <div className='flex items-center justify-between rounded-lg border p-3'>
                  <div>
                    <p className='text-sm font-medium'>Modo sombra</p>
                    <p className='text-xs text-muted-foreground'>Evalúa y registra, pero nunca genera una sugerencia real al cliente.</p>
                  </div>
                  <Switch checked={meta.shadow_mode} onCheckedChange={v => setMeta(m => ({ ...m, shadow_mode: v }))} />
                </div>

                {formMode === 'template' && activeTemplate && activeTemplate.paramFields.length > 0 && (
                  <div className='rounded-lg border p-3 space-y-3'>
                    <p className='text-sm font-medium'>Parámetros de la plantilla</p>
                    <div className='grid grid-cols-2 gap-3'>
                      {activeTemplate.paramFields.map(f => (
                        <Field key={f.key} className='gap-2'>
                          <FieldLabel>{f.label}{f.suffix ? ` (${f.suffix})` : ''}</FieldLabel>
                          <Input
                            type='number' step={f.step ?? 1} min={f.min} max={f.max}
                            value={templateParams[f.key] ?? ''}
                            onChange={e => setTemplateParams(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                          />
                        </Field>
                      ))}
                    </div>
                  </div>
                )}
                {formMode === 'template' && activeTemplate && activeTemplate.paramFields.length === 0 && (
                  <p className='text-xs text-muted-foreground'>Esta plantilla no tiene parámetros editables.</p>
                )}

                {formMode === 'advanced' && (
                  <div className='space-y-4'>
                    <div className='space-y-3'>
                      <div className='flex items-center justify-between'>
                        <p className='text-sm font-medium'>Condiciones</p>
                        <Button size='sm' variant='outline' onClick={addCondition}><Plus className='size-3.5 mr-1' /> Añadir</Button>
                      </div>
                      <p className='text-[11px] text-muted-foreground'>
                        Condiciones con el mismo grupo lógico se combinan con Y; grupos distintos se combinan con O.
                        Las variables de readiness (banda / HRV / sueño) solo tienen dato los días en que el cliente
                        completó el cuestionario diario o tiene wearable conectado — sin dato ese día, la condición
                        no se cumple. La banda de readiness se compara en escala 0=bajo, 1=reducido, 2=óptimo.
                      </p>
                      {conditions.map((c, idx) => (
                        <div key={idx} className='rounded-lg border p-3 space-y-2.5'>
                          <div className='flex items-center justify-between'>
                            <p className='text-xs font-medium text-muted-foreground'>Condición {idx + 1}</p>
                            {conditions.length > 1 && (
                              <Button size='icon-sm' variant='ghost' onClick={() => removeCondition(idx)}><XIcon className='size-3.5' /></Button>
                            )}
                          </div>
                          <div className='grid grid-cols-2 gap-2.5'>
                            <Field className='gap-1.5'>
                              <FieldLabel className='text-xs'>Variable</FieldLabel>
                              <Select value={c.variable} onValueChange={v => updateCondition(idx, { variable: (v as ConditionVariableVal) ?? c.variable })}>
                                <SelectTrigger className='h-8 text-xs'><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(VARIABLE_LABELS) as ConditionVariableVal[]).map(k => (
                                    <SelectItem key={k} value={k}>
                                      {VARIABLE_LABELS[k]}{READINESS_VARIABLES.includes(k) ? ' (requiere dato de readiness ese día)' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field className='gap-1.5'>
                              <FieldLabel className='text-xs'>Operador</FieldLabel>
                              <Select value={c.operator} onValueChange={v => updateCondition(idx, { operator: (v as ConditionOperatorVal) ?? c.operator })}>
                                <SelectTrigger className='h-8 text-xs'><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(OPERATOR_LABELS) as ConditionOperatorVal[]).map(k => <SelectItem key={k} value={k}>{OPERATOR_LABELS[k]}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>
                          <div className='grid grid-cols-3 gap-2.5'>
                            {c.operator === 'between' ? (
                              <>
                                <Field className='gap-1.5'>
                                  <FieldLabel className='text-xs'>Mínimo</FieldLabel>
                                  <Input className='h-8 text-xs' type='number' step='0.1' value={c.threshold_min} onChange={e => updateCondition(idx, { threshold_min: e.target.value })} />
                                </Field>
                                <Field className='gap-1.5'>
                                  <FieldLabel className='text-xs'>Máximo</FieldLabel>
                                  <Input className='h-8 text-xs' type='number' step='0.1' value={c.threshold_max} onChange={e => updateCondition(idx, { threshold_max: e.target.value })} />
                                </Field>
                              </>
                            ) : c.operator === 'no_change_for_n' ? (
                              <Field className='gap-1.5'>
                                <FieldLabel className='text-xs'>Ventana (sesiones)</FieldLabel>
                                <Input className='h-8 text-xs' type='number' step='1' min='1' value={c.ventana_sesiones} onChange={e => updateCondition(idx, { ventana_sesiones: e.target.value })} />
                              </Field>
                            ) : (
                              <Field className='gap-1.5'>
                                <FieldLabel className='text-xs'>Umbral</FieldLabel>
                                <Input className='h-8 text-xs' type='number' step='0.1' value={c.threshold_value} onChange={e => updateCondition(idx, { threshold_value: e.target.value })} />
                              </Field>
                            )}
                            <Field className='gap-1.5'>
                              <FieldLabel className='text-xs'>Grupo lógico</FieldLabel>
                              <Input className='h-8 text-xs' type='number' step='1' min='0' value={c.logic_group} onChange={e => updateCondition(idx, { logic_group: e.target.value })} />
                            </Field>
                          </div>
                          <Field className='gap-1.5'>
                            <FieldLabel className='text-xs'>Mínimo de condiciones requeridas (N de M en este grupo)</FieldLabel>
                            <Input className='h-8 text-xs' type='number' step='1' min='1' value={c.min_condiciones_requeridas} onChange={e => updateCondition(idx, { min_condiciones_requeridas: e.target.value })} placeholder='Vacío = deben cumplirse todas (AND)' />
                            <p className='text-[11px] text-muted-foreground'>
                              Opcional. Si 2 o más condiciones comparten el mismo grupo lógico, por defecto deben cumplirse
                              TODAS. Rellena esto para exigir solo N de las M condiciones de ese grupo en vez de todas.
                            </p>
                          </Field>
                        </div>
                      ))}
                    </div>

                    <div className='rounded-lg border p-3 space-y-2.5'>
                      <p className='text-sm font-medium'>Acción</p>
                      <div className='grid grid-cols-2 gap-2.5'>
                        <Field className='gap-1.5'>
                          <FieldLabel className='text-xs'>Tipo</FieldLabel>
                          <Select value={action.type} onValueChange={v => setAction(a => ({ ...a, type: (v as ActionTypeVal) ?? a.type }))}>
                            <SelectTrigger className='h-8 text-xs'><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(ACTION_TYPE_LABELS) as ActionTypeVal[]).map(k => <SelectItem key={k} value={k}>{ACTION_TYPE_LABELS[k]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field className='gap-1.5'>
                          <FieldLabel className='text-xs'>Valor</FieldLabel>
                          <Input className='h-8 text-xs' type='number' step='0.1' value={action.value} onChange={e => setAction(a => ({ ...a, value: e.target.value }))} />
                        </Field>
                      </div>
                      <div className='grid grid-cols-2 gap-2.5'>
                        <Field className='gap-1.5'>
                          <FieldLabel className='text-xs'>Redondeo</FieldLabel>
                          <Select value={action.rounding} onValueChange={v => setAction(a => ({ ...a, rounding: (v as RoundingVal) ?? a.rounding }))}>
                            <SelectTrigger className='h-8 text-xs'><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(ROUNDING_LABELS) as RoundingVal[]).map(k => <SelectItem key={k} value={k}>{ROUNDING_LABELS[k]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field className='gap-1.5'>
                          <FieldLabel className='text-xs'>Referencia base</FieldLabel>
                          <Select value={action.base_reference} onValueChange={v => setAction(a => ({ ...a, base_reference: (v as BaseReferenceVal) ?? a.base_reference }))}>
                            <SelectTrigger className='h-8 text-xs'><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(BASE_REFERENCE_LABELS) as BaseReferenceVal[]).map(k => <SelectItem key={k} value={k}>{BASE_REFERENCE_LABELS[k]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    </div>
                  </div>
                )}
              </FieldGroup>
            </div>
          )}

          {wizardStep === 'form' && (
            <DialogFooter>
              <Button variant='outline' onClick={() => setWizardOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear regla'}</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Eliminar ───────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar regla</DialogTitle></DialogHeader>
          <p className='text-sm'>¿Seguro que quieres eliminar «{deleteTarget?.name}»? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteTarget(null)} disabled={actingOn === deleteTarget?.id}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete} disabled={actingOn === deleteTarget?.id}>
              {actingOn === deleteTarget?.id ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Simular (dry-run) ─────────────────────────────────────────── */}
      <Dialog open={!!simTarget} onOpenChange={(open) => { if (!open) setSimTarget(null) }}>
        <DialogContent className='max-w-3xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Simular «{simTarget?.name}»</DialogTitle>
            <DialogDescription>
              Dry-run real contra el historial de sesiones del cliente. No escribe nada ni genera sugerencias reales.
            </DialogDescription>
          </DialogHeader>

          <div className='grid grid-cols-2 gap-3'>
            <Field className='gap-2'>
              <FieldLabel>Cliente</FieldLabel>
              <Select value={simClientId} onValueChange={v => setSimClientId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Seleccionar cliente' /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Ejercicio (opcional si el scope ya es un ejercicio específico)</FieldLabel>
              <Select value={simExerciseId} onValueChange={v => setSimExerciseId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Seleccionar ejercicio' /></SelectTrigger>
                <SelectContent>
                  {exercises.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className='flex justify-end'>
            <Button onClick={runSimulate} disabled={simLoading || !simClientId}>
              {simLoading ? 'Simulando...' : 'Simular'}
            </Button>
          </div>

          {simResults && (
            <div className='space-y-2'>
              <div className='rounded-lg border bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-950 p-2.5 text-xs flex items-center gap-1.5'>
                <FlaskConical className='size-3.5 shrink-0' />
                Dry-run — {simMeta?.sessions_evaluated ?? simResults.length} sesiones evaluadas, no se escribió ningún dato real
                {simMeta?.next_session_targets_untouched ? ' (confirmado).' : '.'}
              </div>
              {simResults.length === 0 ? (
                <p className='text-sm text-muted-foreground py-6 text-center'>No hay sesiones históricas para este cliente/ejercicio.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sesión</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Peso propuesto</TableHead>
                      <TableHead>Reps propuestas</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simResults.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className='text-xs'>#{r.session_id} · {r.evaluated_at ? new Date(r.evaluated_at).toLocaleDateString() : '—'}</TableCell>
                        <TableCell className='text-xs'>{REASON_LABELS[r.reason] || r.reason}</TableCell>
                        <TableCell className='text-xs'>{r.action_type ? (ACTION_TYPE_LABELS[r.action_type as ActionTypeVal] || r.action_type) : '—'}</TableCell>
                        <TableCell className='text-xs'>{r.proposed_weight ?? '—'}</TableCell>
                        <TableCell className='text-xs'>{r.proposed_reps ?? '—'}</TableCell>
                        <TableCell className='text-xs'>{r.status ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Auditoría ──────────────────────────────────────────────────── */}
      <Dialog open={!!auditTarget} onOpenChange={(open) => { if (!open) setAuditTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auditoría de «{auditTarget?.name}»</DialogTitle>
            <DialogDescription>Cuántas veces el coach aceptó, editó o rechazó las sugerencias generadas por esta regla.</DialogDescription>
          </DialogHeader>
          {auditLoading ? (
            <div className='flex justify-center py-8'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
          ) : auditData ? (
            <div className='space-y-5'>
              <div className='grid grid-cols-2 gap-3'>
                <div className='rounded-lg border p-3 text-center'>
                  <p className='text-2xl font-semibold'>{auditData.total_logs}</p>
                  <p className='text-xs text-muted-foreground'>Sugerencias resueltas</p>
                </div>
                <div className='rounded-lg border p-3 text-center'>
                  <p className='text-2xl font-semibold'>{auditData.targets_generated}</p>
                  <p className='text-xs text-muted-foreground'>Sugerencias generadas en total</p>
                </div>
              </div>
              <div className='space-y-3'>
                {(['accepted', 'edited', 'rejected'] as const).map(k => (
                  <div key={k}>
                    <div className='flex items-center justify-between text-xs mb-1'>
                      <span>{k === 'accepted' ? 'Aceptadas' : k === 'edited' ? 'Editadas' : 'Rechazadas'}</span>
                      <span className='text-muted-foreground'>{auditData.percentages?.[k] ?? 0}% ({auditData.counts?.[k] ?? 0})</span>
                    </div>
                    <Progress value={auditData.percentages?.[k] ?? 0}>
                      <ProgressTrack><ProgressIndicator /></ProgressTrack>
                    </Progress>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProgressionRulesView
