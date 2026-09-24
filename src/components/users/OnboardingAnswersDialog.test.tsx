import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingAnswersDialog from './OnboardingAnswersDialog'

const postMock = vi.fn()
vi.mock('@/lib/api', () => ({
  api: { post: (...a: unknown[]) => postMock(...a) },
  ApiError: class ApiError extends Error {},
}))
const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }))

const training = {
  goal_type: 'gain_muscle', activity_level: 'moderate', lifestyle_type: 'mostly_sitting', training_experience_months: 24,
  training_days_per_week: 4, session_duration_preference: '60', training_mindset: 'motivated', previous_coaching: 'self_trained',
  current_routine_style: 'structured', weekly_split_preference: 'upper_lower', technique_level: 6, realistic_goal: 'Ganar 3 kg',
}
const parq = {
  parq_heart_condition: false, parq_chest_pain_activity: false, parq_chest_pain_rest_last_month: false, parq_dizziness_balance: false,
  parq_bone_joint_problem: false, parq_bp_or_heart_medication: false, parq_reason_not_to_exercise: false,
  parq_pregnant_or_possible: null, parq_menstrual_change_or_stress_fracture: null, parq_eating_disorder_history: null,
  parq_fitness_level: 5, parq_medical_history: null, parq_goals: 'Salud',
}

beforeEach(() => {
  postMock.mockReset()
  toastError.mockReset()
  postMock.mockResolvedValue({})
})

describe('OnboardingAnswersDialog', () => {
  it('guarda el cuestionario de entrenamiento con los cambios y el user_id', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<OnboardingAnswersDialog section='training' userId={102} initial={training} onClose={() => {}} onSaved={onSaved} />)
    const days = await screen.findByLabelText('Días de entrenamiento por semana')
    await user.clear(days)
    await user.type(days, '5')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    expect(postMock.mock.calls[0][0]).toBe('/admin/admin-onboarding-training-questionnaire-update')
    expect(postMock.mock.calls[0][1]).toMatchObject({ user_id: 102, training_days_per_week: 5, goal_type: 'gain_muscle', session_duration_preference: '60', technique_level: 6 })
    expect(onSaved).toHaveBeenCalled()
  })

  it('PAR-Q: no pide las preguntas de mujer a un hombre y obliga a responder las Sí/No pendientes', async () => {
    const user = userEvent.setup()
    render(<OnboardingAnswersDialog section='par_q' userId={102} gender='male' initial={parq} onClose={() => {}} onSaved={() => {}} />)
    expect(await screen.findByLabelText('¿Condición cardíaca conocida?')).toBeInTheDocument()
    expect(screen.queryByLabelText('¿Embarazada o posibilidad de estarlo?')).toBeNull()
    // parq_eating_disorder_history está sin responder (null): no se puede guardar como "No" sin querer
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(postMock).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalled()
    await user.selectOptions(screen.getByLabelText('¿Historial de trastorno alimentario?'), 'no')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    expect(postMock.mock.calls[0][1]).toMatchObject({ user_id: 102, parq_eating_disorder_history: false, parq_fitness_level: 5, parq_medical_history: null })
  })

  it('a una mujer sí le pregunta por embarazo', async () => {
    render(<OnboardingAnswersDialog section='par_q' userId={5} gender='female' initial={parq} onClose={() => {}} onSaved={() => {}} />)
    expect(await screen.findByLabelText('¿Embarazada o posibilidad de estarlo?')).toBeInTheDocument()
  })
})
