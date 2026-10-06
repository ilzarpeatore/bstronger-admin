import { useEffect, useState } from 'react'
import {
  ListIcon,
  Link2Icon,
  RepeatIcon,
  TimerIcon,
  InfinityIcon,
  FlagIcon,
  ActivityIcon,
  FootprintsIcon,
  TrophyIcon,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { DurationInput, IntegerInput, DistanceInput } from '@/components/coaching/DurationInput'
import {
  BLOCK_KINDS,
  BLOCK_KIND_LABELS,
  TABATA_PARAMS,
  cleanParams,
  normalizeKind,
  paramsForKindChange,
  type BlockKind,
  type BlockParams,
} from '@/lib/blockKinds'
import { cn } from '@/lib/utils'

export const BLOCK_KIND_ICONS: Record<BlockKind, LucideIcon> = {
  normal: ListIcon,
  superserie: Link2Icon,
  circuito: RepeatIcon,
  emom: TimerIcon,
  amrap: InfinityIcon,
  for_time: FlagIcon,
  intervalos: ActivityIcon,
  carrera: FootprintsIcon,
}

/** Selector de tipo de bloque (cabecera del bloque). Al cambiar de tipo se ponen sus parámetros por defecto. */
export function BlockKindSelect({
  kind,
  params,
  onChange,
  disabled,
}: {
  kind: string | null | undefined
  params: BlockParams | null | undefined
  onChange: (kind: BlockKind, params: BlockParams | null) => void
  disabled?: boolean
}) {
  const current = normalizeKind(kind)
  const Icon = BLOCK_KIND_ICONS[current]
  return (
    <Select
      value={current}
      disabled={disabled}
      onValueChange={v => {
        const next = normalizeKind(v as string | null)
        if (next !== current) onChange(next, paramsForKindChange(next, params))
      }}
    >
      <SelectTrigger size='sm' className='h-6 gap-1 px-1.5 text-[11px]' aria-label='Tipo de bloque' title='Tipo de bloque'>
        <Icon className='size-3' />
        <span>{BLOCK_KIND_LABELS[current]}</span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align='end'>
        {BLOCK_KINDS.map(k => {
          const KIcon = BLOCK_KIND_ICONS[k]
          return (
            <SelectItem key={k} value={k} className='text-xs'>
              <KIcon className='size-3.5' /> {BLOCK_KIND_LABELS[k]}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-0.5', className)}>
      <span className='text-[10px] uppercase tracking-wider text-muted-foreground'>{label}</span>
      {children}
    </label>
  )
}

/**
 * Campos de `params` según el tipo (EMOM «cada [1:00] durante [12]», AMRAP
 * «[20:00]», For Time «[3] rondas, límite [25:00]», Intervalos «[20 s] /
 * [10 s] × [8]» + Tabata, Carrera...) y el benchmark opcional. Cada campo se
 * guarda al salir de él con los params completos (limpios de vacíos).
 */
export function BlockParamsEditor({
  kind,
  params,
  onChange,
  disabled,
}: {
  kind: string | null | undefined
  params: BlockParams | null | undefined
  onChange: (kind: BlockKind, params: BlockParams | null) => void
  disabled?: boolean
}) {
  const k = normalizeKind(kind)
  const p: BlockParams = params ?? {}
  const set = (patch: Partial<BlockParams>) => onChange(k, cleanParams({ ...p, ...patch }))
  const num = (v: number | null) => v ?? undefined

  const [benchmark, setBenchmark] = useState(p.benchmark_key ?? '')
  useEffect(() => { setBenchmark(p.benchmark_key ?? '') }, [p.benchmark_key])
  const commitBenchmark = () => {
    const v = benchmark.trim().toLowerCase().replace(/\s+/g, '_')
    setBenchmark(v)
    if (v !== (p.benchmark_key ?? '')) set({ benchmark_key: v || undefined })
  }

  if (k === 'normal') return null

  const w = 'w-20'
  return (
    <div className='flex flex-wrap items-end gap-x-3 gap-y-2'>
      {(k === 'superserie' || k === 'circuito') && (
        <>
          <Field label='Rondas'><IntegerInput className={w} value={p.rounds} onCommit={v => set({ rounds: num(v) })} disabled={disabled} aria-label='Rondas' /></Field>
          {k === 'circuito' && (
            <Field label='Desc. entre ejercicios'><DurationInput className={w} value={p.rest_between_exercises_sec} onCommit={v => set({ rest_between_exercises_sec: num(v) })} disabled={disabled} aria-label='Descanso entre ejercicios' /></Field>
          )}
          <Field label='Desc. tras ronda'><DurationInput className={w} value={p.rest_after_round_sec} onCommit={v => set({ rest_after_round_sec: num(v) })} disabled={disabled} aria-label='Descanso tras ronda' /></Field>
        </>
      )}

      {k === 'emom' && (
        <>
          <Field label='Cada'><DurationInput className={w} value={p.interval_sec} onCommit={v => set({ interval_sec: num(v) })} disabled={disabled} aria-label='Intervalo' /></Field>
          <Field label='Rondas'><IntegerInput className={w} value={p.rounds} onCommit={v => set({ rounds: num(v) })} disabled={disabled} aria-label='Rondas' /></Field>
        </>
      )}

      {k === 'amrap' && (
        <Field label='Duración'><DurationInput className={w} bareUnit='min' value={p.duration_sec} onCommit={v => set({ duration_sec: num(v) })} disabled={disabled} aria-label='Duración' /></Field>
      )}

      {k === 'for_time' && (
        <>
          <Field label='Rondas'><IntegerInput className={w} value={p.rounds} onCommit={v => set({ rounds: num(v) })} disabled={disabled} aria-label='Rondas' /></Field>
          <Field label='Límite'><DurationInput className={w} bareUnit='min' value={p.time_cap_sec} onCommit={v => set({ time_cap_sec: num(v) })} disabled={disabled} placeholder='Sin límite' aria-label='Límite de tiempo' /></Field>
        </>
      )}

      {k === 'intervalos' && (
        <>
          <Field label='Trabajo'><DurationInput className={w} value={p.work_sec} onCommit={v => set({ work_sec: num(v) })} disabled={disabled} aria-label='Trabajo' /></Field>
          <Field label='Descanso'><DurationInput className={w} value={p.rest_sec} onCommit={v => set({ rest_sec: num(v) })} disabled={disabled} aria-label='Descanso' /></Field>
          <Field label='Rondas'><IntegerInput className={w} value={p.rounds} onCommit={v => set({ rounds: num(v) })} disabled={disabled} aria-label='Rondas' /></Field>
          <Field label='Series'><IntegerInput className={w} value={p.sets} onCommit={v => set({ sets: num(v) })} disabled={disabled} placeholder='1' aria-label='Series' /></Field>
          {(p.sets ?? 1) > 1 && (
            <Field label='Desc. entre series'><DurationInput className={w} value={p.rest_between_sets_sec} onCommit={v => set({ rest_between_sets_sec: num(v) })} disabled={disabled} aria-label='Descanso entre series' /></Field>
          )}
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-7 text-[11px]'
            disabled={disabled}
            onClick={() => set({ ...TABATA_PARAMS, sets: undefined, rest_between_sets_sec: undefined })}
            title='20 s trabajo / 10 s descanso × 8'
          >
            Tabata
          </Button>
        </>
      )}

      {k === 'carrera' && (
        <>
          <Field label='Modo'>
            <div className='flex h-7 overflow-hidden rounded-md border border-input text-[11px]'>
              {(['continua', 'intervalos'] as const).map(m => (
                <button
                  key={m}
                  type='button'
                  disabled={disabled}
                  onClick={() => set({ mode: m })}
                  className={cn('px-2 capitalize transition-colors disabled:opacity-60', (p.mode ?? 'continua') === m ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>
          {p.mode === 'intervalos' && (
            <Field label='Repeticiones'><IntegerInput className={w} value={p.reps} onCommit={v => set({ reps: num(v) })} disabled={disabled} aria-label='Repeticiones' /></Field>
          )}
          <Field label={p.mode === 'intervalos' ? 'Distancia rep.' : 'Distancia'}><DistanceInput className={w} value={p.target_distance_m} onCommit={v => set({ target_distance_m: num(v) })} disabled={disabled} aria-label='Distancia objetivo' /></Field>
          <Field label={p.mode === 'intervalos' ? 'Tiempo rep.' : 'Tiempo'}><DurationInput className={w} value={p.target_time_sec} onCommit={v => set({ target_time_sec: num(v) })} disabled={disabled} aria-label='Tiempo objetivo' /></Field>
          <Field label='Ritmo /km'><DurationInput className={w} value={p.target_pace_sec_km} onCommit={v => set({ target_pace_sec_km: num(v) })} disabled={disabled} placeholder='m:ss' aria-label='Ritmo objetivo por km' /></Field>
          {p.mode === 'intervalos' && (
            <Field label='Recuperación'><DurationInput className={w} value={p.recovery_sec} onCommit={v => set({ recovery_sec: num(v) })} disabled={disabled} aria-label='Recuperación' /></Field>
          )}
        </>
      )}

      <Field label='Benchmark (opcional)' className='min-w-32'>
        <div className='relative'>
          <TrophyIcon className='absolute left-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground' />
          <Input
            className='h-7 w-40 pl-5 text-xs'
            value={benchmark}
            placeholder='p. ej. row_1000'
            disabled={disabled}
            aria-label='Clave de benchmark'
            onChange={e => setBenchmark(e.target.value)}
            onBlur={commitBenchmark}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        </div>
      </Field>
    </div>
  )
}
