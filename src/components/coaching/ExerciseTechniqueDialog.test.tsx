import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExerciseTechniqueDialog, { techniqueFromPrescribed, techniquePayload, withTechnique } from './ExerciseTechniqueDialog'

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async () => ({
      data: [
        { key: 'rest_pause', label: 'Rest-pause', description: 'Pausas cortas dentro de la serie.' },
        { key: 'otra', label: 'Otra', description: '' },
      ],
    })),
  },
}))

describe('técnica especial de un ejercicio', () => {
  it('lee, pone y quita la técnica del prescribed sin tocar el resto', () => {
    expect(techniqueFromPrescribed({ series: '3' })).toEqual({ key: '', series: 'todas', otra: '' })
    expect(techniqueFromPrescribed({ tecnica: 'rest_pause', tecnica_series: 'ultima' })).toEqual({ key: 'rest_pause', series: 'ultima', otra: '' })

    const p = { series: '3', reps: '8', tecnica: 'otra', tecnica_series: 'todas', tecnica_otra: 'Pausa' }
    expect(withTechnique(p, { key: 'rest_pause', series: 'ultima', otra: 'Pausa' })).toEqual({ series: '3', reps: '8', tecnica: 'rest_pause', tecnica_series: 'ultima' })
    expect(withTechnique(p, { key: '', series: 'todas', otra: '' })).toEqual({ series: '3', reps: '8' })

    expect(techniquePayload({ key: '', series: 'ultima', otra: 'x' })).toEqual({ tecnica: null, tecnica_series: null, tecnica_otra: null })
    expect(techniquePayload({ key: 'otra', series: 'todas', otra: ' Pausa 2 s ' })).toEqual({ tecnica: 'otra', tecnica_series: 'todas', tecnica_otra: 'Pausa 2 s' })
  })

  it('el diálogo parte de la técnica actual y guarda la elegida', async () => {
    const onSave = vi.fn(async () => {})
    const onClose = vi.fn()
    render(
      <ExerciseTechniqueDialog
        exercise={{ title: 'Press banca', prescribed: { series: '3', tecnica: 'rest_pause', tecnica_series: 'ultima' } }}
        description='Solo para este cliente en esta sesión.'
        onClose={onClose}
        onSave={onSave}
      />,
    )
    const select = await screen.findByLabelText('Técnica')
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe('rest_pause'))

    await userEvent.selectOptions(select, 'otra')
    const guardar = screen.getByRole('button', { name: 'Guardar' })
    expect(guardar).toBeDisabled() // «Otra» sin decir cuál
    await userEvent.type(screen.getByPlaceholderText('p. ej. Pausa de 2 s arriba'), 'Pausa de 2 s')
    await userEvent.click(guardar)

    expect(onSave).toHaveBeenCalledWith({ key: 'otra', series: 'ultima', otra: 'Pausa de 2 s' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
