import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import MacrocyclesView from './MacrocyclesView'

const meso = (id: number, n: number, title: string) => ({
  id,
  title,
  mesocycle_number: n,
  grouping: 'manual',
  macrocycle_name: 'Macrociclo 1 CARLOS',
  num_weeks: 5,
  fecha_inicio: null,
  fecha_fin: null,
  activo: true,
  source: null,
  source_id: null,
  created_at: '2026-09-27T15:56:18+00:00',
  assignments: [],
})

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async () => ({
      data: [
        {
          key: 'macrociclo 1 carlos#library',
          name: 'Macrociclo 1 CARLOS',
          client: null,
          total_weeks: 26,
          last_created_at: '2026-09-27T15:56:23+00:00',
          mesocycles: [
            meso(134, 1, 'Carlos Palomar -- Macrociclo 1 -- Mesociclo 1/5 -- Adaptacion y linea base'),
            meso(135, 2, 'Carlos Palomar -- Macrociclo 1 -- Mesociclo 2/5 -- Progresion de volumen'),
          ],
        },
      ],
      unassigned: [],
    })),
    post: vi.fn(async () => ({})),
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const renderView = () =>
  render(
    <MemoryRouter>
      <MacrocyclesView />
    </MemoryRouter>,
  )

describe('página de macrociclos como acordeón', () => {
  it('cerrado solo muestra la cabecera y se abre y cierra al hacer clic en el macrociclo', async () => {
    renderView()
    const header = await screen.findByRole('button', { name: /Macrociclo 1 CARLOS/ })

    // Cabecera visible con sus datos y acciones; la tabla de mesociclos, no
    expect(screen.getAllByText('Biblioteca')).toHaveLength(2) // el filtro de arriba y la etiqueta de la cabecera
    expect(screen.getByText('2 mesociclos')).toBeInTheDocument()
    expect(screen.getByText('26 semanas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dashboard/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Añadir mesociclo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Disolver/ })).toBeInTheDocument()
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/Adaptacion y linea base/)).not.toBeInTheDocument()

    await userEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Adaptacion y linea base/)).toBeInTheDocument()
    expect(screen.getByText(/Progresion de volumen/)).toBeInTheDocument()

    await userEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/Adaptacion y linea base/)).not.toBeInTheDocument()
  })

  it('también se abre al hacer clic en la cabecera, pero no con los botones de acción', async () => {
    renderView()
    await screen.findByRole('button', { name: /Macrociclo 1 CARLOS/ })

    await userEvent.click(screen.getByRole('button', { name: /Disolver/ }))
    expect(screen.getByText(/Sus 2 mesociclos dejan de formar un macrociclo/)).toBeInTheDocument()
    expect(screen.queryByText(/Adaptacion y linea base/)).not.toBeInTheDocument() // el acordeón sigue cerrado

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(screen.getByText('2 mesociclos')) // clic en la cabecera (fuera de los botones)
    expect(screen.getByText(/Adaptacion y linea base/)).toBeInTheDocument()
  })
})
