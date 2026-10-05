import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatDuration, parseDistance, parseDuration } from '@/lib/blockKinds'

type BaseProps = {
  className?: string
  placeholder?: string
  disabled?: boolean
  'aria-label'?: string
}

/**
 * Campo de tiempo en mm:ss (o h:mm:ss) que guarda segundos enteros
 * (input_type `time` del catálogo y todos los tiempos de `params`).
 * `bareUnit` decide cómo se lee un número sin unidad: "20" son 20 s o 20 min.
 * Se guarda al salir del campo; un texto no válido vuelve al valor anterior.
 */
export function DurationInput({
  value,
  onCommit,
  bareUnit = 'sec',
  ...rest
}: BaseProps & {
  value: number | null | undefined
  onCommit: (seconds: number | null) => void
  bareUnit?: 'sec' | 'min'
}) {
  const formatted = value === null || value === undefined ? '' : formatDuration(value)
  const [text, setText] = useState(formatted)
  useEffect(() => { setText(formatted) }, [formatted])

  const commit = () => {
    if (!text.trim()) {
      if (value !== null && value !== undefined) onCommit(null)
      return
    }
    const parsed = parseDuration(text, bareUnit)
    if (parsed === null) { setText(formatted); return }
    setText(formatDuration(parsed))
    if (parsed !== value) onCommit(parsed)
  }

  return (
    <Input
      inputMode='numeric'
      className={cn('h-7 text-center text-xs px-1 tabular-nums', rest.className)}
      value={text}
      placeholder={rest.placeholder ?? 'mm:ss'}
      disabled={rest.disabled}
      aria-label={rest['aria-label']}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

/** Entero positivo (rondas, reps...). Vacío = null. */
export function IntegerInput({
  value,
  onCommit,
  min = 1,
  ...rest
}: BaseProps & { value: number | null | undefined; onCommit: (n: number | null) => void; min?: number }) {
  const formatted = value === null || value === undefined ? '' : String(value)
  const [text, setText] = useState(formatted)
  useEffect(() => { setText(formatted) }, [formatted])

  const commit = () => {
    const t = text.trim()
    if (!t) { if (value !== null && value !== undefined) onCommit(null); return }
    const n = /^\d+$/.test(t) ? parseInt(t, 10) : NaN
    if (!Number.isFinite(n) || n < min) { setText(formatted); return }
    if (n !== value) onCommit(n)
  }

  return (
    <Input
      inputMode='numeric'
      className={cn('h-7 text-center text-xs px-1 tabular-nums', rest.className)}
      value={text}
      placeholder={rest.placeholder}
      disabled={rest.disabled}
      aria-label={rest['aria-label']}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

/** Distancia en metros; acepta "800", "800 m" o "5 km". */
export function DistanceInput({
  value,
  onCommit,
  ...rest
}: BaseProps & { value: number | null | undefined; onCommit: (meters: number | null) => void }) {
  const formatted = value === null || value === undefined ? '' : String(value)
  const [text, setText] = useState(formatted)
  useEffect(() => { setText(formatted) }, [formatted])

  const commit = () => {
    if (!text.trim()) { if (value !== null && value !== undefined) onCommit(null); return }
    const parsed = parseDistance(text)
    if (parsed === null || parsed <= 0) { setText(formatted); return }
    setText(String(parsed))
    if (parsed !== value) onCommit(parsed)
  }

  return (
    <div className='relative'>
      <Input
        inputMode='decimal'
        className={cn('h-7 text-center text-xs pl-1 pr-5 tabular-nums', rest.className)}
        value={text}
        placeholder={rest.placeholder}
        disabled={rest.disabled}
        aria-label={rest['aria-label']}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
      <span className='pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground'>m</span>
    </div>
  )
}

/**
 * Variante para un valor de `prescribed` (texto libre): muestra mm:ss si lo
 * guardado son segundos y guarda segundos al salir. Si el coach escribe algo
 * que no es un tiempo («máx», «hasta fallo») se guarda tal cual, como hasta ahora.
 */
export function PrescribedDurationInput({
  value,
  onCommit,
  ...rest
}: BaseProps & { value: string; onCommit: (value: string) => void }) {
  const display = /^\d+$/.test(value.trim()) ? formatDuration(Number(value.trim())) : value
  const [text, setText] = useState(display)
  useEffect(() => { setText(display) }, [display])

  const commit = () => {
    const parsed = parseDuration(text)
    const next = parsed !== null ? String(parsed) : text.trim()
    if (parsed !== null) setText(formatDuration(parsed))
    if (next !== value.trim()) onCommit(next)
  }

  return (
    <Input
      className={cn('h-7 text-center text-xs px-1 tabular-nums', rest.className)}
      value={text}
      placeholder={rest.placeholder ?? 'mm:ss'}
      disabled={rest.disabled}
      aria-label={rest['aria-label']}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

/** Igual para distancia en `prescribed`: "5 km" se guarda como "5000". */
export function PrescribedDistanceInput({
  value,
  onCommit,
  ...rest
}: BaseProps & { value: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])

  const commit = () => {
    const parsed = parseDistance(text)
    const next = parsed !== null ? String(parsed) : text.trim()
    setText(next)
    if (next !== value.trim()) onCommit(next)
  }

  return (
    <div className='relative'>
      <Input
        className={cn('h-7 text-center text-xs pl-1 pr-5 tabular-nums', rest.className)}
        value={text}
        placeholder={rest.placeholder}
        disabled={rest.disabled}
        aria-label={rest['aria-label']}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
      <span className='pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground'>m</span>
    </div>
  )
}
