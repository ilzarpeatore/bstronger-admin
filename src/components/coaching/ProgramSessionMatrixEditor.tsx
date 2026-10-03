import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangleIcon, ArrowDownIcon, ArrowUpIcon, ChevronsRightIcon, Columns3Icon, LinkIcon, MoonIcon, MoreVerticalIcon, PlusIcon, RepeatIcon, SlidersHorizontalIcon, StickyNoteIcon, TrashIcon, VideoIcon, ZapIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import ExercisePickerPanel from '@/components/coaching/ExercisePickerPanel'
import { TechniqueFields } from '@/components/coaching/ExerciseTechniqueDialog'
import { cn } from '@/lib/utils'
import { OTHER_TECHNIQUE, techniqueLabel, useTrainingTechniques, type TrainingTechnique } from '@/lib/trainingTechniques'
import {
  CARGA_HINTS,
  CASCADE_FIELDS,
  FIELD_LABELS,
  OPTIONAL_FIELD_KEYS,
  addCell,
  applyPaste,
  buildDraft,
  cascadeBase,
  cascadeRow,
  cellFromApi,
  cellIsDirty,
  columnLabel,
  computeChanges,
  computeReorder,
  fillRight,
  isGridPaste,
  moveRow,
  orderedRows,
  parsePaste,
  removeCell,
  removeRow,
  slotWeeks,
  setIntensityKey,
  setNotes,
  recordingSummary,
  setTechnique,
  setValue,
  visibleFields,
  type ApiChange,
  type CargaHint,
  type CascadeField,
  type Draft,
  type FieldKey,
  type MatrixColumn,
  type MatrixRow,
  type MatrixSlot,
  type Substitutions,
  type TechniqueDraft,
  NO_TECHNIQUE,
} from '@/lib/programSessionMatrix'

type MatrixResponse = {
  program: { id: number; title: string; num_weeks: number; direct_clients?: { id: number; name: string }[] }
  slots: MatrixSlot[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: number
  /** Asignaciones seleccionadas en el calendario: abre solo sus tipos de sesión (todas sus semanas). */
  initialAssignmentIds?: number[] | null
  onSaved?: () => void
}

type ExerciseOption = { id: number; title: string }

const FIELD_WIDTH: Record<FieldKey, string> = {
  series: 'w-12',
  reps: 'w-24',
  carga: 'w-16',
  intensity: 'w-12',
  descanso: 'w-14',
  tempo: 'w-20',
  duracion: 'w-14',
}

const variantOf = (title: string) => title.match(/\(S\d+\)\s*$/i)?.[0]?.trim() ?? ''

export default function ProgramSessionMatrixEditor({ open, onOpenChange, programId, initialAssignmentIds, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MatrixResponse | null>(null)
  const [showAll, setShowAll] = useState(!initialAssignmentIds?.length)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  // Estado editable por tipo de sesión.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [subs, setSubs] = useState<Record<string, Substitutions>>({})
  const [extraRows, setExtraRows] = useState<Record<string, MatrixRow[]>>({})
  const [deload, setDeload] = useState<Record<number, boolean>>({})
  // Columnas opcionales visibles (tempo, duración) y orden de ejercicios por tipo de sesión.
  const [optionalFields, setOptionalFields] = useState<FieldKey[]>([])
  const fields = useMemo(() => visibleFields(optionalFields), [optionalFields])
  const [rowOrder, setRowOrder] = useState<Record<string, string[]>>({})
  const [notesEdit, setNotesEdit] = useState<{ assignmentId: number; rowKey: string; value: string } | null>(null)
  // Técnica especial de un ejercicio en una semana (y opcionalmente las siguientes)
  const techniques = useTrainingTechniques()
  const [techEdit, setTechEdit] = useState<{ assignmentId: number; rowKey: string; exercise: string; week: number; value: TechniqueDraft; following: boolean } | null>(null)
  // Cascada por ejercicio (semana 1 → siguientes)
  const [cascade, setCascade] = useState<{ rowKey: string; steps: Partial<Record<CascadeField, number>>; carga: CargaHint[] } | null>(null)

  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'substitute'; rowKey: string } | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ training_program_id: String(programId) })
      if (!showAll && initialAssignmentIds?.length) initialAssignmentIds.forEach(id => params.append('assignment_ids[]', String(id)))
      const res = await api.get(`/admin/program-session-matrix?${params}`)
      const d: MatrixResponse = res.data?.data || res.data
      setData(d)
      const nextDrafts: Record<string, Draft> = {}
      const nextDeload: Record<number, boolean> = {}
      for (const s of d.slots) {
        nextDrafts[s.key] = buildDraft(s)
        for (const c of s.columns) nextDeload[c.week_number] = c.is_deload
      }
      setDrafts(nextDrafts)
      setSubs({})
      setExtraRows({})
      setRowOrder({})
      setDeload(nextDeload)
      setActiveKey(prev => (prev && d.slots.some(s => s.key === prev) ? prev : d.slots[0]?.key ?? null))
    } catch (err: any) {
      toast.error(err?.message || 'Error al cargar las sesiones del programa')
    } finally {
      setLoading(false)
    }
  }, [programId, showAll, initialAssignmentIds])

  useEffect(() => { if (open) load() }, [open, load])

  // Slot activo con las filas añadidas localmente.
  const slot: MatrixSlot | null = useMemo(() => {
    const base = data?.slots.find(s => s.key === activeKey)
    if (!base) return null
    return { ...base, rows: orderedRows([...base.rows, ...(extraRows[base.key] ?? [])], rowOrder[base.key]) }
  }, [data, activeKey, extraRows, rowOrder])

  const draft = useMemo<Draft>(() => (slot && drafts[slot.key]) || {}, [slot, drafts])
  const slotSubs = (slot && subs[slot.key]) || {}

  const setSlotDraft = (fn: (d: Draft) => Draft) => {
    if (!slot) return
    setDrafts(prev => ({ ...prev, [slot.key]: fn(prev[slot.key] ?? {}) }))
  }

  // Cambios de todos los tipos de sesión (no solo el visible).
  const computed = useMemo(() => {
    if (!data) return null
    const changes: ApiChange[] = []
    const lines: { slot: string; text: string; kind: string }[] = []
    const unlink = new Set<number>()
    const perSlot: Record<string, number> = {}
    for (const base of data.slots) {
      const s: MatrixSlot = { ...base, rows: [...base.rows, ...(extraRows[base.key] ?? [])] }
      const r = computeChanges(s, drafts[base.key] ?? {}, subs[base.key] ?? {})
      changes.push(...r.changes)
      r.lines.forEach(l => lines.push({ slot: base.label, text: l.text, kind: l.kind }))
      r.unlinkAssignments.forEach(a => unlink.add(a))
      // Orden de ejercicios: una operación `reorder` por sesión; si la sesión comparte plantilla se desvincula.
      const ro = computeReorder(s, rowOrder[base.key])
      changes.push(...ro.changes)
      ro.lines.forEach(l => lines.push({ slot: base.label, text: l.text, kind: l.kind }))
      ro.changes.forEach(c => {
        const col = base.columns.find(x => x.assignment_id === c.assignment_id)
        if (col && (col.linked_weeks.length > 0 || col.linked_elsewhere > 0)) unlink.add(c.assignment_id)
      })
      perSlot[base.key] = r.changes.length + ro.changes.length
    }
    const deloadChanges: { week_number: number; is_deload: boolean }[] = []
    const seen = new Set<number>()
    for (const base of data.slots) {
      for (const c of base.columns) {
        if (seen.has(c.week_number)) continue
        seen.add(c.week_number)
        if (deload[c.week_number] !== undefined && deload[c.week_number] !== c.is_deload) {
          deloadChanges.push({ week_number: c.week_number, is_deload: deload[c.week_number] })
        }
      }
    }
    return { changes, lines, unlink, deloadChanges, perSlot }
  }, [data, drafts, subs, extraRows, deload, rowOrder])

  const dirtyCount = (computed?.changes.length ?? 0) + (computed?.deloadChanges.length ?? 0)
  const directClients = data?.program.direct_clients ?? []

  const handleOpenChange = (next: boolean) => {
    if (!next && dirtyCount > 0 && !window.confirm(`Tienes ${dirtyCount} cambios sin guardar. ¿Cerrar y perderlos?`)) return
    onOpenChange(next)
  }

  const save = async () => {
    if (!computed) return
    setSaving(true)
    try {
      await api.post('/admin/program-session-matrix-save', {
        training_program_id: programId,
        changes: computed.changes,
        deload: computed.deloadChanges,
      })
      toast.success('Cambios guardados')
      setSummaryOpen(false)
      onSaved?.()
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  // ---- selector de ejercicios (añadir fila / sustituir) -------------------
  const openPicker = (p: NonNullable<typeof picker>) => setPicker(p)

  const pickExercise = (ex: ExerciseOption) => {
    if (!slot || !picker) return
    if (picker.mode === 'substitute') {
      setSubs(prev => ({ ...prev, [slot.key]: { ...(prev[slot.key] ?? {}), [picker.rowKey]: { exerciseId: ex.id, title: ex.title } } }))
    } else {
      const rowKey = `new:${ex.id}#${(extraRows[slot.key]?.length ?? 0) + 1}`
      const row: MatrixRow = { row_key: rowKey, exercise_id: ex.id, exercise_title: ex.title, block_title: null, cells: {} }
      setExtraRows(prev => ({ ...prev, [slot.key]: [...(prev[slot.key] ?? []), row] }))
      // Nace en todas las semanas: el coach solo rellena los valores.
      setSlotDraft(d => slot.columns.reduce((acc, c) => addCell(acc, c.assignment_id, rowKey), d))
    }
    setPicker(null)
  }

  // ---- teclado y pegado ----------------------------------------------------
  const focusCell = (rowIndex: number, colIndex: number, fieldIndex: number) => {
    const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${rowIndex}:${colIndex}:${fieldIndex}"]`)
    el?.focus()
    el?.select()
  }

  const onCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number, f: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      focusCell(r + (e.shiftKey ? -1 : 1), c, f)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusCell(r + 1, c, f)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusCell(r - 1, c, f)
    }
  }

  const onCellPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number, f: number) => {
    const text = e.clipboardData.getData('text')
    if (!slot || !isGridPaste(text)) return
    e.preventDefault()
    const grid = parsePaste(text)
    setSlotDraft(d => applyPaste(d, slot, { rowIndex: r, colIndex: c, fieldIndex: f }, grid, fields))
    toast.success(`Pegadas ${grid.length} filas × ${Math.max(...grid.map(g => g.length))} columnas`)
  }

  // ---- orden de ejercicios, notas y edición en bloque ----------------------
  const currentOrder = () => (slot ? slot.rows.map(r => r.row_key) : [])
  const canMove = (rowKey: string, dir: -1 | 1) => {
    if (!slot) return false
    const order = currentOrder()
    return moveRow(order, slot.rows, rowKey, dir) !== order
  }
  const moveRowBy = (rowKey: string, dir: -1 | 1) => {
    if (!slot) return
    const order = currentOrder()
    const next = moveRow(order, slot.rows, rowKey, dir)
    if (next !== order) setRowOrder(prev => ({ ...prev, [slot.key]: next }))
  }

  const cascadeRowInfo = cascade && slot ? slot.rows.find(r => r.row_key === cascade.rowKey) ?? null : null
  const cascadeBaseCol = cascade && slot ? cascadeBase(draft, slot, cascade.rowKey) : null
  const cascadeWeeksAfter = slot && cascadeBaseCol ? slotWeeks(slot).filter(w => w > cascadeBaseCol.week_number) : []
  const cascadePreview = useMemo(
    () => (cascade && slot ? cascadeRow(draft, slot, cascade.rowKey, { steps: cascade.steps, carga: cascade.carga }) : null),
    [cascade, slot, draft],
  )

  const openCascade = (rowKey: string) => setCascade({ rowKey, steps: {}, carga: [] })

  const applyCascade = () => {
    if (!slot || !cascade) return
    setSlotDraft(d => cascadeRow(d, slot, cascade.rowKey, { steps: cascade.steps, carga: cascade.carga }))
    toast.success('Cascada aplicada al borrador (solo a este ejercicio)')
    setCascade(null)
  }

  // ---- render --------------------------------------------------------------
  const weekStarts = useMemo(() => {
    const seen = new Set<number>()
    const first = new Set<number>()
    slot?.columns.forEach(c => { if (!seen.has(c.week_number)) { seen.add(c.week_number); first.add(c.assignment_id) } })
    return first
  }, [slot])

  const header = (col: MatrixColumn) => {
    const variant = variantOf(col.template_title)
    return (
      <th key={col.assignment_id} colSpan={fields.length + 1} className='border-b border-l bg-muted px-2 py-1.5 text-left align-top'>
        <div className='flex items-center gap-1.5'>
          <span className='font-semibold'>{columnLabel(col)}</span>
          {variant && <span className='text-[10px] text-muted-foreground'>{variant}</span>}
          {col.scheduled_date && <span className='text-[10px] text-muted-foreground'>{col.scheduled_date}</span>}
          {(col.linked_weeks.length > 0 || col.linked_elsewhere > 0) && (
            <Badge
              variant='outline'
              className='h-5 gap-1 border-sky-500/50 px-1.5 text-[10px] text-sky-600'
              title={`Comparte plantilla con ${col.linked_weeks.length ? `la(s) semana(s) ${col.linked_weeks.join(', ')}` : 'otro programa'}. Si editas esta sesión se desvincula (se crea una copia solo para ella) y las demás no cambian.`}
            >
              <LinkIcon className='size-3' />
              {col.linked_weeks.length ? `= S${col.linked_weeks.join(',')}` : 'compartida'}
            </Badge>
          )}
        </div>
        {weekStarts.has(col.assignment_id) && (
          <label className='mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground' title='Semana de descarga (afecta a todas las sesiones de la semana)'>
            <MoonIcon className='size-3' />
            <Switch
              checked={!!deload[col.week_number]}
              onCheckedChange={v => setDeload(prev => ({ ...prev, [col.week_number]: !!v }))}
            />
            Descarga
          </label>
        )}
      </th>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {/* El tema (.cn-dialog-content, css/styles/style-lyra.css) va fuera de las capas de Tailwind y fija
              `display: grid` y `max-width: 24rem`: solo las utilidades `!` le ganan. */}
        <DialogContent className='flex! h-[92vh] w-[97vw]! max-w-[97vw]! flex-col gap-3 overflow-hidden p-4'>
          <DialogHeader className='shrink-0 pr-8'>
            <DialogTitle>Editor de sesiones del programa{data ? ` — ${data.program.title}` : ''}</DialogTitle>
            <DialogDescription>
              Cada tipo de sesión con todas sus semanas en columnas. Tab/Enter para moverte, pega desde Excel en cualquier celda.
              Notas, tempo, duración, orden de ejercicios y edición en bloque en las barras de abajo y en el menú "⋯" de cada fila y celda.
              Solo se modifica lo que estés editando: las copias de otros clientes no cambian.
            </DialogDescription>
          </DialogHeader>

          {directClients.length > 0 && (
            <div className='shrink-0 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300' role='alert'>
              <AlertTriangleIcon className='mr-1 inline size-3.5' />
              Este programa de la biblioteca está asignado <strong>directamente</strong> a {directClients.map(c => c.name).join(', ')} (sin copia propia):
              los cambios se verán en su calendario en vivo. Los programas asignados con "Asignar cliente" crean una copia independiente y no tienen este aviso.
            </div>
          )}

          {loading && !data ? (
            <div className='flex flex-1 items-center justify-center'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : !data || data.slots.length === 0 ? (
            <p className='py-16 text-center text-sm text-muted-foreground'>Este programa aún no tiene sesiones asignadas.</p>
          ) : (
            <>
              <div className='flex shrink-0 flex-wrap items-center gap-1.5'>
                {data.slots.map(s => {
                  const n = computed?.perSlot[s.key] ?? 0
                  return (
                    <button
                      key={s.key}
                      type='button'
                      onClick={() => setActiveKey(s.key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                        activeKey === s.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                      )}
                    >
                      {s.label}
                      <span className={activeKey === s.key ? 'opacity-80' : 'text-muted-foreground'}>{s.columns.length}</span>
                      {n > 0 && <span className='rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white'>{n}</span>}
                    </button>
                  )
                })}
                {initialAssignmentIds?.length ? (
                  <Button variant='ghost' size='sm' className='ml-1 h-7 text-xs' onClick={() => setShowAll(v => !v)} disabled={dirtyCount > 0}
                    title={dirtyCount > 0 ? 'Guarda o descarta los cambios antes de cambiar la vista' : undefined}>
                    {showAll ? 'Solo las seleccionadas' : 'Mostrar todos los tipos de sesión'}
                  </Button>
                ) : null}
                <div className='ml-auto flex items-center gap-1.5'>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <span className='inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted' title='Mostrar u ocultar columnas'>
                        <Columns3Icon className='size-3.5' /> Columnas
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end' className='text-xs'>
                      {OPTIONAL_FIELD_KEYS.map(f => (
                        <DropdownMenuItem
                          key={f}
                          onClick={() => setOptionalFields(prev => (prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]))}
                        >
                          <span className='mr-2 inline-block w-3'>{optionalFields.includes(f) ? '✓' : ''}</span>
                          {f === 'tempo' ? 'Tempo' : 'Duración'}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {slot && (
                <div ref={tableRef} className='min-h-0 flex-1 overflow-auto rounded-lg border'>
                  <table className='border-separate border-spacing-0 text-xs'>
                    <thead className='sticky top-0 z-20'>
                      <tr>
                        <th rowSpan={2} className='sticky left-0 z-30 min-w-[210px] border-b bg-muted px-3 py-2 text-left align-bottom'>
                          Ejercicio
                        </th>
                        {slot.columns.map(header)}
                      </tr>
                      <tr>
                        {slot.columns.map(col => (
                          <FieldHeaders key={col.assignment_id} draft={draft} col={col} slot={slot} fields={fields} />
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slot.rows.map((row, r) => {
                        const sub = slotSubs[row.row_key]
                        const present = slot.columns.some(c => draft[c.assignment_id]?.[row.row_key])
                        if (!present && !row.row_key.startsWith('new:') && Object.keys(row.cells).length > 0) {
                          // Fila quitada en todas las semanas: se muestra tachada hasta guardar.
                          return (
                            <tr key={row.row_key} className='opacity-50'>
                              <td className='sticky left-0 z-10 border-b bg-background px-3 py-2 line-through'>{row.exercise_title}</td>
                              <td colSpan={slot.columns.length * (fields.length + 1)} className='border-b border-l px-3 text-muted-foreground'>
                                Se quitará de todas las semanas al guardar.{' '}
                                <button
                                  type='button'
                                  className='underline'
                                  onClick={() => setSlotDraft(d => slot.columns.reduce((acc, c) => {
                                    const orig = row.cells[String(c.assignment_id)]
                                    return orig ? addCell(acc, c.assignment_id, row.row_key, cellFromApi(orig)) : acc
                                  }, d))}
                                >
                                  Restaurar
                                </button>
                              </td>
                            </tr>
                          )
                        }
                        return (
                          <tr key={row.row_key} className='group/row'>
                            <td className='sticky left-0 z-10 border-b bg-background px-3 py-1.5 align-middle'>
                              <div className='flex items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                  <p className={cn('truncate font-medium', sub && 'text-primary')} title={sub ? `${row.exercise_title} → ${sub.title}` : row.exercise_title}>
                                    {sub ? sub.title : row.exercise_title}
                                  </p>
                                  {sub && <p className='truncate text-[10px] text-muted-foreground line-through'>{row.exercise_title}</p>}
                                  {row.block_title && !sub && <p className='truncate text-[10px] text-muted-foreground'>{row.block_title}</p>}
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger>
                                    <span className='inline-flex size-6 items-center justify-center rounded-md hover:bg-muted'>
                                      <MoreVerticalIcon className='size-3.5' />
                                    </span>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align='start' className='text-xs'>
                                    <DropdownMenuItem disabled={!canMove(row.row_key, -1)} onClick={() => moveRowBy(row.row_key, -1)}>
                                      <ArrowUpIcon className='mr-2 size-3.5' /> Subir (en todas las semanas)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled={!canMove(row.row_key, 1)} onClick={() => moveRowBy(row.row_key, 1)}>
                                      <ArrowDownIcon className='mr-2 size-3.5' /> Bajar (en todas las semanas)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openCascade(row.row_key)}>
                                      <SlidersHorizontalIcon className='mr-2 size-3.5' /> Cascada por semanas…
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openPicker({ mode: 'substitute', rowKey: row.row_key })}>
                                      <RepeatIcon className='mr-2 size-3.5' /> Sustituir en todas las semanas
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setSlotDraft(d => slot.columns.reduce((acc, c) => (acc[c.assignment_id]?.[row.row_key] ? acc : addCell(acc, c.assignment_id, row.row_key)), d))}>
                                      <PlusIcon className='mr-2 size-3.5' /> Añadir en las semanas donde falta
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className='text-destructive focus:text-destructive' onClick={() => setSlotDraft(d => removeRow(d, row.row_key))}>
                                      <TrashIcon className='mr-2 size-3.5' /> Quitar de todas las semanas
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>

                            {slot.columns.map((col, c) => {
                              const cur = draft[col.assignment_id]?.[row.row_key]
                              const orig = row.cells[String(col.assignment_id)]
                              if (!cur) {
                                return (
                                  <td key={col.assignment_id} colSpan={fields.length + 1} className='border-b border-l px-2 py-1.5'>
                                    <button
                                      type='button'
                                      className='flex h-8 w-full items-center justify-center gap-1 rounded-md border border-dashed text-[11px] text-muted-foreground hover:border-primary/50 hover:text-primary'
                                      onClick={() => setSlotDraft(d => addCell(d, col.assignment_id, row.row_key, orig ? cellFromApi(orig) : undefined))}
                                    >
                                      <PlusIcon className='size-3' /> {orig ? 'Se quitará — deshacer' : 'Añadir'}
                                    </button>
                                  </td>
                                )
                              }
                              const dirty = cellIsDirty(orig, cur)
                              return (
                                <CellGroup
                                  key={col.assignment_id}
                                  cur={cur}
                                  fields={fields}
                                  dirty={dirty}
                                  isLast={c === slot.columns.length - 1}
                                  onNotes={() => setNotesEdit({ assignmentId: col.assignment_id, rowKey: row.row_key, value: cur.notes })}
                                  techniqueText={techniqueLabel(cur.technique.key, cur.technique.otra, techniques)}
                                  onTechnique={() => setTechEdit({ assignmentId: col.assignment_id, rowKey: row.row_key, exercise: row.exercise_title, week: col.week_number, value: { ...cur.technique }, following: false })}
                                  onChange={(field, value) => setSlotDraft(d => setValue(d, col.assignment_id, row.row_key, field, value))}
                                  onKeyDown={(e, f) => onCellKeyDown(e, r, c, f)}
                                  onPaste={(e, f) => onCellPaste(e, r, c, f)}
                                  coords={{ r, c }}
                                  onFillRight={() => setSlotDraft(d => fillRight(d, slot, row.row_key, c))}
                                  onToggleIntensity={() => setSlotDraft(d => setIntensityKey(d, col.assignment_id, row.row_key, cur.intensityKey === 'rir' ? 'rpe' : 'rir'))}
                                  onRemove={() => setSlotDraft(d => removeCell(d, col.assignment_id, row.row_key))}
                                />
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <DialogFooter className='shrink-0 items-center gap-2 sm:justify-between'>
            <Button variant='outline' onClick={() => slot && openPicker({ mode: 'add' })} disabled={!slot}>
              <PlusIcon className='mr-1 size-4' /> Añadir ejercicio a este tipo de sesión
            </Button>
            <div className='flex items-center gap-2'>
              <span className='text-xs text-muted-foreground'>
                {dirtyCount > 0 ? `${dirtyCount} cambios sin guardar` : 'Sin cambios'}
              </span>
              <Button variant='outline' onClick={() => handleOpenChange(false)}>Cerrar</Button>
              <Button onClick={() => setSummaryOpen(true)} disabled={dirtyCount === 0}>Revisar y guardar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notas del ejercicio en una sesión */}
      <Dialog open={!!notesEdit} onOpenChange={o => { if (!o) setNotesEdit(null) }}>
        <DialogContent className='max-w-md!'>
          <DialogHeader>
            <DialogTitle>Notas del ejercicio</DialogTitle>
            <DialogDescription>Las ve el cliente en esa sesión. Déjalo vacío para quitar la nota.</DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            className='min-h-[120px] text-sm'
            value={notesEdit?.value ?? ''}
            onChange={e => setNotesEdit(prev => (prev ? { ...prev, value: e.target.value } : prev))}
            placeholder='Indicaciones del entrenador para este ejercicio...'
          />
          <DialogFooter>
            <Button variant='outline' onClick={() => setNotesEdit(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (notesEdit) setSlotDraft(d => setNotes(d, notesEdit.assignmentId, notesEdit.rowKey, notesEdit.value))
                setNotesEdit(null)
              }}
            >
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Técnica especial del ejercicio */}
      <TechniqueDialog
        edit={techEdit}
        techniques={techniques}
        onChange={setTechEdit}
        onApply={() => {
          if (techEdit && slot) {
            // Sin técnica se conserva igualmente la petición de grabación
            const t = techEdit.value.key ? techEdit.value : { ...NO_TECHNIQUE, recording: techEdit.value.recording }
            setSlotDraft(d => setTechnique(d, slot, techEdit.assignmentId, techEdit.rowKey, t, techEdit.following))
          }
          setTechEdit(null)
        }}
      />

      {/* Cascada por ejercicio */}
      <Dialog open={!!cascade} onOpenChange={o => { if (!o) setCascade(null) }}>
        <DialogContent className='max-w-2xl!'>
          <DialogHeader>
            <DialogTitle>Cascada: {cascadeRowInfo?.exercise_title}</DialogTitle>
            <DialogDescription>
              Parte de la semana {cascadeBaseCol?.week_number ?? '—'} (lo que ya rellenaste) y sube o baja cada campo semana a semana, solo para este
              ejercicio. Deja «Sin cambio» lo que no quieras tocar.
            </DialogDescription>
          </DialogHeader>
          {cascade && cascadeBaseCol && cascadePreview && slot && (
            <div className='space-y-3 text-sm'>
              <div className='grid gap-2 sm:grid-cols-2'>
                {CASCADE_FIELDS.filter(f => f !== 'duracion').map(f => {
                  const label = f === 'intensity' ? (draft[cascadeBaseCol.assignment_id]?.[cascade.rowKey]?.intensityKey ?? 'rir').toUpperCase() : FIELD_LABELS[f]
                  return (
                    <label key={f} className='flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5'>
                      <span className='text-xs font-medium'>{label} por semana</span>
                      <select
                        aria-label={`${label} por semana`}
                        value={cascade.steps[f] ?? 0}
                        onChange={e => setCascade(prev => (prev ? { ...prev, steps: { ...prev.steps, [f]: Number(e.target.value) } } : prev))}
                        className='h-8 rounded-md border border-input bg-background px-2 text-xs'
                      >
                        {[-2, -1, 0, 1, 2].map(n => (
                          <option key={n} value={n}>{n === 0 ? 'Sin cambio' : n > 0 ? `+${n}` : String(n)}</option>
                        ))}
                      </select>
                    </label>
                  )
                })}
              </div>

              <div className='space-y-1.5 rounded-md border p-2.5'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <p className='text-xs font-medium'>Carga (indicación en texto)</p>
                  <div className='flex items-center gap-1'>
                    <span className='text-[11px] text-muted-foreground'>Todas las semanas:</span>
                    {CARGA_HINTS.map(h => (
                      <button
                        key={h}
                        type='button'
                        onClick={() => setCascade(prev => (prev ? { ...prev, carga: cascadeWeeksAfter.map(() => h) } : prev))}
                        className='rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted'
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                <div className='flex flex-wrap gap-2'>
                  {cascadeWeeksAfter.map((w, i) => (
                    <label key={w} className='flex items-center gap-1 text-[11px]'>
                      S{w}
                      <select
                        aria-label={`Carga semana ${w}`}
                        value={cascade.carga[i] ?? ''}
                        onChange={e => setCascade(prev => {
                          if (!prev) return prev
                          const carga = cascadeWeeksAfter.map((_, k) => prev.carga[k] ?? '') as CargaHint[]
                          carga[i] = e.target.value as CargaHint
                          return { ...prev, carga }
                        })}
                        className='h-7 rounded-md border border-input bg-background px-1 text-[11px]'
                      >
                        <option value=''>Sin cambio</option>
                        {CARGA_HINTS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className='max-h-56 overflow-auto rounded-md border'>
                <table className='w-full text-xs'>
                  <thead className='bg-muted'>
                    <tr>
                      <th className='px-2 py-1 text-left'>Semana</th>
                      {(['series', 'reps', 'carga', 'intensity', 'descanso'] as FieldKey[]).map(f => <th key={f} className='px-2 py-1 text-center'>{FIELD_LABELS[f]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {slot.columns.map(col => {
                      const cell = cascadePreview[col.assignment_id]?.[cascade.rowKey]
                      if (!cell) return null
                      const before = draft[col.assignment_id]?.[cascade.rowKey]
                      return (
                        <tr key={col.assignment_id} className='border-t'>
                          <td className='px-2 py-1'>{columnLabel(col)}</td>
                          {(['series', 'reps', 'carga', 'intensity', 'descanso'] as FieldKey[]).map(f => (
                            <td key={f} className={cn('px-2 py-1 text-center', before && before.values[f] !== cell.values[f] && 'bg-amber-100/70 font-medium dark:bg-amber-900/25')}>
                              {cell.values[f] || '—'}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {cascade && !cascadeBaseCol && <p className='text-sm text-muted-foreground'>Este ejercicio no tiene ninguna semana rellenada de la que partir.</p>}
          <DialogFooter>
            <Button variant='outline' onClick={() => setCascade(null)}>Cancelar</Button>
            <Button onClick={applyCascade} disabled={!cascadeBaseCol}>Aplicar al borrador</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Selector de ejercicio (con fotos y filtros) */}
      <Dialog open={!!picker} onOpenChange={o => { if (!o) setPicker(null) }}>
        <DialogContent className='flex! h-[90vh] w-[97vw]! max-w-5xl! flex-col gap-3'>
          <DialogHeader className='shrink-0'>
            <DialogTitle>{picker?.mode === 'substitute' ? 'Sustituir ejercicio en todas las semanas' : 'Añadir ejercicio'}</DialogTitle>
            <DialogDescription>
              {picker?.mode === 'substitute'
                ? 'Se cambia el ejercicio y se conservan series, reps, carga y demás datos de cada semana.'
                : 'El ejercicio aparece en todas las semanas de este tipo de sesión, listo para rellenar.'}
            </DialogDescription>
          </DialogHeader>
          {picker && <ExercisePickerPanel onPick={pickExercise} />}
        </DialogContent>
      </Dialog>

      {/* Resumen antes de guardar */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className='max-w-2xl!'>
          <DialogHeader>
            <DialogTitle>Revisar cambios</DialogTitle>
            <DialogDescription>
              {computed ? `${computed.changes.length} cambios en sesiones` : ''}
              {computed && computed.deloadChanges.length > 0 ? ` y ${computed.deloadChanges.length} semanas de descarga` : ''}.
            </DialogDescription>
          </DialogHeader>
          {directClients.length > 0 && (
            <div className='rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300'>
              <AlertTriangleIcon className='mr-1 inline size-3' />
              Al guardar cambiarás el calendario en vivo de {directClients.map(c => c.name).join(', ')}.
            </div>
          )}
          {computed && computed.unlink.size > 0 && (
            <div className='rounded-md border border-sky-500/40 bg-sky-500/5 px-3 py-2 text-xs text-sky-700 dark:text-sky-300'>
              <LinkIcon className='mr-1 inline size-3' />
              {computed.unlink.size} {computed.unlink.size === 1 ? 'sesión comparte' : 'sesiones comparten'} plantilla con otras semanas: se desvincularán
              (copia propia) para que las demás semanas no cambien.
            </div>
          )}
          <div className='max-h-72 space-y-1 overflow-y-auto rounded-md border p-2 text-xs'>
            {computed?.lines.map((l, i) => (
              <p key={i} className='flex gap-2'>
                <Badge variant='outline' className={cn('h-5 shrink-0 px-1.5 text-[10px]', l.kind === 'remove' && 'border-destructive/50 text-destructive', l.kind === 'add' && 'border-emerald-500/50 text-emerald-600')}>
                  {l.slot}
                </Badge>
                <span>{l.text}</span>
              </p>
            ))}
            {computed?.deloadChanges.map(d => (
              <p key={d.week_number} className='flex gap-2'>
                <Badge variant='outline' className='h-5 shrink-0 px-1.5 text-[10px]'>Programa</Badge>
                <span>Semana {d.week_number}: {d.is_deload ? 'marcar como descarga' : 'quitar marca de descarga'}</span>
              </p>
            ))}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setSummaryOpen(false)} disabled={saving}>Seguir editando</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function FieldHeaders({ col, draft, slot, fields }: { col: MatrixColumn; draft: Draft; slot: MatrixSlot; fields: FieldKey[] }) {
  // La etiqueta de intensidad refleja RIR/RPE si todas las celdas de la columna coinciden.
  const keys = new Set(slot.rows.map(r => draft[col.assignment_id]?.[r.row_key]?.intensityKey).filter(Boolean))
  const intensityLabel = keys.size === 1 ? [...keys][0]!.toUpperCase() : FIELD_LABELS.intensity
  return (
    <>
      {fields.map(f => (
        <th key={f} className='border-b border-l bg-muted px-1 py-1 text-center text-[10px] font-medium text-muted-foreground'>
          {f === 'intensity' ? intensityLabel : FIELD_LABELS[f]}
        </th>
      ))}
      <th className='border-b bg-muted px-0 py-1' />
    </>
  )
}

function CellGroup({
  cur, fields, dirty, isLast, coords, onChange, onKeyDown, onPaste, onFillRight, onToggleIntensity, onRemove, onNotes, onTechnique, techniqueText,
}: {
  cur: NonNullable<Draft[number][string]>
  fields: FieldKey[]
  onNotes: () => void
  onTechnique: () => void
  /** Técnica de esta semana ya en texto ('' = ninguna). */
  techniqueText: string
  dirty: boolean
  isLast: boolean
  coords: { r: number; c: number }
  onChange: (field: FieldKey, value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, fieldIndex: number) => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>, fieldIndex: number) => void
  onFillRight: () => void
  onToggleIntensity: () => void
  onRemove: () => void
}) {
  const recordingText = recordingSummary(cur.technique.recording)
  return (
    <>
      {fields.map((f, fi) => (
        <td key={f} className={cn('border-b px-0.5 py-1', fi === 0 && 'border-l pl-1.5', dirty && 'bg-amber-100/70 dark:bg-amber-900/25')}>
          <input
            data-cell={`${coords.r}:${coords.c}:${fi}`}
            value={cur.values[f]}
            onChange={e => onChange(f, e.target.value)}
            onKeyDown={e => onKeyDown(e, fi)}
            onPaste={e => onPaste(e, fi)}
            onFocus={e => e.currentTarget.select()}
            aria-label={`${FIELD_LABELS[f]} (fila ${coords.r + 1}, semana ${coords.c + 1})`}
            className={cn(
              'h-7 rounded-md border border-input bg-background px-1.5 text-center text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              FIELD_WIDTH[f],
            )}
          />
        </td>
      ))}
      <td className={cn('border-b px-0.5', dirty && 'bg-amber-100/70 dark:bg-amber-900/25', isLast && 'pr-1')}>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <span
              className='relative inline-flex size-6 items-center justify-center rounded-md hover:bg-muted'
              title={['Acciones de esta semana', cur.notes.trim() && 'tiene notas', techniqueText && `técnica: ${techniqueText}${cur.technique.series === 'ultima' ? ' (última serie)' : ''}`, recordingText && `grabar: ${recordingText}`].filter(Boolean).join(' · ')}
            >
              <MoreVerticalIcon className='size-3' />
              {cur.notes.trim() && <span className='absolute right-0.5 top-0.5 size-1.5 rounded-full bg-sky-500' aria-label='Tiene notas' />}
              {techniqueText && <ZapIcon className='absolute -bottom-0.5 -left-0.5 size-3 fill-violet-500 text-violet-500' aria-label={`Técnica: ${techniqueText}`} />}
              {recordingText && <VideoIcon className='absolute -bottom-0.5 -right-0.5 size-3 text-rose-500' aria-label={`Grabar: ${recordingText}`} />}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='text-xs'>
            <DropdownMenuItem onClick={onNotes}>
              <StickyNoteIcon className='mr-2 size-3.5' /> {cur.notes.trim() ? 'Editar notas…' : 'Añadir notas…'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTechnique}>
              <ZapIcon className='mr-2 size-3.5' /> {techniqueText ? `Técnica: ${techniqueText}…` : 'Técnica especial…'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTechnique}>
              <VideoIcon className='mr-2 size-3.5' /> {recordingText ? `Grabar: ${recordingText}…` : 'Pedir grabación…'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onFillRight}>
              <ChevronsRightIcon className='mr-2 size-3.5' /> Copiar a las semanas siguientes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleIntensity}>
              Usar {cur.intensityKey === 'rir' ? 'RPE' : 'RIR'} en esta sesión
            </DropdownMenuItem>
            <DropdownMenuItem className='text-destructive focus:text-destructive' onClick={onRemove}>
              <TrashIcon className='mr-2 size-3.5' /> Quitar de esta sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </>
  )
}

type TechEdit = { assignmentId: number; rowKey: string; exercise: string; week: number; value: TechniqueDraft; following: boolean }

/** Elegir la técnica especial de un ejercicio en una semana (catálogo de Bckbs TrainingTechniques). */
function TechniqueDialog({
  edit, techniques, onChange, onApply,
}: {
  edit: TechEdit | null
  techniques: TrainingTechnique[]
  onChange: (e: TechEdit | null) => void
  onApply: () => void
}) {
  const v = edit?.value ?? NO_TECHNIQUE
  const set = (patch: Partial<TechniqueDraft>) => edit && onChange({ ...edit, value: { ...edit.value, ...patch } })
  const invalid = v.key === OTHER_TECHNIQUE && !v.otra.trim()
  return (
    <Dialog open={!!edit} onOpenChange={o => { if (!o) onChange(null) }}>
      <DialogContent className='max-w-md!'>
        <DialogHeader>
          <DialogTitle>Técnica especial y grabación</DialogTitle>
          <DialogDescription>
            {edit ? `${edit.exercise} · semana ${edit.week}. ` : ''}El cliente la verá en la app con su explicación.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-3 text-sm'>
          <TechniqueFields value={v} techniques={techniques} onChange={set} />
          <label className='flex items-center gap-2'>
            <Switch checked={edit?.following ?? false} onCheckedChange={c => edit && onChange({ ...edit, following: !!c })} />
            <span>Aplicar también a las semanas siguientes</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onChange(null)}>Cancelar</Button>
          <Button onClick={onApply} disabled={invalid}>Aceptar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
