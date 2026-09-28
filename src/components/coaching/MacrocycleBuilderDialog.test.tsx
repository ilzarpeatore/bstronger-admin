import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MacrocycleBuilderDialog, { bulkPayload, nextMesocycleNumber, sortSelection, type BuilderProgram } from './MacrocycleBuilderDialog'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { post: vi.fn(async () => ({})) } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const program = (over: Partial<BuilderProgram> & { id: number; title: string }): BuilderProgram => ({
  clientName: null,
  numWeeks: 4,
  currentMacrocycle: null,
  currentMesocycle: null,
  suggestedMesocycle: null,
  ...over,
})

const programs = [
  program({ id: 1, title: 'Arafa — M1 · Base y control del hombro', suggestedMesocycle: 1 }),
  program({ id: 2, title: 'Arafa — M2 · Construir volumen', suggestedMesocycle: 2 }),
  program({ id: 3, title: 'Sin número en el título' }),
  program({ id: 4, title: 'Ya agrupado', currentMacrocycle: 'Macro Z', currentMesocycle: 1 }),
]

describe('formar un macrociclo a mano', () => {
  beforeEach(() => vi.clearAllMocks())

  it('numera con el sugerido si está libre, o con el siguiente hueco', () => {
    expect(nextMesocycleNumber([], null)).toBe(1)
    expect(nextMesocycleNumber([1, 2], 2)).toBe(3)
    expect(nextMesocycleNumber([1, 3], 2)).toBe(2)
    expect(nextMesocycleNumber([1, 2], null)).toBe(3)
  })

  it('ordena por número y deja los sin número al final; el payload sale ordenado', () => {
    const selection = [
      { id: 10, mesocycleNumber: '' },
      { id: 11, mesocycleNumber: '2' },
      { id: 12, mesocycleNumber: '1' },
    ]
    expect(sortSelection(selection).map((s) => s.id)).toEqual([12, 11, 10])
    expect(bulkPayload('  Arafa  ', selection)).toEqual({
      macrocycle_name: 'Arafa',
      items: [
        { id: 12, mesocycle_number: 1 },
        { id: 11, mesocycle_number: 2 },
        { id: 10, mesocycle_number: null },
      ],
    })
  })

  it('oculta los ya agrupados, prerrellena los números y guarda la selección', async () => {
    const onSaved = vi.fn(async () => {})
    const onClose = vi.fn()
    render(<MacrocycleBuilderDialog programs={programs} existing={[]} onSaved={onSaved} onClose={onClose} />)

    expect(screen.queryByText('Ya agrupado')).not.toBeInTheDocument()
    const guardar = screen.getByRole('button', { name: 'Guardar macrociclo' })
    expect(guardar).toBeDisabled() // sin nombre ni selección

    await userEvent.type(screen.getByLabelText('Nombre del macrociclo'), 'Arafa - Macrociclo 1')
    await userEvent.click(screen.getByRole('checkbox', { name: /Construir volumen/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Base y control del hombro/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Sin número en el título/ }))

    expect(screen.getByLabelText('Número de mesociclo de Arafa — M2 · Construir volumen')).toHaveValue('2')
    expect(screen.getByLabelText('Número de mesociclo de Arafa — M1 · Base y control del hombro')).toHaveValue('1')
    expect(screen.getByLabelText('Número de mesociclo de Sin número en el título')).toHaveValue('3') // siguiente hueco

    await userEvent.click(guardar)

    expect(api.post).toHaveBeenCalledWith('/admin/training-program-set-macrocycle-bulk', {
      macrocycle_name: 'Arafa - Macrociclo 1',
      items: [
        { id: 1, mesocycle_number: 1 },
        { id: 2, mesocycle_number: 2 },
        { id: 3, mesocycle_number: 3 },
      ],
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSaved).toHaveBeenCalled()
  })

  it('al añadir a un macrociclo existente continúa su numeración', async () => {
    render(
      <MacrocycleBuilderDialog
        programs={programs}
        existing={[{ name: 'Macro Z', mesocycles: [1, 2] }]}
        initialName="macro z"
        onSaved={async () => {}}
        onClose={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('checkbox', { name: /Sin número en el título/ }))
    expect(screen.getByLabelText('Número de mesociclo de Sin número en el título')).toHaveValue('3')
  })

  it('puede mostrar también los que ya están en otro macrociclo', async () => {
    render(<MacrocycleBuilderDialog programs={programs} existing={[]} onSaved={async () => {}} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /Ocultar los que ya están en un macrociclo/ }))
    expect(screen.getByText('Ya agrupado')).toBeInTheDocument()
    expect(screen.getByText(/ahora en «Macro Z»/)).toBeInTheDocument()
  })
})
