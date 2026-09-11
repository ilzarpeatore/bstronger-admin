import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { ExceptionItem, ExceptionStatusVal } from '@/lib/coachExceptions'

// Lógica de datos/acciones del Panel de Excepciones del Coach, compartida
// entre la tarjeta del dashboard general (todos los coaches/clientes) y la
// tarjeta del resumen de cliente (un client_id fijo) -- ver
// docs/Plan_Cierre_Motor_UI.md, Fase 2. Ninguna de las dos pasa coach_id:
// el endpoint admin ya soporta listar de todos los coaches a la vez.

type UseCoachExceptionsParams = {
  clientId?: string | number
  coachId?: string | number
  status?: ExceptionStatusVal | 'all'
  category?: string
}

export function useCoachExceptions({ clientId, coachId, status = 'pendiente', category }: UseCoachExceptionsParams) {
  const [items, setItems] = useState<ExceptionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actingOn, setActingOn] = useState<number | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status })
      if (coachId) params.set('coach_id', String(coachId))
      if (clientId) params.set('client_id', String(clientId))
      if (category && category !== 'all') params.set('category', category)
      const res = await api.get(`/admin/coach-exceptions?${params.toString()}`)
      setItems(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar el panel de excepciones')
    } finally {
      setLoading(false)
    }
  }, [clientId, coachId, status, category])

  useEffect(() => { fetchItems() }, [fetchItems])

  const runAction = useCallback(async (itemId: number, fn: () => Promise<any>, successMsg: string) => {
    setActingOn(itemId)
    try {
      await fn()
      toast.success(successMsg)
      await fetchItems()
      return true
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar')
      return false
    } finally {
      setActingOn(null)
    }
  }, [fetchItems])

  const resolve = useCallback((item: ExceptionItem) =>
    runAction(item.id, () => api.post(`/admin/coach-exceptions/${item.id}/resolve`, {}), 'Marcado como resuelto'),
  [runAction])

  const dismiss = useCallback((item: ExceptionItem) =>
    runAction(item.id, () => api.post(`/admin/coach-exceptions/${item.id}/dismiss`, {}), 'Descartado'),
  [runAction])

  const approveSuggestion = useCallback((item: ExceptionItem, targetId: number) =>
    runAction(item.id, () => api.post(`/admin/session-progression/suggestions/${targetId}/approve`, {}), 'Sugerencia aprobada'),
  [runAction])

  const editSuggestion = useCallback((item: ExceptionItem, targetId: number, payload: { proposed_weight?: number; proposed_reps?: number; motivo?: string }) =>
    runAction(item.id, () => api.post(`/admin/session-progression/suggestions/${targetId}/edit`, payload), 'Sugerencia editada y aplicada'),
  [runAction])

  const rejectSuggestion = useCallback((item: ExceptionItem, targetId: number, motivo?: string) =>
    runAction(item.id, () => api.post(`/admin/session-progression/suggestions/${targetId}/reject`, motivo ? { motivo } : {}), 'Sugerencia rechazada'),
  [runAction])

  const approveAdaptiveWeek = useCallback((item: ExceptionItem, planId: number) =>
    runAction(item.id, () => api.post(`/admin/adaptive-week-plans/${planId}/approve`, {}), 'Semana adaptativa aprobada'),
  [runAction])

  const rejectAdaptiveWeek = useCallback((item: ExceptionItem, planId: number, motivo?: string) =>
    runAction(item.id, () => api.post(`/admin/adaptive-week-plans/${planId}/reject`, motivo ? { motivo } : {}), 'Semana adaptativa rechazada'),
  [runAction])

  return {
    items,
    loading,
    actingOn,
    fetchItems,
    resolve,
    dismiss,
    approveSuggestion,
    editSuggestion,
    rejectSuggestion,
    approveAdaptiveWeek,
    rejectAdaptiveWeek,
  }
}
