// Lógica pura del editor de sesiones a nivel programa ("matriz"): un tipo de
// sesión (Empuje, Torso A...) con todas sus semanas como columnas y la unión
// de sus ejercicios como filas. Sin React ni red -- ver ProgramSessionMatrixEditor.
//
// Backend: GET admin/program-session-matrix y POST admin/program-session-matrix-save
// (Bckbs::ProgramSessionMatrixService).

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

export type FieldKey = 'series' | 'reps' | 'carga' | 'intensity' | 'descanso'
export type IntensityKey = 'rir' | 'rpe'

export const FIELD_KEYS: FieldKey[] = ['series', 'reps', 'carga', 'intensity', 'descanso']
export const FIELD_LABELS: Record<FieldKey, string> = {
  series: 'Series',
  reps: 'Reps',
  carga: 'Carga',
  intensity: 'RIR/RPE',
  descanso: 'Desc.',
}
export const DEFAULT_METRICS = ['reps', 'carga', 'descanso', 'rir']

export type CellDraft = {
  values: Record<FieldKey, string>
  intensityKey: IntensityKey
  enabledMetrics: string[]
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
    },
    intensityKey,
    enabledMetrics: cell.enabled_metrics && cell.enabled_metrics.length ? [...cell.enabled_metrics] : [...DEFAULT_METRICS],
  }
}

export function emptyCell(intensityKey: IntensityKey = 'rir'): CellDraft {
  return {
    values: { series: '', reps: '', carga: '', intensity: '', descanso: '' },
    intensityKey,
    enabledMetrics: DEFAULT_METRICS.map(m => (m === 'rir' ? intensityKey : m)),
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

const cloneCell = (c: CellDraft): CellDraft => ({ values: { ...c.values }, intensityKey: c.intensityKey, enabledMetrics: [...c.enabledMetrics] })

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
): Draft {
  let next = draft
  const F = FIELD_KEYS.length
  const startFlat = start.colIndex * F + start.fieldIndex
  grid.forEach((line, i) => {
    const row = slot.rows[start.rowIndex + i]
    if (!row) return
    line.forEach((value, j) => {
      const flat = startFlat + j
      const colIndex = Math.floor(flat / F)
      const field = FIELD_KEYS[flat % F]
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
  | { type: 'update'; assignment_id: number; row_id: number; prescribed?: Record<string, string>; enabled_metrics?: string[] }
  | { type: 'add'; assignment_id: number; exercise_id: number; prescribed: Record<string, string>; enabled_metrics: string[] }
  | { type: 'remove'; assignment_id: number; row_id: number }
  | { type: 'substitute'; assignment_id: number; row_id: number; exercise_id: number }

export type ChangeLine = {
  assignmentId: number
  rowKey: string
  kind: 'update' | 'add' | 'remove' | 'substitute'
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
  if (trim(cell.values.intensity)) out[cell.intensityKey] = trim(cell.values.intensity)
  return out
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

      for (const f of ['series', 'reps', 'carga', 'descanso'] as const) {
        if (trim(before.values[f]) !== trim(cur.values[f])) {
          patch[f] = trim(cur.values[f])
          fieldLines.push(`${FIELD_LABELS[f]} "${trim(before.values[f]) || '—'}" → "${trim(cur.values[f]) || '—'}"`)
        }
      }
      const keyChanged = before.intensityKey !== cur.intensityKey
      if (keyChanged || trim(before.values.intensity) !== trim(cur.values.intensity)) {
        if (keyChanged) patch[before.intensityKey] = ''
        patch[cur.intensityKey] = trim(cur.values.intensity)
        fieldLines.push(`${cur.intensityKey.toUpperCase()} "${trim(before.values.intensity) || '—'}" → "${trim(cur.values.intensity) || '—'}"`)
      }

      if (fieldLines.length) {
        const change: ApiChange = { type: 'update', assignment_id: a, row_id: orig.id, prescribed: patch }
        if (keyChanged) change.enabled_metrics = cur.enabledMetrics
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
    FIELD_KEYS.some(f => trim(before.values[f]) !== trim(cur.values[f]))
  )
}

/** Agrupa las columnas por semana (una semana puede tener más de una sesión de este tipo). */
export function weekLabel(col: MatrixColumn): string {
  return col.scheduled_date ? `Sem ${col.week_number} · ${col.scheduled_date}` : `Sem ${col.week_number}`
}
