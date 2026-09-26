import { useCallback, useEffect, useState } from 'react'
import { AlertTriangleIcon, Loader2Icon, UserCheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

// Entrenador asignado al cliente (ítem 49 del roadmap). Vive en la ficha del cliente
// (/users/:id), visible en todas las pestañas. Sin entrenador el motor de progresión no
// aplica ninguna regla y los avisos "al coach del cliente" (dolor, sesiones sin registrar...)
// no llegan a nadie, así que se avisa en ámbar. Solo un administrador puede reasignar:
// el backend responde 403 al resto y aquí se enseña el motivo.

interface StaffOption {
  id: number
  name: string
  user_type: string
}

interface CoachPayload {
  client_id: number
  coach: StaffOption | null
  options: StaffOption[]
}

const NONE = ''

function unwrap(res: any): CoachPayload {
  return (res?.data?.data ?? res?.data ?? res) as CoachPayload
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiError && e.message) return e.message
  return 'No se pudo asignar el entrenador'
}

export default function ClientCoachSelector({ userId }: { userId: string | number }) {
  const [payload, setPayload] = useState<CoachPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      setPayload(unwrap(await api.get(`/admin/users/${userId}/coach`)))
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const change = async (value: string) => {
    if (!payload) return
    const coachId = value === NONE ? null : Number(value)
    if ((payload.coach?.id ?? null) === coachId) return
    setSaving(true)
    try {
      const next = unwrap(await api.put(`/admin/users/${userId}/coach`, { coach_id: coachId }))
      setPayload(next)
      toast.success(next.coach ? `Entrenador asignado: ${next.coach.name}` : 'Entrenador quitado')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground'>
        <Loader2Icon className='size-4 animate-spin' /> Cargando entrenador…
      </div>
    )
  }

  if (failed || !payload) {
    return (
      <div className='flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground'>
        <span>No se pudo cargar el entrenador asignado.</span>
        <button type='button' onClick={load} className='text-xs font-medium underline underline-offset-2'>
          Reintentar
        </button>
      </div>
    )
  }

  const noCoach = payload.coach === null
  // El entrenador actual puede no estar entre los candidatos (dado de baja): se mantiene visible.
  const options =
    payload.coach && !payload.options.some((o) => o.id === payload.coach!.id)
      ? [payload.coach, ...payload.options]
      : payload.options

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3',
        noCoach ? 'border-amber-500/40 bg-amber-500/10' : 'bg-card',
      )}
    >
      {noCoach ? (
        <AlertTriangleIcon className='size-4 shrink-0 text-amber-600' />
      ) : (
        <UserCheckIcon className='size-4 shrink-0 text-muted-foreground' />
      )}
      <label htmlFor='client-coach-select' className='text-sm font-medium'>
        Entrenador asignado
      </label>
      <select
        id='client-coach-select'
        aria-label='Entrenador asignado'
        value={payload.coach?.id?.toString() ?? NONE}
        disabled={saving}
        onChange={(e) => change(e.target.value)}
        className='h-9 min-w-56 rounded-md border bg-background px-3 text-sm disabled:opacity-60'
      >
        <option value={NONE}>Sin entrenador</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.user_type === 'admin' ? ' (admin)' : ''}
          </option>
        ))}
      </select>
      {saving && <Loader2Icon className='size-4 animate-spin text-muted-foreground' />}
      {noCoach && (
        <p className='basis-full text-xs text-muted-foreground'>
          Sin entrenador, el motor de progresión no aplica reglas a este cliente y los avisos (dolor, sesiones sin
          registrar…) no llegan a nadie.
        </p>
      )}
    </div>
  )
}
