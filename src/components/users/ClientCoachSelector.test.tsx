import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClientCoachSelector from './ClientCoachSelector'

const getMock = vi.fn()
const putMock = vi.fn()
vi.mock('@/lib/api', () => ({
  api: { get: (...a: unknown[]) => getMock(...a), put: (...a: unknown[]) => putMock(...a) },
  // Igual que el real: new ApiError(status, data) con el mensaje en data.message.
  ApiError: class ApiError extends Error {
    constructor(_status: number, data: { message?: string }) {
      super(data?.message)
    }
  },
}))
const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) } }))

const OPTIONS = [
  { id: 1, name: 'Be Stronger Admin', user_type: 'admin' },
  { id: 7, name: 'Coach Principal', user_type: 'coach' },
]

const payload = (coach: (typeof OPTIONS)[number] | null) => ({ data: { client_id: 102, coach, options: OPTIONS } })

beforeEach(() => {
  getMock.mockReset()
  putMock.mockReset()
  toastSuccess.mockReset()
  toastError.mockReset()
})

describe('ClientCoachSelector', () => {
  it('sin entrenador avisa y lista a coaches y admins', async () => {
    getMock.mockResolvedValue(payload(null))
    render(<ClientCoachSelector userId='102' />)

    const select = await screen.findByLabelText('Entrenador asignado')
    expect(getMock).toHaveBeenCalledWith('/admin/users/102/coach')
    expect((select as HTMLSelectElement).value).toBe('')
    expect(screen.getByText(/Sin entrenador, el motor de progresión no aplica reglas/)).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Be Stronger Admin (admin)' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Coach Principal' })).toBeTruthy()
  })

  it('con entrenador lo muestra seleccionado y sin aviso', async () => {
    getMock.mockResolvedValue(payload(OPTIONS[1]))
    render(<ClientCoachSelector userId={102} />)

    const select = (await screen.findByLabelText('Entrenador asignado')) as HTMLSelectElement
    expect(select.value).toBe('7')
    expect(screen.queryByText(/Sin entrenador, el motor/)).toBeNull()
  })

  it('al elegir uno hace PUT con su id y confirma con un toast', async () => {
    const user = userEvent.setup()
    getMock.mockResolvedValue(payload(null))
    putMock.mockResolvedValue(payload(OPTIONS[0]))
    render(<ClientCoachSelector userId='102' />)

    await user.selectOptions(await screen.findByLabelText('Entrenador asignado'), '1')

    expect(putMock).toHaveBeenCalledWith('/admin/users/102/coach', { coach_id: 1 })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Entrenador asignado: Be Stronger Admin'))
    expect((screen.getByLabelText('Entrenador asignado') as HTMLSelectElement).value).toBe('1')
  })

  it('"Sin entrenador" manda coach_id null', async () => {
    const user = userEvent.setup()
    getMock.mockResolvedValue(payload(OPTIONS[1]))
    putMock.mockResolvedValue(payload(null))
    render(<ClientCoachSelector userId='102' />)

    await user.selectOptions(await screen.findByLabelText('Entrenador asignado'), '')

    expect(putMock).toHaveBeenCalledWith('/admin/users/102/coach', { coach_id: null })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Entrenador quitado'))
  })

  it('si el servidor rechaza (no eres admin) enseña el error y no cambia la selección', async () => {
    const user = userEvent.setup()
    getMock.mockResolvedValue(payload(OPTIONS[1]))
    const { ApiError } = await import('@/lib/api')
    putMock.mockRejectedValue(new ApiError(403, { message: 'Solo un administrador puede asignar entrenadores.' }))
    render(<ClientCoachSelector userId='102' />)

    await user.selectOptions(await screen.findByLabelText('Entrenador asignado'), '1')

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Solo un administrador puede asignar entrenadores.'))
    expect((screen.getByLabelText('Entrenador asignado') as HTMLSelectElement).value).toBe('7')
  })

  it('si falla la carga ofrece reintentar', async () => {
    const user = userEvent.setup()
    getMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(payload(OPTIONS[1]))
    render(<ClientCoachSelector userId='102' />)

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(((await screen.findByLabelText('Entrenador asignado')) as HTMLSelectElement).value).toBe('7')
  })
})
