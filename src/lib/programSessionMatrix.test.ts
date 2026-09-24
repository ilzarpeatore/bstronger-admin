import { describe, expect, it } from 'vitest'
import {
  addCell,
  applyPaste,
  buildDraft,
  cellIsDirty,
  computeChanges,
  fillRight,
  isGridPaste,
  parsePaste,
  removeCell,
  removeRow,
  setIntensityKey,
  setValue,
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
    expect(d[10]['5#1']!.values).toEqual({ series: '4', reps: '6-8', carga: '45', intensity: '2', descanso: '120' })
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
    expect(d[10]['5#1']!.values).toEqual({ series: '4', reps: '6-8', carga: '50', intensity: '2', descanso: '90' })
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
