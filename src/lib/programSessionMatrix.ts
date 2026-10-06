// Lógica pura del editor de sesiones a nivel programa ("matriz"): un tipo de
// sesión (Empuje, Torso A...) con todas sus semanas como columnas y la unión
// de sus ejercicios como filas. Sin React ni red -- ver ProgramSessionMatrixEditor.
//
// Backend: GET admin/program-session-matrix y POST admin/program-session-matrix-save
// (Bckbs::ProgramSessionMatrixService).

import { formatDuration, parseDistance, parseDuration } from './blockKinds'

export type MatrixCellApi = {
  id: number
  block_id: number
  sequence: number
  prescribed: Record<string, unknown> | unknown[] | null
  enabled_metrics: string[] | null
  notes: string | null
}

export type MatrixColumn = {
  assignment_id: number
  week_number: number
  day_of_week: number
  is_deload: boolean
  scheduled_date: string | null
  workout_template_id: number
  template_title: string
  /** Otras semanas de este programa que usan la MISMA plantilla (se desvincula al guardar si se edita). */
  linked_weeks: number[]
  linked_elsewhere: number
}

export type MatrixRow = {
  row_key: string
  exercise_id: number
  exercise_title: string
  block_title: string | null
  cells: Record<string, MatrixCellApi>
}

export type MatrixSlot = {
  key: string
  label: string
  columns: MatrixColumn[]
  rows: MatrixRow[]
}

// `tiempo` es la clave única de tiempo (contrato Hyrox, fase 0.2): `duracion`
// (importador Excel y matriz antiguos) se sigue LEYENDO como alias, pero
// siempre se escribe `tiempo`, en segundos enteros (se teclea en mm:ss).
export type FieldKey = 'series' | 'reps' | 'carga' | 'intensity' | 'descanso' | 'tempo' | 'tiempo' | 'distancia'
export type IntensityKey = 'rir' | 'rpe'

/** Columnas visibles por defecto. */
export const FIELD_KEYS: FieldKey[] = ['series', 'reps', 'carga', 'intensity', 'descanso']
/** Columnas que se pueden mostrar/ocultar desde "Columnas". */
export const OPTIONAL_FIELD_KEYS: FieldKey[] = ['tempo', 'tiempo', 'distancia']
export const ALL_FIELD_KEYS: FieldKey[] = [...FIELD_KEYS, ...OPTIONAL_FIELD_KEYS]
export const FIELD_LABELS: Record<FieldKey, string> = {
  series: 'Series',
  reps: 'Reps',
  carga: 'Carga',
  intensity: 'RIR/RPE',
  descanso: 'Desc.',
  tempo: 'Tempo',
  tiempo: 'Tiempo',
  distancia: 'Dist. (m)',
}

/**
 * Valor canónico de un campo para guardar/comparar: `tiempo` en segundos
 * ("5:00" → "300"), `distancia` en metros ("5km" → "5000"). Lo que no se
 * entiende como tiempo/distancia («máx») se deja tal cual.
 */
export function canonicalFieldValue(field: FieldKey, value: string | undefined): string {
  const v = (value ?? '').trim()
  if (!v) return ''
  if (field === 'tiempo') {
    const sec = parseDuration(v)
    return sec === null ? v : String(sec)
  }
  if (field === 'distancia') {
    const m = parseDistance(v)
    return m === null ? v : String(m)
  }
  return v
}

/** Cómo se muestra en la celda: tiempo en mm:ss. */
function displayFieldValue(field: FieldKey, raw: string): string {
  if (field === 'tiempo' && /^\d+$/.test(raw.trim())) return formatDuration(Number(raw.trim()))
  return raw
}

const sameField = (f: FieldKey, a: string | undefined, b: string | undefined) => canonicalFieldValue(f, a) === canonicalFieldValue(f, b)

/** Campos visibles en el orden canónico: los de por defecto + los opcionales elegidos. */
export function visibleFields(optional: readonly FieldKey[] = []): FieldKey[] {
  return [...FIELD_KEYS, ...OPTIONAL_FIELD_KEYS.filter(f => optional.includes(f))]
}
export const DEFAULT_METRICS = ['reps', 'carga', 'descanso', 'rir']

/**
 * Técnica especial de un ejercicio en una semana (Bckbs App\Support\TrainingTechniques):
 * key '' = sin técnica; series 'ultima' = solo la última serie; otra = texto si key es 'otra'.
 */
export type TechniqueDraft = {
  key: string
  series: 'todas' | 'ultima'
  otra: string
  /** «Pedir grabación» de ese ejercicio esa semana; ausente = no se pide. */
  recording?: RecordingDraft
}
export const NO_TECHNIQUE: TechniqueDraft = { key: '', series: 'todas', otra: '' }

/**
 * «Pedir grabación» (Bckbs App\Support\RecordingRequests): viaja con la técnica en el
 * `prescribed` como grabar (true) / grabar_series ('todas' | 'primera' | 'ultima') / grabar_nota.
 */
export type RecordingSeries = 'todas' | 'primera' | 'ultima'
export type RecordingDraft = { on: boolean; series: RecordingSeries; nota: string }
export const NO_RECORDING: RecordingDraft = { on: false, series: 'todas', nota: '' }
export const RECORDING_SERIES_LABELS: Record<RecordingSeries, string> = {
  todas: 'Todas las series',
  primera: 'Solo la primera',
  ultima: 'Solo la última',
}

/** true, 1, "1", "true"... (el backend guarda `true`; la matriz puede devolverlo como texto). */
export function isTruthyFlag(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v !== 'string') return false
  const s = v.trim().toLowerCase()
  return s !== '' && !['0', 'false', 'no'].includes(s)
}

/** Petición de grabación guardada en un `prescribed`. */
export function recordingFromPrescribed(p: Record<string, unknown> | null | undefined): RecordingDraft {
  if (!p || !isTruthyFlag(p.grabar)) return { ...NO_RECORDING }
  const series = String(p.grabar_series ?? '')
  return {
    on: true,
    series: series === 'primera' || series === 'ultima' ? series : 'todas',
    nota: p.grabar_nota === null || p.grabar_nota === undefined ? '' : String(p.grabar_nota),
  }
}

/** Claves de grabación para `prescribed` (vacío si no se pide). */
export function recordingPrescribed(r: RecordingDraft | undefined): Record<string, string> {
  if (!r?.on) return {}
  const nota = (r.nota ?? '').trim()
  return { grabar: '1', grabar_series: r.series, ...(nota ? { grabar_nota: nota } : {}) }
}

export function recordingEquals(a: RecordingDraft | undefined, b: RecordingDraft | undefined): boolean {
  const x = a ?? NO_RECORDING
  const y = b ?? NO_RECORDING
  if (x.on !== y.on) return false
  if (!x.on) return true
  return x.series === y.series && (x.nota ?? '').trim() === (y.nota ?? '').trim()
}

/** «🎥 última serie · de lado» -- texto corto de la petición ('' si no hay). */
export function recordingSummary(r: RecordingDraft | undefined): string {
  if (!r?.on) return ''
  const series = r.series === 'todas' ? 'todas las series' : r.series === 'primera' ? 'primera serie' : 'última serie'
  const nota = (r.nota ?? '').trim()
  return nota ? `${series} · ${nota}` : series
}

export type CellDraft = {
  values: Record<FieldKey, string>
  intensityKey: IntensityKey
  enabledMetrics: string[]
  /** Notas del entrenador para este ejercicio en esta sesión ('' = sin nota). */
  notes: string
  technique: TechniqueDraft
}

/** draft[assignment_id][row_key] -- ausente = el ejercicio no está en esa sesión. */
export type Draft = Record<number, Record<string, CellDraft | undefined>>

export type Substitution = { exerciseId: number; title: string }
export type Substitutions = Record<string, Substitution | undefined>

// ---------------------------------------------------------------------------
// Construcción del borrador desde la API
// ---------------------------------------------------------------------------

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

function prescribedOf(cell: MatrixCellApi): Record<string, unknown> {
  const p = cell.prescribed
  return p && !Array.isArray(p) ? (p as Record<string, unknown>) : {}
}

export function intensityKeyOf(metrics: string[] | null | undefined): IntensityKey {
  const m = metrics ?? []
  // Mismo criterio que el editor de bloques: RIR gana si vinieran los dos.
  return !m.includes('rir') && m.includes('rpe') ? 'rpe' : 'rir'
}

export function cellFromApi(cell: MatrixCellApi): CellDraft {
  const p = prescribedOf(cell)
  const intensityKey = intensityKeyOf(cell.enabled_metrics)
  return {
    values: {
      series: str(p.series),
      reps: str(p.reps),
      carga: str(p.carga),
      intensity: str(p[intensityKey]),
      descanso: str(p.descanso),
      tempo: str(p.tempo),
      tiempo: displayFieldValue('tiempo', str(p.tiempo) || str(p.duracion)),
      distancia: str(p.distancia),
    },
    intensityKey,
    enabledMetrics: cell.enabled_metrics && cell.enabled_metrics.length
      ? [...new Set(cell.enabled_metrics.map(m => (m === 'duracion' ? 'tiempo' : m)))]
      : [...DEFAULT_METRICS],
    notes: str(cell.notes),
    technique: {
      ...(str(p.tecnica)
        ? { key: str(p.tecnica), series: str(p.tecnica_series) === 'ultima' ? 'ultima' : 'todas', otra: str(p.tecnica_otra) }
        : { ...NO_TECHNIQUE }),
      ...(isTruthyFlag(p.grabar) ? { recording: recordingFromPrescribed(p) } : {}),
    },
  }
}

export function emptyCell(intensityKey: IntensityKey = 'rir'): CellDraft {
  return {
    values: { series: '', reps: '', carga: '', intensity: '', descanso: '', tempo: '', tiempo: '', distancia: '' },
    intensityKey,
    enabledMetrics: DEFAULT_METRICS.map(m => (m === 'rir' ? intensityKey : m)),
    notes: '',
    technique: { ...NO_TECHNIQUE },
  }
}

export function buildDraft(slot: MatrixSlot): Draft {
  const draft: Draft = {}
  for (const col of slot.columns) {
    draft[col.assignment_id] = {}
    for (const row of slot.rows) {
      const cell = row.cells[String(col.assignment_id)]
      if (cell) draft[col.assignment_id][row.row_key] = cellFromApi(cell)
    }
  }
  return draft
}

const cloneCell = (c: CellDraft): CellDraft => ({
  values: { ...c.values },
  intensityKey: c.intensityKey,
  enabledMetrics: [...c.enabledMetrics],
  notes: c.notes,
  technique: { ...c.technique },
})

export function cloneDraft(d: Draft): Draft {
  const out: Draft = {}
  for (const [a, rows] of Object.entries(d)) {
    out[Number(a)] = {}
    for (const [k, c] of Object.entries(rows)) out[Number(a)][k] = c ? cloneCell(c) : undefined
  }
  return out
}

// ---------------------------------------------------------------------------
// Edición
// ---------------------------------------------------------------------------

export function setValue(draft: Draft, assignmentId: number, rowKey: string, field: FieldKey, value: string): Draft {
  const next = cloneDraft(draft)
  const cell = next[assignmentId]?.[rowKey] ?? emptyCell()
  cell.values[field] = value
  next[assignmentId] = { ...(next[assignmentId] ?? {}), [rowKey]: cell }
  return next
}

/** Cambia RIR<->RPE en una celda: mueve el valor a la clave nueva y ajusta enabled_metrics. */
export function setIntensityKey(draft: Draft, assignmentId: number, rowKey: string, key: IntensityKey): Draft {
  const next = cloneDraft(draft)
  const cell = next[assignmentId]?.[rowKey]
  if (!cell || cell.intensityKey === key) return next
  cell.intensityKey = key
  cell.enabledMetrics = [...cell.enabledMetrics.filter(m => m !== 'rir' && m !== 'rpe'), key]
  return next
}

export function addCell(draft: Draft, assignmentId: number, rowKey: string, like?: CellDraft): Draft {
  const next = cloneDraft(draft)
  next[assignmentId] = { ...(next[assignmentId] ?? {}), [rowKey]: like ? cloneCell(like) : emptyCell() }
  return next
}

export function removeCell(draft: Draft, assignmentId: number, rowKey: string): Draft {
  const next = cloneDraft(draft)
  if (next[assignmentId]) next[assignmentId][rowKey] = undefined
  return next
}

export function removeRow(draft: Draft, rowKey: string): Draft {
  const next = cloneDraft(draft)
  for (const a of Object.keys(next)) next[Number(a)][rowKey] = undefined
  return next
}

/** "Rellenar hacia la derecha": copia la celda de la columna `fromIndex` a las columnas siguientes (creándola si falta). */
export function fillRight(draft: Draft, slot: MatrixSlot, rowKey: string, fromIndex: number): Draft {
  const source = draft[slot.columns[fromIndex]?.assignment_id]?.[rowKey]
  if (!source) return draft
  const next = cloneDraft(draft)
  for (let i = fromIndex + 1; i < slot.columns.length; i++) {
    const a = slot.columns[i].assignment_id
    next[a] = { ...(next[a] ?? {}), [rowKey]: cloneCell(source) }
  }
  return next
}

// ---------------------------------------------------------------------------
// Pegar desde Excel / Sheets (TSV)
// ---------------------------------------------------------------------------

export function parsePaste(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines.map(l => l.split('\t').map(c => c.trim()))
}

/** True si el texto pegado es una rejilla (más de una celda), no un valor suelto. */
export function isGridPaste(text: string): boolean {
  return /\t|\n/.test(text.replace(/\n$/, ''))
}

/**
 * Pega una rejilla empezando en (fila, columna de semana, campo). Recorre los campos de cada semana
 * (series, reps, carga, RIR/RPE, desc.) y luego salta a la semana siguiente; cada línea baja una fila.
 */
export function applyPaste(
  draft: Draft,
  slot: MatrixSlot,
  start: { rowIndex: number; colIndex: number; fieldIndex: number },
  grid: string[][],
  /** Campos visibles por semana, en orden (por defecto los 5 de siempre). */
  fields: readonly FieldKey[] = FIELD_KEYS,
): Draft {
  let next = draft
  const F = fields.length
  const startFlat = start.colIndex * F + start.fieldIndex
  grid.forEach((line, i) => {
    const row = slot.rows[start.rowIndex + i]
    if (!row) return
    line.forEach((value, j) => {
      const flat = startFlat + j
      const colIndex = Math.floor(flat / F)
      const field = fields[flat % F]
      const col = slot.columns[colIndex]
      if (!col) return
      next = setValue(next, col.assignment_id, row.row_key, field, value)
    })
  })
  return next
}

// ---------------------------------------------------------------------------
// Diferencias -> cambios para la API
// ---------------------------------------------------------------------------

export type ApiChange =
  | { type: 'update'; assignment_id: number; row_id: number; prescribed?: Record<string, string>; enabled_metrics?: string[]; notes?: string | null }
  | { type: 'add'; assignment_id: number; exercise_id: number; prescribed: Record<string, string>; enabled_metrics: string[]; notes?: string | null }
  | { type: 'remove'; assignment_id: number; row_id: number }
  | { type: 'substitute'; assignment_id: number; row_id: number; exercise_id: number }
  | { type: 'reorder'; assignment_id: number; order: number[] }

export type ChangeLine = {
  assignmentId: number
  rowKey: string
  kind: 'update' | 'add' | 'remove' | 'substitute' | 'reorder'
  text: string
}

export type ComputedChanges = {
  changes: ApiChange[]
  lines: ChangeLine[]
  /** assignment_id con plantilla compartida que se desvinculará al guardar. */
  unlinkAssignments: number[]
  deload: { week_number: number; is_deload: boolean }[]
}

const trim = (s: string | undefined) => (s ?? '').trim()

function prescribedFromCell(cell: CellDraft): Record<string, string> {
  const out: Record<string, string> = {}
  if (trim(cell.values.series)) out.series = trim(cell.values.series)
  if (trim(cell.values.reps)) out.reps = trim(cell.values.reps)
  if (trim(cell.values.carga)) out.carga = trim(cell.values.carga)
  if (trim(cell.values.descanso)) out.descanso = trim(cell.values.descanso)
  if (trim(cell.values.tempo)) out.tempo = trim(cell.values.tempo)
  if (trim(cell.values.tiempo)) out.tiempo = canonicalFieldValue('tiempo', cell.values.tiempo)
  if (trim(cell.values.distancia)) out.distancia = canonicalFieldValue('distancia', cell.values.distancia)
  if (trim(cell.values.intensity)) out[cell.intensityKey] = trim(cell.values.intensity)
  return { ...out, ...techniquePrescribed(cell.technique), ...recordingPrescribed(cell.technique.recording) }
}

/** Claves de técnica para `prescribed`; '' = quitar (el backend limpia las demás). */
function techniquePrescribed(t: TechniqueDraft): Record<string, string> {
  if (!trim(t.key)) return {}
  return { tecnica: t.key, tecnica_series: t.series, ...(t.key === 'otra' ? { tecnica_otra: trim(t.otra) } : {}) }
}

export function techniqueEquals(a: TechniqueDraft, b: TechniqueDraft): boolean {
  if (trim(a.key) !== trim(b.key)) return false
  if (!trim(a.key)) return true
  return a.series === b.series && (a.key !== 'otra' || trim(a.otra) === trim(b.otra))
}

export function columnLabel(col: MatrixColumn): string {
  return `Sem ${col.week_number} · Día ${col.day_of_week}`
}

export function computeChanges(
  slot: MatrixSlot,
  draft: Draft,
  substitutions: Substitutions = {},
  deloadState: Record<number, boolean> = {},
): ComputedChanges {
  const changes: ApiChange[] = []
  const lines: ChangeLine[] = []
  const touched = new Set<number>()

  for (const col of slot.columns) {
    const a = col.assignment_id
    for (const row of slot.rows) {
      const orig = row.cells[String(a)]
      const cur = draft[a]?.[row.row_key]
      const sub = substitutions[row.row_key]
      const title = sub ? sub.title : row.exercise_title
      const where = `${columnLabel(col)} · ${title}`

      if (orig && !cur) {
        changes.push({ type: 'remove', assignment_id: a, row_id: orig.id })
        lines.push({ assignmentId: a, rowKey: row.row_key, kind: 'remove', text: `${where}: quitar ejercicio` })
        touched.add(a)
        continue
      }
      if (!orig && cur) {
        changes.push({
          type: 'add', assignment_id: a, exercise_id: sub?.exerciseId ?? row.exercise_id,
          prescribed: prescribedFromCell(cur), enabled_metrics: cur.enabledMetrics,
          ...(trim(cur.notes) ? { notes: trim(cur.notes) } : {}),
        })
        const p = prescribedFromCell(cur)
        lines.push({ assignmentId: a, rowKey: row.row_key, kind: 'add', text: `${where}: añadir (${Object.entries(p).map(([k, v]) => `${k} ${v}`).join(', ') || 'sin datos'})` })
        touched.add(a)
        continue
      }
      if (!orig || !cur) continue

      if (sub && sub.exerciseId !== row.exercise_id) {
        changes.push({ type: 'substitute', assignment_id: a, row_id: orig.id, exercise_id: sub.exerciseId })
        lines.push({ assignmentId: a, rowKey: row.row_key, kind: 'substitute', text: `${columnLabel(col)} · ${row.exercise_title} → ${sub.title}` })
        touched.add(a)
      }

      const before = cellFromApi(orig)
      const patch: Record<string, string> = {}
      const fieldLines: string[] = []

      for (const f of ['series', 'reps', 'carga', 'descanso', 'tempo', 'tiempo', 'distancia'] as const) {
        if (!sameField(f, before.values[f], cur.values[f])) {
          patch[f] = canonicalFieldValue(f, cur.values[f])
          // El dato viejo en `duracion` se borra al escribir `tiempo` ('' = quitar).
          if (f === 'tiempo' && str(prescribedOf(orig).duracion)) patch.duracion = ''
          fieldLines.push(`${FIELD_LABELS[f]} "${trim(before.values[f]) || '—'}" → "${trim(cur.values[f]) || '—'}"`)
        }
      }
      const keyChanged = before.intensityKey !== cur.intensityKey
      if (keyChanged || trim(before.values.intensity) !== trim(cur.values.intensity)) {
        if (keyChanged) patch[before.intensityKey] = ''
        patch[cur.intensityKey] = trim(cur.values.intensity)
        fieldLines.push(`${cur.intensityKey.toUpperCase()} "${trim(before.values.intensity) || '—'}" → "${trim(cur.values.intensity) || '—'}"`)
      }

      if (!techniqueEquals(before.technique, cur.technique)) {
        const t = techniquePrescribed(cur.technique)
        patch.tecnica = t.tecnica ?? ''
        patch.tecnica_series = t.tecnica_series ?? ''
        patch.tecnica_otra = t.tecnica_otra ?? ''
        const label = (x: TechniqueDraft) => (trim(x.key) ? `${x.key === 'otra' ? trim(x.otra) || 'otra' : x.key}${x.series === 'ultima' ? ' (última serie)' : ''}` : '—')
        fieldLines.push(`Técnica ${label(before.technique)} → ${label(cur.technique)}`)
      }

      if (!recordingEquals(before.technique.recording, cur.technique.recording)) {
        const r = recordingPrescribed(cur.technique.recording)
        patch.grabar = r.grabar ?? ''
        patch.grabar_series = r.grabar_series ?? ''
        patch.grabar_nota = r.grabar_nota ?? ''
        const label = (x: RecordingDraft | undefined) => recordingSummary(x) || 'no'
        fieldLines.push(`Grabar ${label(before.technique.recording)} → ${label(cur.technique.recording)}`)
      }

      const notesChanged = trim(before.notes) !== trim(cur.notes)
      if (notesChanged) {
        fieldLines.push(`Notas ${trim(before.notes) ? `"${trim(before.notes).slice(0, 30)}"` : '—'} → ${trim(cur.notes) ? `"${trim(cur.notes).slice(0, 30)}"` : '(sin nota)'}`)
      }

      if (fieldLines.length) {
        const change: ApiChange = { type: 'update', assignment_id: a, row_id: orig.id }
        if (Object.keys(patch).length) change.prescribed = patch
        if (keyChanged) change.enabled_metrics = cur.enabledMetrics
        if (notesChanged) change.notes = trim(cur.notes) || null
        changes.push(change)
        lines.push({ assignmentId: a, rowKey: row.row_key, kind: 'update', text: `${where}: ${fieldLines.join(' · ')}` })
        touched.add(a)
      }
    }
  }

  const deload: ComputedChanges['deload'] = []
  const seenWeeks = new Set<number>()
  for (const col of slot.columns) {
    if (seenWeeks.has(col.week_number)) continue
    seenWeeks.add(col.week_number)
    const now = deloadState[col.week_number]
    if (now !== undefined && now !== col.is_deload) deload.push({ week_number: col.week_number, is_deload: now })
  }

  const unlinkAssignments = slot.columns
    .filter(c => touched.has(c.assignment_id) && (c.linked_weeks.length > 0 || c.linked_elsewhere > 0))
    .map(c => c.assignment_id)

  return { changes, lines, unlinkAssignments, deload }
}

export function cellIsDirty(orig: MatrixCellApi | undefined, cur: CellDraft | undefined): boolean {
  if (!orig && !cur) return false
  if (!orig || !cur) return true
  const before = cellFromApi(orig)
  return (
    before.intensityKey !== cur.intensityKey ||
    trim(before.notes) !== trim(cur.notes) ||
    !techniqueEquals(before.technique, cur.technique) ||
    !recordingEquals(before.technique.recording, cur.technique.recording) ||
    ALL_FIELD_KEYS.some(f => !sameField(f, before.values[f], cur.values[f]))
  )
}

// ---------------------------------------------------------------------------
// Notas, orden de ejercicios y edición en bloque
// ---------------------------------------------------------------------------

export function setNotes(draft: Draft, assignmentId: number, rowKey: string, notes: string): Draft {
  const next = cloneDraft(draft)
  const cell = next[assignmentId]?.[rowKey]
  if (!cell) return next
  cell.notes = notes
  return next
}

/**
 * Pone (o quita, con NO_TECHNIQUE) la técnica de un ejercicio en una semana y, si
 * `following`, también en las semanas siguientes en las que ese ejercicio está.
 */
export function setTechnique(draft: Draft, slot: MatrixSlot, assignmentId: number, rowKey: string, technique: TechniqueDraft, following = false): Draft {
  const next = cloneDraft(draft)
  const from = slot.columns.findIndex(c => c.assignment_id === assignmentId)
  const targets = following && from >= 0 ? slot.columns.slice(from).map(c => c.assignment_id) : [assignmentId]
  for (const a of targets) {
    const cell = next[a]?.[rowKey]
    if (cell) cell.technique = { ...technique }
  }
  return next
}

/** Orden inicial de filas de un tipo de sesión. */
export const initialOrder = (rows: readonly MatrixRow[]): string[] => rows.map(r => r.row_key)

export function orderedRows(rows: readonly MatrixRow[], order: readonly string[] | undefined): MatrixRow[] {
  if (!order || order.length === 0) return [...rows]
  const pos = new Map(order.map((k, i) => [k, i]))
  return [...rows].sort((a, b) => (pos.get(a.row_key) ?? 1e9) - (pos.get(b.row_key) ?? 1e9))
}

/**
 * Sube (-1) o baja (+1) una fila intercambiándola con su vecina. Solo se mueve dentro de su bloque
 * (mismo título de bloque): cambiar un ejercicio de bloque no forma parte de esta edición.
 * Devuelve el mismo array si no se puede mover.
 */
export function moveRow(order: readonly string[], rows: readonly MatrixRow[], rowKey: string, dir: -1 | 1): string[] {
  const byKey = new Map(rows.map(r => [r.row_key, r]))
  const i = order.indexOf(rowKey)
  const j = i + dir
  if (i < 0 || j < 0 || j >= order.length) return order as string[]
  if ((byKey.get(order[i])?.block_title ?? null) !== (byKey.get(order[j])?.block_title ?? null)) return order as string[]
  const next = [...order]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export const orderChanged = (order: readonly string[] | undefined, rows: readonly MatrixRow[]): boolean => {
  if (!order) return false
  const base = initialOrder(rows)
  return order.length === base.length && order.some((k, i) => k !== base[i])
}

/** Una operación `reorder` por sesión (columna), con los ids de fila existentes en el orden nuevo. */
export function computeReorder(slot: MatrixSlot, order: readonly string[] | undefined): { changes: ApiChange[]; lines: ChangeLine[] } {
  // El orden puede incluir filas nuevas (sin celdas originales): se compara solo sobre las originales.
  const originals = slot.rows.filter(r => Object.keys(r.cells).length > 0)
  const filtered = (order ?? []).filter(k => originals.some(r => r.row_key === k))
  if (!orderChanged(filtered, originals)) return { changes: [], lines: [] }

  const changes: ApiChange[] = []
  const lines: ChangeLine[] = []
  for (const col of slot.columns) {
    const ids = (order ?? [])
      .map(k => slot.rows.find(r => r.row_key === k)?.cells[String(col.assignment_id)]?.id)
      .filter((id): id is number => typeof id === 'number')
    if (ids.length > 1) {
      changes.push({ type: 'reorder', assignment_id: col.assignment_id, order: ids })
      lines.push({ assignmentId: col.assignment_id, rowKey: '', kind: 'reorder', text: `${columnLabel(col)}: nuevo orden de los ejercicios` })
    }
  }
  return { changes, lines }
}

// ---------------------------------------------------------------------------
// Cascada por ejercicio: parte de la primera semana rellenada y va sumando/restando semana a semana
// ---------------------------------------------------------------------------

export type CascadeField = 'series' | 'reps' | 'intensity' | 'descanso' | 'tiempo'
export const CASCADE_FIELDS: CascadeField[] = ['series', 'reps', 'intensity', 'descanso', 'tiempo']
export type CargaHint = '' | 'Mantener' | 'Subir' | 'Bajar'
export const CARGA_HINTS: CargaHint[] = ['Mantener', 'Subir', 'Bajar']

export type CascadeSpec = {
  /** Incremento por semana (p. ej. +1, +2, -1). 0 o ausente = no tocar el campo. */
  steps: Partial<Record<CascadeField, number>>
  /** Indicación textual de carga por semana: índice 0 = semana siguiente a la base. '' = no tocar. */
  carga: CargaHint[]
}

const NUM = /^(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?$/

/**
 * Suma `delta` a un valor numérico ("3" → "4"; rangos "8-10" → "9-11"; decimales "7,5").
 * Texto no numérico ("AMRAP", "fallo") se devuelve tal cual.
 */
export function shiftNumeric(value: string, delta: number, min = 0, max = Infinity): string {
  const m = NUM.exec(value.trim())
  if (!m) return value
  const comma = value.includes(',')
  const one = (x: string) => {
    const n = Math.min(max, Math.max(min, parseFloat(x.replace(',', '.')) + delta))
    const out = String(Math.round(n * 100) / 100)
    return comma ? out.replace('.', ',') : out
  }
  return m[2] !== undefined ? `${one(m[1])}-${one(m[2])}` : one(m[1])
}

const CASCADE_LIMITS: Record<CascadeField, { min: number; max: number }> = {
  series: { min: 1, max: 99 },
  reps: { min: 1, max: 999 },
  intensity: { min: 0, max: 10 },
  descanso: { min: 0, max: 3600 },
  tiempo: { min: 0, max: 36000 },
}

/** Semanas distintas del tipo de sesión, en orden. */
export function slotWeeks(slot: MatrixSlot): number[] {
  return [...new Set(slot.columns.map(c => c.week_number))].sort((a, b) => a - b)
}

/** Columna de partida de un ejercicio: la de la primera semana donde ya existe en el borrador. */
export function cascadeBase(draft: Draft, slot: MatrixSlot, rowKey: string): MatrixColumn | null {
  const sorted = [...slot.columns].sort((a, b) => a.week_number - b.week_number)
  return sorted.find(c => draft[c.assignment_id]?.[rowKey]) ?? null
}

/**
 * Aplica la cascada SOLO a este ejercicio. La semana base no se toca; en la semana n-ésima posterior
 * cada campo con incremento vale `base + incremento × n`. Solo se escribe donde el ejercicio ya existe
 * (no se crean celdas) y solo en campos que la base ya tiene rellenados.
 */
export function cascadeRow(draft: Draft, slot: MatrixSlot, rowKey: string, spec: CascadeSpec): Draft {
  const base = cascadeBase(draft, slot, rowKey)
  if (!base) return draft
  const baseCell = draft[base.assignment_id][rowKey]!
  const weeks = slotWeeks(slot).filter(w => w > base.week_number)
  let next = draft
  for (const col of slot.columns) {
    const n = weeks.indexOf(col.week_number) + 1
    if (n === 0 || !next[col.assignment_id]?.[rowKey]) continue
    for (const f of CASCADE_FIELDS) {
      const step = spec.steps[f]
      if (!step) continue
      const from = baseCell.values[f]
      if (!from.trim()) continue
      const { min, max } = CASCADE_LIMITS[f]
      const value = shiftNumeric(from, step * n, min, f === 'intensity' && baseCell.intensityKey === 'rir' ? 6 : max)
      if (value !== next[col.assignment_id][rowKey]!.values[f]) next = setValue(next, col.assignment_id, rowKey, f, value)
    }
    const hint = spec.carga[n - 1]
    if (hint) next = setValue(next, col.assignment_id, rowKey, 'carga', hint)
  }
  return next
}

/** Agrupa las columnas por semana (una semana puede tener más de una sesión de este tipo). */
export function weekLabel(col: MatrixColumn): string {
  return col.scheduled_date ? `Sem ${col.week_number} · ${col.scheduled_date}` : `Sem ${col.week_number}`
}
