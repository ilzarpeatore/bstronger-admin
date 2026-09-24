import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExercisePickerPanel from './ExercisePickerPanel'

const getMock = vi.fn()
vi.mock('@/lib/api', () => ({ api: { get: (...a: unknown[]) => getMock(...a) } }))

const base = { level_id: 1, type: 'sets', exercise_type: 'fuerza', based: 'reps', seconds_per_rep: null, is_premium: 0, instruction: null, tips: null, video_url: null, video_type: null }
const exercises = [
  { ...base, id: 1, title: 'Press banca', exercise_image: 'https://img/press.jpg', equipment_id: 7, equipment_title: 'Barra', bodypart_ids: [1], bodypart_names: 'Pecho', status: 'active' },
  { ...base, id: 2, title: 'Sentadilla', exercise_image: null, equipment_id: 8, equipment_title: 'Mancuernas', bodypart_ids: [2], bodypart_names: 'Pierna', status: 'active' },
  { ...base, id: 3, title: 'Press antiguo', exercise_image: null, equipment_id: 7, equipment_title: 'Barra', bodypart_ids: [1], bodypart_names: 'Pecho', status: 'inactive' },
]

beforeEach(() => {
  getMock.mockReset()
  getMock.mockImplementation((url: string) => {
    if (url.startsWith('/admin/exercises')) return Promise.resolve({ data: { data: exercises } })
    if (url.startsWith('/admin/body-parts')) return Promise.resolve({ data: { data: [{ id: 1, title: 'Pecho' }, { id: 2, title: 'Pierna' }] } })
    if (url.startsWith('/admin/equipment')) return Promise.resolve({ data: { data: [{ id: 7, title: 'Barra' }, { id: 8, title: 'Mancuernas' }] } })
    return Promise.resolve({ data: { data: [{ id: 1, title: 'Principiante' }] } })
  })
})

describe('ExercisePickerPanel', () => {
  it('muestra foto y datos de cada ejercicio activo, y no los inactivos por defecto', async () => {
    render(<ExercisePickerPanel onPick={() => {}} />)
    expect(await screen.findByText('Press banca')).toBeInTheDocument()
    expect(document.querySelector('img[src="https://img/press.jpg"]')).not.toBeNull()
    expect(screen.getByText('Pecho')).toBeInTheDocument()
    expect(screen.queryByText('Press antiguo')).toBeNull()
  })

  it('filtra por grupo muscular y por texto (sin acentos ni erratas) y devuelve el elegido', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<ExercisePickerPanel onPick={onPick} />)
    await screen.findByText('Press banca')
    await user.click(screen.getByRole('button', { name: /Filtros/ }))
    await user.click(await screen.findByRole('button', { name: /^Piernas?1$/ }))
    expect(screen.queryByText('Press banca')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Limpiar filtros/ }))
    await user.type(screen.getByPlaceholderText('Buscar ejercicio...'), 'sentadila')
    await user.click(await screen.findByText('Sentadilla'))
    expect(onPick).toHaveBeenCalledWith({ id: 2, title: 'Sentadilla' })
  })
})
