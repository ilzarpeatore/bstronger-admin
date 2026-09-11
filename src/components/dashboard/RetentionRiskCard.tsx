import { useCallback, useEffect, useState } from 'react'
import { UserX } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { BAND_META, DOMINANT_LABELS, formatPct, type RetentionRiskHistory } from '@/lib/retentionRisk'

// Ficha de cliente -- muestra el score de riesgo de abandono actual y su
// evolución (docs/Score_Riesgo_Abandono_Implementacion.md). Espejo de
// CoachExceptionsCard en cuanto a dónde vive (Resumen del cliente), pero
// esto es un dato calculado de solo lectura, no una bandeja con acciones.
type RetentionRiskCardProps = {
  clientId: string | number
}

export default function RetentionRiskCard({ clientId }: RetentionRiskCardProps) {
  const [data, setData] = useState<RetentionRiskHistory | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/retention-risk-history?client_id=${clientId}`)
      setData(res.data || null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const current = data?.current
  const meta = current ? BAND_META[current.band] : null
  const chartData = (data?.history || []).map(h => ({ date: h.date, score: h.combined_score ?? 0 }))

  return (
    <Card>
      <CardHeader className='pb-2 flex flex-row items-center justify-between space-y-0'>
        <CardTitle className='text-sm flex items-center gap-2'><UserX className='size-4' /> Riesgo de abandono</CardTitle>
        {meta && <Badge variant={meta.badgeVariant}>{meta.label}</Badge>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className='flex justify-center py-6'><div className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
        ) : !current ? (
          <p className='text-center text-muted-foreground text-xs py-3'>
            Sin cálculo todavía — cliente free, recién dado de alta, o el job diario aún no ha corrido.
          </p>
        ) : (
          <div className='space-y-3'>
            <div className='grid grid-cols-2 gap-2 text-xs'>
              <div><span className='text-muted-foreground'>Score</span><p className='font-medium'>{formatPct(current.combined_score)}</p></div>
              <div><span className='text-muted-foreground'>Días sin entrenar</span><p className='font-medium'>{current.dias_inactividad ?? '—'}</p></div>
              <div><span className='text-muted-foreground'>Cumplimiento</span><p className='font-medium'>{current.compliance_actual != null ? `${current.compliance_actual}%` : '—'}{current.compliance_anterior != null ? ` (antes ${current.compliance_anterior}%)` : ''}</p></div>
              <div><span className='text-muted-foreground'>Sin logro hace</span><p className='font-medium'>{current.dias_desde_ultimo_logro != null ? `${current.dias_desde_ultimo_logro}d` : '—'}</p></div>
            </div>
            {current.dominant_component && (
              <p className='text-[11px] text-muted-foreground'>
                Señal dominante: <span className='font-medium text-foreground'>{DOMINANT_LABELS[current.dominant_component]}</span>
              </p>
            )}
            {chartData.length > 1 && (
              <div style={{ height: 100 }}>
                <ResponsiveContainer width='100%' height='100%'>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey='date' tick={{ fontSize: 9 }} tickFormatter={v => new Date(String(v)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 9 }} tickFormatter={v => `${Math.round(Number(v) * 100)}%`} />
                    <Tooltip formatter={(v: any) => [`${Math.round(Number(v) * 100)}%`, 'Score']} labelFormatter={v => new Date(String(v)).toLocaleDateString('es-ES')} />
                    <ReferenceLine y={0.6} stroke='#ef4444' strokeDasharray='3 3' strokeOpacity={0.5} />
                    <ReferenceLine y={0.3} stroke='#f59e0b' strokeDasharray='3 3' strokeOpacity={0.5} />
                    <Line type='monotone' dataKey='score' stroke='#d8531c' strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
