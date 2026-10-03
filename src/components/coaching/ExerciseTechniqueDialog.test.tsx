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

    const noRec = { grabar: false, grabar_series: null, grabar_nota: null }
    expect(techniquePayload({ key: '', series: 'ultima', otra: 'x' })).toEqual({ tecnica: null, tecnica_series: null, tecnica_otra: null, ...noRec })
    expect(techniquePayload({ key: 'otra', series: 'todas', otra: ' Pausa 2 s ' })).toEqual({ tecnica: 'otra', tecnica_series: 'todas', tecnica_otra: 'Pausa 2 s', ...noRec })
  })

  it('lee, pone y quita la grabación junto a la técnica', () => {
    const p = { series: '3', grabar: true, grabar_series: 'ultima', grabar_nota: 'De lado' }
    expect(techniqueFromPrescribed(p)).toEqual({ key: '', series: 'todas', otra: '', recording: { on: true, series: 'ultima', nota: 'De lado' } })

    const rec = { on: true, series: 'primera' as const, nota: ' de frente ' }
    expect(withTechnique({ series: '3' }, { key: 'rest_pause', series: 'todas', otra: '', recording: rec })).toEqual({
      series: '3', tecnica: 'rest_pause', tecnica_series: 'todas', grabar: true, grabar_series: 'primera', grabar_nota: 'de frente',
    })
    expect(withTechnique(p, { key: '', series: 'todas', otra: '' })).toEqual({ series: '3' })
    expect(techniquePayload({ key: '', series: 'todas', otra: '', recording: rec })).toEqual({
      tecnica: null, tecnica_series: null, tecnica_otra: null, grabar: true, grabar_series: 'primera', grabar_nota: 'de frente',
    })
  })

  it('el diálogo pide grabación con series y nota', async () => {
    const onSave = vi.fn(async () => {})
    render(
      <ExerciseTechniqueDialog
        exercise={{ title: 'Sentadilla', prescribed: { series: '3' } }}
        description='Plantilla.'
        onClose={() => {}}
        onSave={onSave}
      />,
    )
    await userEvent.click((await screen.findAllByRole('switch'))[0])
    await userEvent.click(screen.getByRole('button', { name: 'Solo la última' }))
    await userEvent.type(screen.getByPlaceholderText('p. ej. de lado, que se vea la cadera'), ' de lado ')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onSave).toHaveBeenCalledWith({ key: '', series: 'todas', otra: '', recording: { on: true, series: 'ultima', nota: 'de lado' } })
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
