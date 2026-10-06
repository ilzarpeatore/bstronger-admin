import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PaymentControlForm from './PaymentControlForm'
import ClientPaymentControlCard from './ClientPaymentControlCard'
import { billingLabel, previewNote } from './payment-control-utils'

const getMock = vi.fn()
const putMock = vi.fn()
vi.mock('@/lib/api', () => ({
  api: { get: (...a: unknown[]) => getMock(...a), put: (...a: unknown[]) => putMock(...a) },
  ApiError: class ApiError extends Error {
    constructor(_status: number, data: { message?: string }) {
      super(data?.message)
    }
  },
}))
const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) } }))

const status = (over: Record<string, unknown> = {}) => ({
  state: 'warning',
  effective_state: 'warning',
  enforcement_enabled: true,
  day: 2,
  block_date: '2026-10-04',
  due_day: 1,
  exempt: false,
  grace_until: null,
  period: { year: 2026, month: 10, label: 'Octubre 2026' },
  due_date: '2026-10-01',
  paid: false,
  amount: 60,
  currency: 'EUR',
  days_until_block: 2,
  message: 'Tu pago de octubre está pendiente.',
  ...over,
})

const payload = (over: Record<string, unknown> = {}, settings: Record<string, unknown> = {}, applies = true) => ({
  data: { user_id: 102, applies, settings: { exempt: false, due_day: 1, grace_until: null, ...settings }, status: status(over) },
})

beforeEach(() => {
  getMock.mockReset()
  putMock.mockReset()
  toastSuccess.mockReset()
  toastError.mockReset()
})

describe('billingLabel', () => {
  it('traduce cada estado', () => {
    expect(billingLabel({ state: 'ok', day: null, grace_until: null, block_date: null })).toEqual({ label: 'Al día', tone: 'ok' })
    expect(billingLabel({ state: 'warning', day: 3, grace_until: null, block_date: null }).label).toBe('Aviso día 3')
    expect(billingLabel({ state: 'blocked', day: 5, grace_until: null, block_date: null })).toEqual({ label: 'Bloqueado', tone: 'danger' })
    expect(billingLabel({ state: 'exempt', day: null, grace_until: null, block_date: null }).label).toBe('Exento')
    expect(billingLabel({ state: 'grace', day: 5, grace_until: '2026-10-08', block_date: null }).label).toMatch(/^Gracia hasta 8/)
  })

  it('avisa de que es una previsión con el control apagado', () => {
    expect(previewNote({ enforcement_enabled: false, state: 'blocked' })).toMatch(/si lo activas hoy/)
    expect(previewNote({ enforcement_enabled: true, state: 'blocked' })).toBeNull()
    expect(previewNote({ enforcement_enabled: false, state: 'ok' })).toBeNull()
  })
})

describe('PaymentControlForm', () => {
  it('muestra el estado del periodo vigente', async () => {
    getMock.mockResolvedValue(payload())
    render(<PaymentControlForm userId='102' />)

    expect((await screen.findByTestId('billing-state')).textContent).toBe('Aviso día 2')
    expect(getMock).toHaveBeenCalledWith('/admin/users/102/payment-control')
    expect(screen.getByText(/Octubre 2026/)).toBeTruthy()
    expect(screen.getByText(/Se bloquea el/)).toBeTruthy()
  })

  it('marcar exento hace PUT y refresca el estado', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    getMock.mockResolvedValue(payload())
    putMock.mockResolvedValue(payload({ state: 'exempt', effective_state: 'exempt', exempt: true }, { exempt: true }))
    render(<PaymentControlForm userId='102' onChange={onChange} />)

    await user.click(await screen.findByLabelText('Exento del control de impago'))

    expect(putMock).toHaveBeenCalledWith('/admin/users/102/payment-control', { exempt: true })
    await waitFor(() => expect(screen.getByTestId('billing-state').textContent).toBe('Exento'))
    expect(onChange).toHaveBeenCalled()
  })

  it('cambia el día de cobro y da días de gracia', async () => {
    const user = userEvent.setup()
    getMock.mockResolvedValue(payload({ state: 'blocked', effective_state: 'blocked', day: 5 }))
    putMock.mockResolvedValueOnce(payload({ state: 'ok', effective_state: 'ok', due_day: 15 }, { due_day: 15 }))
    putMock.mockResolvedValueOnce(payload({ state: 'grace', effective_state: 'grace', grace_until: '2026-10-10' }, { due_day: 15, grace_until: '2026-10-10' }))
    render(<PaymentControlForm userId='102' />)

    await user.selectOptions(await screen.findByLabelText('Día de cobro'), '15')
    expect(putMock).toHaveBeenCalledWith('/admin/users/102/payment-control', { due_day: 15 })

    const days = screen.getByLabelText('Días de gracia')
    await user.clear(days)
    await user.type(days, '5')
    await user.click(screen.getByRole('button', { name: 'Dar días de gracia' }))
    expect(putMock).toHaveBeenLastCalledWith('/admin/users/102/payment-control', { grace_days: 5 })
    await waitFor(() => expect(screen.getByTestId('billing-state').textContent).toMatch(/^Gracia hasta/))
    expect(screen.getByRole('button', { name: /Quitar/ })).toBeTruthy()
  })
})

describe('ClientPaymentControlCard', () => {
  it('no se muestra a clientes que no son 1:1', async () => {
    getMock.mockResolvedValue(payload({ state: 'not_applicable', effective_state: 'not_applicable' }, {}, false))
    const { container } = render(<ClientPaymentControlCard userId='9' />)
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('se muestra a clientes 1:1', async () => {
    getMock.mockResolvedValue(payload())
    render(<ClientPaymentControlCard userId='102' />)
    expect(await screen.findByText('Control de impago')).toBeTruthy()
    expect((await screen.findByTestId('billing-state')).textContent).toBe('Aviso día 2')
  })
})
