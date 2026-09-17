import { useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

// Lógica común de los flujos de asignación de entrenamiento/programa a un
// cliente, compartida entre ClientCalendarView.tsx y UserDetailView.tsx --
// ver docs/PLAN_CLONADO_PROGRAMAS.md §1.5 y §3 Fase 8. Antes de este hook
// ambas vistas reimplementaban por separado la misma llamada a los mismos
// dos endpoints (`client-calendar-assign-direct` y
// `client-calendar-import-program`), con manejo de éxito/error equivalente
// pero ligeramente distinto (mensajes de toast, extracción de errores). Este
// hook unifica esa lógica; los mensajes por defecto reproducen los que ya
// usaba ClientCalendarView, y cada caller puede pasar los suyos propios
// (successMessage/errorMessage) para no cambiar el texto que el usuario ya
// veía en cada vista.
//
// Nota (no bloqueante, pendiente de backend): estos endpoints hoy asignan
// sin clonar -- ver §1.2 del plan. Cuando el backend empiece a clonar
// (Fase 2-7 del plan), este hook seguirá funcionando sin cambios (mismos
// endpoints/parámetros); solo si en el futuro se quisiera exponer
// `source_training_program_id` en la respuesta para mostrar "basado en: X"
// habría que tocar este hook -- fuera del alcance de esta tarea.

type AssignDirectParams = {
  clientId: number
  date: string
  workoutTemplateId: number
  successMessage?: string
  errorMessage?: string
}

type ImportProgramParams = {
  clientId: number
  trainingProgramId: number
  startDate: string
  successMessage?: string
  errorMessage?: string
}

function extractErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.message || err?.message || fallback
}

export function useProgramAssignment() {
  const assignDirect = useCallback(async ({
    clientId,
    date,
    workoutTemplateId,
    successMessage = 'Entrenamiento asignado',
    errorMessage = 'Error al asignar',
  }: AssignDirectParams): Promise<boolean> => {
    try {
      await api.post('/admin/client-calendar-assign-direct', {
        client_id: clientId,
        date,
        workout_template_id: workoutTemplateId,
      })
      toast.success(successMessage)
      return true
    } catch (err: any) {
      toast.error(extractErrorMessage(err, errorMessage))
      return false
    }
  }, [])

  const importProgram = useCallback(async ({
    clientId,
    trainingProgramId,
    startDate,
    successMessage = 'Programa importado correctamente',
    errorMessage = 'Error al importar el programa',
  }: ImportProgramParams): Promise<boolean> => {
    try {
      await api.post('/admin/client-calendar-import-program', {
        client_id: clientId,
        training_program_id: trainingProgramId,
        start_date: startDate,
      })
      toast.success(successMessage)
      return true
    } catch (err: any) {
      toast.error(extractErrorMessage(err, errorMessage))
      return false
    }
  }, [])

  return { assignDirect, importProgram }
}
