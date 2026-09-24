import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProgramSessionMatrixEditor from './ProgramSessionMatrixEditor'

const getMock = vi.fn()
const postMock = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => getMock(...a),
    post: (...a: unknown[]) => postMock(...a),
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const matrix = {
  program: { id: 88, title: 'Mesociclo de prueba', num_weeks: 3 },
  slots: [
    {
      key: 'empuje',
      label: 'Empuje',
      columns: [
        { assignment_id: 10, week_number: 1, day_of_week: 3, is_deload: false, scheduled_date: null, workout_template_id: 100, template_title: 'P · Empuje (S1)', linked_weeks: [], linked_elsewhere: 0 },
        { assignment_id: 11, week_number: 2, day_of_week: 3, is_deload: false, scheduled_date: null, workout_template_id: 101, template_title: 'P · Empuje (S2)', linked_weeks: [3], linked_elsewhere: 0 },
      ],
      rows: [
        {
          row_key: '5#1', exercise_id: 5, exercise_title: 'Press banca', block_title: 'Principal',
          cells: {
            '10': { id: 1, block_id: 1, sequence: 1, prescribed: { series: '4', reps: '6-8', carga: '45', rir: '2' }, enabled_metrics: ['reps', 'carga', 'rir'], notes: null },
            '11': { id: 2, block_id: 2, sequence: 1, prescribed: { series: '4', reps: '8-10' }, enabled_metrics: ['reps', 'carga', 'rir'], notes: null },
          },
        },
        {
          row_key: '9#1', exercise_id: 9, exercise_title: 'Fondos', block_title: 'Principal',
          cells: {
            '10': { id: 3, block_id: 1, sequence: 2, prescribed: { series: '3' }, enabled_metrics: ['reps', 'rir'], notes: null },
          },
        },
      ],
    },
  ],
}

beforeEach(() => {
  getMock.mockReset()
  postMock.mockReset()
  getMock.mockResolvedValue({ data: { data: matrix } })
  postMock.mockResolvedValue({ data: { data: { applied: {}, unlinked: [] } } })
})

const renderEditor = () =>
  render(<ProgramSessionMatrixEditor open onOpenChange={() => {}} programId={88} initialAssignmentIds={null} />)

describe('ProgramSessionMatrixEditor', () => {
  it('pinta el tipo de sesión, las semanas como columnas y los ejercicios como filas', async () => {
    renderEditor()
    expect(await screen.findByText('Press banca')).toBeInTheDocument()
    expect(screen.getByText('Fondos')).toBeInTheDocument()
    expect(screen.getByText('Sem 1 · Día 3')).toBeInTheDocument()
    expect(screen.getByText('Sem 2 · Día 3')).toBeInTheDocument()
    // la sesión de la semana 2 comparte plantilla con la 3
    expect(screen.getByText('= S3')).toBeInTheDocument()
    // valores cargados en los inputs (semana 1, Press banca)
    expect(screen.getByLabelText('Reps (fila 1, semana 1)')).toHaveValue('6-8')
    expect(screen.getByLabelText('Reps (fila 1, semana 2)')).toHaveValue('8-10')
    // el ejercicio ausente en la semana 2 ofrece "Añadir"
    expect(screen.getByRole('button', { name: /Añadir$/ })).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith('/admin/program-session-matrix?training_program_id=88')
  })

  it('editar una celda cuenta el cambio y el resumen lo lista; guardar manda el lote', async () => {
    const user = userEvent.setup()
    renderEditor()
    const reps = await screen.findByLabelText('Reps (fila 1, semana 2)')
    expect(screen.getByText('Sin cambios')).toBeInTheDocument()

    await user.clear(reps)
    await user.type(reps, '8-12')
    expect(await screen.findByText('1 cambios sin guardar')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Revisar y guardar' }))
    expect(await screen.findByText(/se desvincularán/)).toBeInTheDocument()
    expect(screen.getByText(/Reps "8-10" → "8-12"/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    const [url, body] = postMock.mock.calls[0]
    expect(url).toBe('/admin/program-session-matrix-save')
    expect(body.training_program_id).toBe(88)
    expect(body.changes).toEqual([{ type: 'update', assignment_id: 11, row_id: 2, prescribed: { reps: '8-12' } }])
  })

  it('pegar una rejilla de Excel rellena varias celdas', async () => {
    renderEditor()
    const series = await screen.findByLabelText('Series (fila 1, semana 1)')
    fireEvent.paste(series, { clipboardData: { getData: () => '5\t8-10\t50\t2\t90\n3\t12' } })
    await waitFor(() => expect(screen.getByLabelText('Reps (fila 1, semana 1)')).toHaveValue('8-10'))
    expect(screen.getByLabelText('Carga (fila 1, semana 1)')).toHaveValue('50')
    expect(screen.getByLabelText('Series (fila 2, semana 1)')).toHaveValue('3')
    expect(screen.getByLabelText('Reps (fila 2, semana 1)')).toHaveValue('12')
  })

  it('sin sesiones muestra el estado vacío', async () => {
    getMock.mockResolvedValue({ data: { data: { program: matrix.program, slots: [] } } })
    renderEditor()
    expect(await screen.findByText(/aún no tiene sesiones asignadas/)).toBeInTheDocument()
  })
})

describe('ProgramSessionMatrixEditor — aviso de programa asignado directamente', () => {
  it('avisa cuando un cliente usa el programa de biblioteca sin copia propia', async () => {
    getMock.mockResolvedValue({
      data: { data: { ...matrix, program: { ...matrix.program, direct_clients: [{ id: 8, name: 'Hamzaa Cliente' }] } } },
    })
    renderEditor()
    expect(await screen.findByRole('alert')).toHaveTextContent('Hamzaa Cliente')
    expect(screen.getByRole('alert')).toHaveTextContent('en vivo')
  })

  it('no muestra aviso en copias de cliente o programas sin asignar', async () => {
    renderEditor()
    await screen.findByText('Press banca')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('ProgramSessionMatrixEditor — notas, columnas, orden y cascada', () => {
  it('cascada por ejercicio: desde la semana 1 sube series y pone una indicación de carga solo en ese ejercicio', async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByText('Press banca')
    await user.click(screen.getAllByRole('button').filter(b => b.textContent === '' && b.closest('td'))[0] as HTMLElement)
    await user.click(await screen.findByText('Cascada por semanas…'))
    await user.selectOptions(await screen.findByLabelText('Series por semana'), '1')
    await user.selectOptions(screen.getByLabelText('Carga semana 2'), 'Subir')
    await user.click(screen.getByRole('button', { name: 'Aplicar al borrador' }))
    expect(await screen.findByText('1 cambios sin guardar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Revisar y guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    // la semana 1 no se toca; Fondos (otro ejercicio) tampoco
    expect(postMock.mock.calls[0][1].changes).toEqual([
      { type: 'update', assignment_id: 11, row_id: 2, prescribed: { series: '5', carga: 'Subir' } },
    ])
  })

  it('las columnas opcionales (tempo) se muestran desde el menú "Columnas"', async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByText('Press banca')
    expect(screen.queryByLabelText('Tempo (fila 1, semana 1)')).toBeNull()
    await user.click(screen.getByTitle('Mostrar u ocultar columnas'))
    await user.click(await screen.findByText('Tempo'))
    const tempo = await screen.findByLabelText('Tempo (fila 1, semana 1)')
    await user.type(tempo, '3-1-1-0')
    await user.click(await screen.findByRole('button', { name: 'Revisar y guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    expect(postMock.mock.calls[0][1].changes).toEqual([{ type: 'update', assignment_id: 10, row_id: 1, prescribed: { tempo: '3-1-1-0' } }])
  })

  it('notas: se editan desde el menú de la celda y viajan en el guardado', async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByText('Press banca')
    await user.click(screen.getAllByTitle('Acciones de esta semana')[0])
    await user.click(await screen.findByText('Añadir notas…'))
    await user.type(await screen.findByPlaceholderText(/Indicaciones del entrenador/), 'Pausa 1s abajo')
    await user.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(await screen.findByText('1 cambios sin guardar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Revisar y guardar' }))
    expect(await screen.findByText(/Notas — → "Pausa 1s abajo"/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    expect(postMock.mock.calls[0][1].changes).toEqual([{ type: 'update', assignment_id: 10, row_id: 1, notes: 'Pausa 1s abajo' }])
  })

  it('orden: bajar un ejercicio genera un reorder por sesión con los ids en el orden nuevo', async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByText('Press banca')
    // el menú de la fila 1 (Press banca) está en la primera columna
    await user.click(screen.getAllByRole('button').filter(b => b.textContent === '' && b.closest('td'))[0] as HTMLElement)
    await user.click(await screen.findByText(/Bajar \(en todas las semanas\)/))
    await user.click(await screen.findByRole('button', { name: 'Revisar y guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    expect(postMock.mock.calls[0][1].changes).toEqual([
      { type: 'reorder', assignment_id: 10, order: [3, 1] },
    ])
  })
})
