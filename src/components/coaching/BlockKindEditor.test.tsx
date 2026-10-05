import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkoutTemplateViewer, { type WorkoutViewerBlock } from './WorkoutTemplateViewer'
import { BlockParamsEditor } from './BlockKindEditor'

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async () => ({ data: [] })),
  },
}))

const ex = (id: number, extra: Partial<WorkoutViewerBlock['exercises'][number]> = {}) => ({ id, exercise_id: id, title: `Ejercicio ${id}`, ...extra })

describe('cabecera de bloque con tipo', () => {
  it('muestra el resumen del tipo y columnas de acondicionamiento sin RIR/RPE', () => {
    const blocks: WorkoutViewerBlock[] = [
      {
        id: 1,
        title: 'Metcon',
        kind: 'emom',
        params: { interval_sec: 60, rounds: 12, benchmark_key: 'emom_12' },
        exercises: [ex(1, { prescribed: { duracion: '45' }, enabled_metrics: ['reps', 'tiempo'] }), ex(2), ex(3)],
      },
      { id: 2, title: 'Fuerza', exercises: [ex(4, { enabled_metrics: ['reps', 'carga', 'rir'] })] },
    ]
    render(<WorkoutTemplateViewer title='Sesión' blocks={blocks} readOnly />)
    expect(screen.getByText("EMOM 12' · 3 ejercicios")).toBeInTheDocument()
    expect(screen.getByText('emom_12')).toBeInTheDocument()
    // Bloque de acondicionamiento: sin toggle RIR/RPE; el bloque normal lo conserva (1 toggle → 1 botón "rir").
    expect(screen.getAllByRole('button', { name: 'rir' })).toHaveLength(1)
    // `duracion` se lee como tiempo y se muestra en mm:ss.
    expect(screen.getByDisplayValue('0:45')).toBeInTheDocument()
  })

  it('al editar el bloque llama a onUpdateBlockKind con params en segundos', async () => {
    const onUpdateBlockKind = vi.fn()
    const blocks: WorkoutViewerBlock[] = [{ id: 7, title: 'AMRAP', kind: 'amrap', params: { duration_sec: 600 }, exercises: [ex(1)] }]
    render(<WorkoutTemplateViewer title='Sesión' blocks={blocks} onUpdateBlockKind={onUpdateBlockKind} />)
    const input = screen.getByLabelText('Duración')
    expect(input).toHaveValue('10:00')
    await userEvent.clear(input)
    await userEvent.type(input, '20')
    fireEvent.blur(input)
    expect(onUpdateBlockKind).toHaveBeenCalledWith(7, 'amrap', { duration_sec: 1200 })
  })
})

describe('BlockParamsEditor', () => {
  it('Tabata rellena 20/10 × 8 conservando el benchmark', async () => {
    const onChange = vi.fn()
    render(<BlockParamsEditor kind='intervalos' params={{ work_sec: 40, rest_sec: 20, rounds: 5, benchmark_key: 'bike' }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Tabata' }))
    expect(onChange).toHaveBeenCalledWith('intervalos', { work_sec: 20, rest_sec: 10, rounds: 8, benchmark_key: 'bike' })
  })
})
