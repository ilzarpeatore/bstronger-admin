import { useEffect, useState } from 'react'

import { VideoIcon, ZapIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  NO_RECORDING,
  NO_TECHNIQUE,
  RECORDING_SERIES_LABELS,
  recordingFromPrescribed,
  recordingSummary,
  type RecordingDraft,
  type RecordingSeries,
  type TechniqueDraft,
} from '@/lib/programSessionMatrix'
import { OTHER_TECHNIQUE, techniqueLabel, type TrainingTechnique, useTrainingTechniques } from '@/lib/trainingTechniques'

// Técnica especial de UN ejercicio (rest-pause, drop set...), para los editores
// que trabajan ejercicio a ejercicio: la sesión de un cliente en su calendario,
// «Editar solo este día» y las plantillas. El editor de sesiones del programa
// (ProgramSessionMatrixEditor) usa los mismos campos (TechniqueFields) con su
// propio diálogo, que además puede aplicarla a las semanas siguientes.
// En el mismo diálogo va «Pedir grabación» (grabar / grabar_series / grabar_nota en el
// `prescribed`, Bckbs App\Support\RecordingRequests): viaja en el campo `recording`.

type Prescribed = Record<string, string | number | boolean | null | undefined> | null | undefined

/** Técnica guardada en el `prescribed` de un ejercicio (claves tecnica / tecnica_series / tecnica_otra). */
export function techniqueFromPrescribed(prescribed: Prescribed): TechniqueDraft {
  const key = String(prescribed?.tecnica ?? '').trim()
  const recording = recordingFromPrescribed(prescribed)
  const withRecording = recording.on ? { recording } : {}
  if (!key) return { ...NO_TECHNIQUE, ...withRecording }
  return {
    key,
    series: prescribed?.tecnica_series === 'ultima' ? 'ultima' : 'todas',
    otra: String(prescribed?.tecnica_otra ?? ''),
    ...withRecording,
  }
}

/** El `prescribed` con la técnica puesta o quitada: lo mismo que guarda el backend (TrainingTechniques::apply). */
export function withTechnique<T extends Record<string, unknown>>(prescribed: T | null | undefined, t: TechniqueDraft): T {
  const rest: Record<string, unknown> = { ...(prescribed ?? {}) }
  delete rest.tecnica
  delete rest.tecnica_series
  delete rest.tecnica_otra
  delete rest.grabar
  delete rest.grabar_series
  delete rest.grabar_nota
  const r = t.recording
  if (r?.on) {
    rest.grabar = true
    rest.grabar_series = r.series
    if (r.nota.trim()) rest.grabar_nota = r.nota.trim()
  }
  if (!t.key) return rest as T
  return {
    ...rest,
    tecnica: t.key,
    tecnica_series: t.series,
    ...(t.key === OTHER_TECHNIQUE ? { tecnica_otra: t.otra.trim() } : {}),
  } as unknown as T
}

/** Payload de los endpoints de técnica (workout-template-exercise-technique, session-detail-update-override-technique). */
export function techniquePayload(t: TechniqueDraft) {
  return {
    tecnica: t.key || null,
    tecnica_series: t.key ? t.series : null,
    tecnica_otra: t.key === OTHER_TECHNIQUE ? t.otra.trim() : null,
    grabar: !!t.recording?.on,
    grabar_series: t.recording?.on ? t.recording.series : null,
    grabar_nota: t.recording?.on ? t.recording.nota.trim() || null : null,
  }
}

/** Selector de técnica + «¿Cuál?» (si es Otra) + a qué series se aplica + «Pedir grabación». */
export function TechniqueFields({
  value, techniques, onChange,
}: {
  value: TechniqueDraft
  techniques: TrainingTechnique[]
  onChange: (patch: Partial<TechniqueDraft>) => void
}) {
  const selected = techniques.find(t => t.key === value.key)
  return (
    <>
      <label className='block space-y-1'>
        <span className='text-xs text-muted-foreground'>Técnica</span>
        <select
          className='h-9 w-full rounded-md border bg-transparent px-2'
          value={value.key}
          onChange={e => onChange({ key: e.target.value })}
          aria-label='Técnica'
        >
          <option value=''>Ninguna</option>
          {techniques.map(t => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </label>
      {selected && selected.key !== OTHER_TECHNIQUE && <p className='text-xs text-muted-foreground'>{selected.description}</p>}
      {value.key === OTHER_TECHNIQUE && (
        <label className='block space-y-1'>
          <span className='text-xs text-muted-foreground'>¿Cuál?</span>
          <input
            className='h-9 w-full rounded-md border bg-transparent px-2'
            maxLength={120}
            value={value.otra}
            onChange={e => onChange({ otra: e.target.value })}
            placeholder='p. ej. Pausa de 2 s arriba'
          />
        </label>
      )}
      {value.key && (
        <div className='space-y-1'>
          <span className='text-xs text-muted-foreground'>Se aplica a</span>
          <div className='flex gap-1'>
            {(['todas', 'ultima'] as const).map(opt => (
              <Button key={opt} size='sm' variant={value.series === opt ? 'default' : 'outline'} onClick={() => onChange({ series: opt })}>
                {opt === 'todas' ? 'Todas las series' : 'Solo la última serie'}
              </Button>
            ))}
          </div>
        </div>
      )}
      <RecordingFields value={value.recording ?? NO_RECORDING} onChange={recording => onChange({ recording })} />
    </>
  )
}

/** «Pedir grabación»: interruptor, qué series grabar y nota para el cliente. */
export function RecordingFields({ value, onChange }: { value: RecordingDraft; onChange: (r: RecordingDraft) => void }) {
  return (
    <div className='space-y-2 border-t pt-3'>
      <label className='flex items-center gap-2'>
        <Switch checked={value.on} onCheckedChange={c => onChange({ ...value, on: !!c })} aria-label='Pedir grabación' />
        <VideoIcon className='size-3.5 text-rose-500' />
        <span>Pedir grabación</span>
      </label>
      {value.on && (
        <>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>Qué series grabar</span>
            <div className='flex flex-wrap gap-1'>
              {(Object.keys(RECORDING_SERIES_LABELS) as RecordingSeries[]).map(opt => (
                <Button key={opt} size='sm' variant={value.series === opt ? 'default' : 'outline'} onClick={() => onChange({ ...value, series: opt })}>
                  {RECORDING_SERIES_LABELS[opt]}
                </Button>
              ))}
            </div>
          </div>
          <label className='block space-y-1'>
            <span className='text-xs text-muted-foreground'>Nota para el cliente (opcional)</span>
            <input
              className='h-9 w-full rounded-md border bg-transparent px-2'
              maxLength={200}
              value={value.nota}
              onChange={e => onChange({ ...value, nota: e.target.value })}
              placeholder='p. ej. de lado, que se vea la cadera'
            />
          </label>
          <p className='text-xs text-muted-foreground'>El cliente verá un aviso al abrir la sesión y marcará las series que se ha grabado.</p>
        </>
      )}
    </div>
  )
}

/** Aviso ⚡ bajo el nombre del ejercicio, con el nombre de la técnica. */
export function TechniqueBadge({ prescribed }: { prescribed: Prescribed }) {
  const techniques = useTrainingTechniques()
  const t = techniqueFromPrescribed(prescribed)
  if (!t.key) return null
  return (
    <Badge variant='secondary' className='mt-1 gap-1 text-[11px] font-normal'>
      <ZapIcon className='size-3 fill-violet-500 text-violet-500' />
      {techniqueLabel(t.key, t.otra, techniques)}
      {t.series === 'ultima' && <span className='text-muted-foreground'>· última serie</span>}
    </Badge>
  )
}

/** Aviso 🎥 bajo el nombre del ejercicio cuando el coach pide grabarlo. */
export function RecordingBadge({ prescribed }: { prescribed: Prescribed }) {
  const r = recordingFromPrescribed(prescribed)
  if (!r.on) return null
  return (
    <Badge variant='secondary' className='mt-1 gap-1 text-[11px] font-normal' title='Se pide al cliente que se grabe'>
      <VideoIcon className='size-3 text-rose-500' aria-label='Pedir grabación' />
      Grabar
      <span className='text-muted-foreground'>· {recordingSummary(r)}</span>
    </Badge>
  )
}

export default function ExerciseTechniqueDialog({
  exercise, description, onClose, onSave,
}: {
  /** null = cerrado */
  exercise: { title: string; prescribed?: Prescribed } | null
  /** A quién afecta el cambio (p. ej. «Solo para este cliente en esta sesión»). */
  description: string
  onClose: () => void
  /** Guarda en el backend; si lanza, el diálogo sigue abierto. */
  onSave: (technique: TechniqueDraft) => Promise<void>
}) {
  const techniques = useTrainingTechniques()
  const [value, setValue] = useState<TechniqueDraft>(NO_TECHNIQUE)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (exercise) setValue(techniqueFromPrescribed(exercise.prescribed))
  }, [exercise])

  const invalid = value.key === OTHER_TECHNIQUE && !value.otra.trim()

  const save = async () => {
    setSaving(true)
    try {
      await onSave({
        ...value,
        otra: value.otra.trim(),
        ...(value.recording ? { recording: { ...value.recording, nota: value.recording.nota.trim() } } : {}),
      })
      onClose()
    } catch {
      // onSave ya avisa del error; el diálogo se queda abierto para reintentar
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!exercise} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className='max-w-md!'>
        <DialogHeader>
          <DialogTitle>Técnica especial y grabación</DialogTitle>
          <DialogDescription>
            {exercise ? `${exercise.title}. ` : ''}{description} El cliente la verá en la app con su explicación.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-3 text-sm'>
          <TechniqueFields value={value} techniques={techniques} onChange={patch => setValue(v => ({ ...v, ...patch }))} />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={invalid || saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
