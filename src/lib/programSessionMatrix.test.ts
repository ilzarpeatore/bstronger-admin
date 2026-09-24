import { describe, expect, it } from 'vitest'
import {
  addCell,
  applyPaste,
  buildDraft,
  cascadeBase,
  cascadeRow,
  cellIsDirty,
  computeChanges,
  computeReorder,
  fillRight,
  initialOrder,
  isGridPaste,
  moveRow,
  orderChanged,
  orderedRows,
  parsePaste,
  removeCell,
  removeRow,
  setIntensityKey,
  setNotes,
  setValue,
  shiftNumeric,
  visibleFields,
  type MatrixSlot,
} from './programSessionMatrix'

const slot: MatrixSlot = {
  key: 'empuje',
  label: 'Empuje',
  columns: [
    { assignment_id: 10, week_number: 1, day_of_week: 3, is_deload: false, scheduled_date: null, workout_template_id: 100, template_title: 'P · Empuje (S1)', linked_weeks: [], linked_elsewhere: 0 },
    { assignment_id: 11, week_number: 2, day_of_week: 3, is_deload: false, scheduled_date: null, workout_template_id: 101, template_title: 'P · Empuje (S2)', linked_weeks: [3], linked_elsewhere: 0 },
    { assignment_id: 12, week_number: 3, day_of_week: 3, is_deload: false, scheduled_date: null, workout_template_id: 101, template_title: 'P · Empuje (S2)', linked_weeks: [2], linked_elsewhere: 0 },
  ],
  rows: [
    {
      row_key: '5#1', exercise_id: 5, exercise_title: 'Press banca', block_title: 'Principal',
      cells: {
        '10': { id: 1, block_id: 1, sequence: 1, prescribed: { series: '4', reps: '6-8', carga: '45', rir: '2', descanso: '120' }, enabled_metrics: ['reps', 'carga', 'descanso', 'rir'], notes: null },
        '11': { id: 2, block_id: 2, sequence: 1, prescribed: { series: '4', reps: '8-10', rpe: '8' }, enabled_metrics: ['reps', 'carga', 'rpe'], notes: null },
        '12': { id: 2, block_id: 2, sequence: 1, prescribed: { series: '4', reps: '8-10', rpe: '8' }, enabled_metrics: ['reps', 'carga', 'rpe'], notes: null },
      },
    },
    {
      row_key: '9#1', exercise_id: 9, exercise_title: 'Fondos', block_title: 'Principal',
      cells: {
        '10': { id: 3, block_id: 1, sequence: 2, prescribed: { series: '3' }, enabled_metrics: ['reps', 'rir'], notes: null },
      },
    },
  ],
}

describe('buildDraft', () => {
  it('lee series/reps/carga/descanso y la intensidad según enabled_metrics (RIR o RPE)', () => {
    const d = buildDraft(slot)
    expect(d[10]['5#1']!.values).toEqual({ series: '4', reps: '6-8', carga: '45', intensity: '2', descanso: '120', tempo: '', duracion: '' })
    expect(d[11]['5#1']!.intensityKey).toBe('rpe')
    expect(d[11]['5#1']!.values.intensity).toBe('8')
  })
  it('un ejercicio ausente en una sesión no tiene celda', () => {
    const d = buildDraft(slot)
    expect(d[11]['9#1']).toBeUndefined()
  })
})

describe('sin cambios', () => {
  it('el borrador sin tocar no genera cambios', () => {
    const r = computeChanges(slot, buildDraft(slot))
    expect(r.changes).toEqual([])
    expect(r.lines).toEqual([])
    expect(r.unlinkAssignments).toEqual([])
  })
})

describe('editar valores', () => {
  it('solo manda las claves que cambian', () => {
    const d = setValue(buildDraft(slot), 10, '5#1', 'reps', '8-10')
    const r = computeChanges(slot, d)
    expect(r.changes).toEqual([{ type: 'update', assignment_id: 10, row_id: 1, prescribed: { reps: '8-10' } }])
    expect(r.unlinkAssignments).toEqual([])
    expect(r.lines[0].text).toContain('Reps "6-8" → "8-10"')
  })
  it('vaciar un valor lo manda como cadena vacía (el backend borra la clave)', () => {
    const d = setValue(buildDraft(slot), 10, '5#1', 'descanso', '')
    expect(computeChanges(slot, d).changes[0]).toMatchObject({ prescribed: { descanso: '' } })
  })
  it('editar una columna con plantilla compartida avisa de que se desvinculará', () => {
    const d = setValue(buildDraft(slot), 11, '5#1', 'series', '5')
    expect(computeChanges(slot, d).unlinkAssignments).toEqual([11])
  })
  it('cambiar RIR por RPE mueve el valor y actualiza enabled_metrics', () => {
    let d = setIntensityKey(buildDraft(slot), 10, '5#1', 'rpe')
    d = setValue(d, 10, '5#1', 'intensity', '8')
    const c = computeChanges(slot, d).changes[0]
    expect(c).toMatchObject({ type: 'update', prescribed: { rir: '', rpe: '8' } })
    expect((c as any).enabled_metrics).toContain('rpe')
    expect((c as any).enabled_metrics).not.toContain('rir')
  })
})

describe('añadir / quitar', () => {
  it('rellenar una celda vacía crea el ejercicio en esa sesión', () => {
    const d = setValue(buildDraft(slot), 11, '9#1', 'series', '3')
    const r = computeChanges(slot, d)
    expect(r.changes).toEqual([
      { type: 'add', assignment_id: 11, exercise_id: 9, prescribed: { series: '3' }, enabled_metrics: ['reps', 'carga', 'descanso', 'rir'] },
    ])
  })
  it('quitar una celda existente la elimina; quitar la fila las elimina en todas', () => {
    expect(computeChanges(slot, removeCell(buildDraft(slot), 10, '9#1')).changes).toEqual([{ type: 'remove', assignment_id: 10, row_id: 3 }])
    const r = computeChanges(slot, removeRow(buildDraft(slot), '5#1'))
    expect(r.changes.filter(c => c.type === 'remove')).toHaveLength(3)
  })
  it('añadir y quitar sin guardar en medio no deja cambios', () => {
    const d = removeCell(addCell(buildDraft(slot), 11, '9#1'), 11, '9#1')
    expect(computeChanges(slot, d).changes).toEqual([])
  })
})

describe('sustituir ejercicio', () => {
  it('genera un substitute por cada sesión que lo tiene', () => {
    const r = computeChanges(slot, buildDraft(slot), { '5#1': { exerciseId: 77, title: 'Press inclinado' } })
    expect(r.changes.filter(c => c.type === 'substitute')).toHaveLength(3)
  })
})

describe('rellenar a la derecha', () => {
  it('copia la celda a las semanas siguientes, creándola si no existe', () => {
    const d = fillRight(buildDraft(slot), slot, '9#1', 0)
    expect(d[11]['9#1']!.values.series).toBe('3')
    expect(d[12]['9#1']!.values.series).toBe('3')
    const adds = computeChanges(slot, d).changes.filter(c => c.type === 'add')
    expect(adds).toHaveLength(2)
  })
  it('no toca nada si la celda origen no existe', () => {
    const d = buildDraft(slot)
    expect(fillRight(d, slot, '9#1', 1)).toBe(d)
  })
})

describe('pegar desde Excel', () => {
  it('detecta rejillas', () => {
    expect(isGridPaste('8-10')).toBe(false)
    expect(isGridPaste('4\t8-10')).toBe(true)
    expect(isGridPaste('4\n5')).toBe(true)
    expect(parsePaste('4\t8-10\r\n5\t6\r\n')).toEqual([['4', '8-10'], ['5', '6']])
  })
  it('recorre los campos de la semana y salta a la siguiente; cada línea baja una fila', () => {
    // Empieza en fila 0, semana 1, campo "series": 5 campos (semana 1) + 2 de la semana 2.
    const grid = [['4', '6-8', '50', '2', '90', '5', '10-12'], ['3', '12']]
    const d = applyPaste(buildDraft(slot), slot, { rowIndex: 0, colIndex: 0, fieldIndex: 0 }, grid)
    expect(d[10]['5#1']!.values).toEqual({ series: '4', reps: '6-8', carga: '50', intensity: '2', descanso: '90', tempo: '', duracion: '' })
    expect(d[11]['5#1']!.values.series).toBe('5')
    expect(d[11]['5#1']!.values.reps).toBe('10-12')
    expect(d[10]['9#1']!.values.series).toBe('3')
    expect(d[10]['9#1']!.values.reps).toBe('12')
  })
  it('lo que no cabe en la matriz se ignora', () => {
    const d = applyPaste(buildDraft(slot), slot, { rowIndex: 1, colIndex: 2, fieldIndex: 4 }, [['1', '2', '3'], ['x']])
    expect(d[12]['9#1']!.values.descanso).toBe('1')
  })
})

describe('deload y estado sucio', () => {
  it('solo manda las semanas cuyo estado de descarga cambió', () => {
    const r = computeChanges(slot, buildDraft(slot), {}, { 1: false, 2: true })
    expect(r.deload).toEqual([{ week_number: 2, is_deload: true }])
  })
  it('cellIsDirty compara con el original', () => {
    const d = setValue(buildDraft(slot), 10, '5#1', 'carga', '47')
    expect(cellIsDirty(slot.rows[0].cells['10'], d[10]['5#1'])).toBe(true)
    expect(cellIsDirty(slot.rows[0].cells['11'], d[11]['5#1'])).toBe(false)
    expect(cellIsDirty(undefined, undefined)).toBe(false)
  })
})

describe('tempo, duración y notas', () => {
  it('los lee de la API y los manda solo si cambian', () => {
    const withTempo: MatrixSlot = {
      ...slot,
      rows: [{ ...slot.rows[0], cells: { '10': { ...slot.rows[0].cells['10'], prescribed: { series: '4', reps: '6-8', tempo: '3-1-1-0' }, notes: 'Pausa abajo' } } }],
      columns: [slot.columns[0]],
    }
    const d = buildDraft(withTempo)
    expect(d[10]['5#1']!.values.tempo).toBe('3-1-1-0')
    expect(d[10]['5#1']!.notes).toBe('Pausa abajo')
    expect(computeChanges(withTempo, d).changes).toEqual([])
    const r = computeChanges(withTempo, setValue(d, 10, '5#1', 'tempo', '2-0-2-0'))
    expect(r.changes).toEqual([{ type: 'update', assignment_id: 10, row_id: 1, prescribed: { tempo: '2-0-2-0' } }])
  })
  it('editar solo la nota manda notes y no prescribed; vaciarla manda null', () => {
    const d = setNotes(buildDraft(slot), 10, '5#1', '  Ojo con la espalda ')
    expect(computeChanges(slot, d).changes).toEqual([{ type: 'update', assignment_id: 10, row_id: 1, notes: 'Ojo con la espalda' }])
    const d2 = setNotes(setNotes(buildDraft(slot), 10, '5#1', 'x'), 10, '5#1', '')
    expect(computeChanges(slot, d2).changes).toEqual([])
    const withNote: MatrixSlot = { ...slot, rows: [{ ...slot.rows[0], cells: { '10': { ...slot.rows[0].cells['10'], notes: 'vieja' } } }], columns: [slot.columns[0]] }
    expect(computeChanges(withNote, setNotes(buildDraft(withNote), 10, '5#1', '')).changes).toEqual([{ type: 'update', assignment_id: 10, row_id: 1, notes: null }])
  })
  it('una celda nueva con nota y tempo la manda en el add', () => {
    let d = addCell(buildDraft(slot), 11, '9#1')
    d = setValue(d, 11, '9#1', 'tempo', '3-0-1-0')
    d = setNotes(d, 11, '9#1', 'Controlado')
    expect(computeChanges(slot, d).changes).toEqual([
      { type: 'add', assignment_id: 11, exercise_id: 9, prescribed: { tempo: '3-0-1-0' }, enabled_metrics: ['reps', 'carga', 'descanso', 'rir'], notes: 'Controlado' },
    ])
  })
  it('cellIsDirty detecta cambios de nota y de tempo', () => {
    const d = setNotes(buildDraft(slot), 10, '5#1', 'nueva')
    expect(cellIsDirty(slot.rows[0].cells['10'], d[10]['5#1'])).toBe(true)
    expect(cellIsDirty(slot.rows[0].cells['10'], setValue(buildDraft(slot), 10, '5#1', 'duracion', '30')[10]['5#1'])).toBe(true)
  })
  it('pegar usa los campos visibles (con tempo) para saltar de semana', () => {
    const fields = visibleFields(['tempo'])
    expect(fields).toEqual(['series', 'reps', 'carga', 'intensity', 'descanso', 'tempo'])
    const grid = [['5', '8', '50', '2', '60', '3-1-1-0', '6']]
    const d = applyPaste(buildDraft(slot), slot, { rowIndex: 0, colIndex: 0, fieldIndex: 0 }, grid, fields)
    expect(d[10]['5#1']!.values.tempo).toBe('3-1-1-0')
    expect(d[11]['5#1']!.values.series).toBe('6') // 7º valor = primera columna de la semana 2
  })
})

describe('orden de ejercicios', () => {
  const rows: MatrixSlot['rows'] = [
    { row_key: 'a', exercise_id: 1, exercise_title: 'A', block_title: 'Principal', cells: { '10': { id: 11, block_id: 1, sequence: 1, prescribed: {}, enabled_metrics: ['rir'], notes: null }, '11': { id: 21, block_id: 2, sequence: 1, prescribed: {}, enabled_metrics: ['rir'], notes: null } } },
    { row_key: 'b', exercise_id: 2, exercise_title: 'B', block_title: 'Principal', cells: { '10': { id: 12, block_id: 1, sequence: 2, prescribed: {}, enabled_metrics: ['rir'], notes: null }, '11': { id: 22, block_id: 2, sequence: 2, prescribed: {}, enabled_metrics: ['rir'], notes: null } } },
    { row_key: 'c', exercise_id: 3, exercise_title: 'C', block_title: 'Accesorios', cells: { '10': { id: 13, block_id: 3, sequence: 1, prescribed: {}, enabled_metrics: ['rir'], notes: null } } },
  ]
  const s: MatrixSlot = { key: 'x', label: 'X', columns: slot.columns.slice(0, 2), rows }
  it('mueve una fila dentro de su bloque y no entre bloques', () => {
    const order = initialOrder(rows)
    expect(moveRow(order, rows, 'a', 1)).toEqual(['b', 'a', 'c'])
    expect(moveRow(order, rows, 'a', -1)).toBe(order) // ya es la primera
    expect(moveRow(order, rows, 'b', 1)).toBe(order) // c es de otro bloque
  })
  it('sin cambios de orden no genera operaciones', () => {
    expect(computeReorder(s, initialOrder(rows)).changes).toEqual([])
    expect(orderChanged(initialOrder(rows), rows)).toBe(false)
  })
  it('genera un reorder por sesión con los ids existentes en el orden nuevo', () => {
    const r = computeReorder(s, ['b', 'a', 'c'])
    expect(r.changes).toEqual([
      { type: 'reorder', assignment_id: 10, order: [12, 11, 13] },
      { type: 'reorder', assignment_id: 11, order: [22, 21] },
    ])
    expect(r.lines).toHaveLength(2)
  })
  it('orderedRows aplica el orden y las filas nuevas no cuentan como cambio', () => {
    expect(orderedRows(rows, ['b', 'a', 'c']).map(r => r.row_key)).toEqual(['b', 'a', 'c'])
    const withNew = [...rows, { row_key: 'new:9#1', exercise_id: 9, exercise_title: 'N', block_title: null, cells: {} }]
    expect(computeReorder({ ...s, rows: withNew }, [...initialOrder(withNew)]).changes).toEqual([])
  })
})

describe('cascada por ejercicio', () => {
  it('shiftNumeric suma a números, rangos y decimales; el texto queda igual', () => {
    expect(shiftNumeric('3', 1)).toBe('4')
    expect(shiftNumeric('8-10', 2)).toBe('10-12')
    expect(shiftNumeric('7,5', 1)).toBe('8,5')
    expect(shiftNumeric('AMRAP', 1)).toBe('AMRAP')
    expect(shiftNumeric('2', -5, 0)).toBe('0') // respeta el mínimo
    expect(shiftNumeric('9', 3, 0, 10)).toBe('10') // y el máximo
  })

  it('la base es la primera semana donde el ejercicio ya existe', () => {
    expect(cascadeBase(buildDraft(slot), slot, '5#1')?.assignment_id).toBe(10)
    expect(cascadeBase(buildDraft(slot), slot, 'no-existe')).toBeNull()
  })

  it('aplica el incremento acumulado semana a semana solo a ese ejercicio', () => {
    const d = cascadeRow(buildDraft(slot), slot, '5#1', { steps: { series: 1, reps: 2, intensity: 1 }, carga: [] })
    expect(d[10]['5#1']!.values.series).toBe('4') // la base no se toca
    expect(d[11]['5#1']!.values.series).toBe('5')
    expect(d[12]['5#1']!.values.series).toBe('6')
    expect(d[11]['5#1']!.values.reps).toBe('8-10')
    expect(d[12]['5#1']!.values.reps).toBe('10-12')
    expect(d[11]['5#1']!.values.intensity).toBe('3')
    expect(d[12]['5#1']!.values.intensity).toBe('4')
    // otro ejercicio de la misma sesión: intacto
    expect(d[11]['9#1']).toEqual(buildDraft(slot)[11]['9#1'])
  })

  it('carga: indicación textual por semana; no crea celdas que no existían', () => {
    const d = cascadeRow(buildDraft(slot), slot, '9#1', { steps: { series: 1 }, carga: ['Subir', 'Bajar'] })
    expect(d[11]['9#1']).toBeUndefined() // solo existe en la semana 1
    expect(d[12]['9#1']).toBeUndefined()
    const e = cascadeRow(buildDraft(slot), slot, '5#1', { steps: {}, carga: ['Subir', 'Mantener'] })
    expect(e[10]['5#1']!.values.carga).toBe('45')
    expect(e[11]['5#1']!.values.carga).toBe('Subir')
    expect(e[12]['5#1']!.values.carga).toBe('Mantener')
  })

  it('no inventa valores: si la base no tiene el campo relleno lo deja como está', () => {
    const d = cascadeRow(buildDraft(slot), slot, '5#1', { steps: { duracion: 5 }, carga: [] })
    expect(d[11]['5#1']!.values.duracion).toBe('')
  })
})
