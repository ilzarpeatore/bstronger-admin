import { useCallback, useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { RetentionRiskConfig } from '@/lib/retentionRisk'

// Configuración por coach del Score de Riesgo de Abandono -- pesos de los 4
// componentes, toggle de reenganche automático, y el texto de los 3
// mensajes de reenganche (petición del usuario: quiere poder cambiarlo sin
// tocar código). Guarda en 2 llamadas (pesos / resto) porque son 2
// endpoints self-service distintos que este diálogo espeja vía /admin --
// ver docblock de RetentionRiskController.

type RetentionRiskSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  coachId: string | number | null
}

type WeightField = 'w1' | 'w2' | 'w3' | 'w4'
type MessageField = 'msg_dia_7' | 'msg_dia_14' | 'msg_dia_20'

const WEIGHT_LABELS: Record<WeightField, string> = {
  w1: 'Días sin entrenar', w2: 'Caída de cumplimiento', w3: 'Sin logros recientes', w4: 'Molestias recurrentes',
}

const MESSAGE_LABELS: Record<MessageField, string> = {
  msg_dia_7: 'Día 7', msg_dia_14: 'Día 14', msg_dia_20: 'Día 20',
}

export default function RetentionRiskSettingsDialog({ open, onOpenChange, coachId }: RetentionRiskSettingsDialogProps) {
  const [config, setConfig] = useState<RetentionRiskConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [weights, setWeights] = useState<Record<WeightField, string>>({ w1: '', w2: '', w3: '', w4: '' })
  const [autoReengagement, setAutoReengagement] = useState(true)
  const [messages, setMessages] = useState<Record<MessageField, string>>({ msg_dia_7: '', msg_dia_14: '', msg_dia_20: '' })

  const fetchConfig = useCallback(async () => {
    if (!coachId) return
    setLoading(true)
    try {
      const res = await api.get(`/admin/retention-risk-config?coach_id=${coachId}`)
      const c: RetentionRiskConfig = res.data
      setConfig(c)
      setWeights({
        w1: String(c.w1 ?? c.defaults.w1),
        w2: String(c.w2 ?? c.defaults.w2),
        w3: String(c.w3 ?? c.defaults.w3),
        w4: String(c.w4 ?? c.defaults.w4),
      })
      setAutoReengagement(c.auto_reengagement_enabled)
      setMessages({ msg_dia_7: c.msg_dia_7 || '', msg_dia_14: c.msg_dia_14 || '', msg_dia_20: c.msg_dia_20 || '' })
    } catch {
      toast.error('Error al cargar la configuración')
    } finally {
      setLoading(false)
    }
  }, [coachId])

  useEffect(() => { if (open) fetchConfig() }, [open, fetchConfig])

  const weightSum = (['w1', 'w2', 'w3', 'w4'] as WeightField[]).reduce((sum, k) => sum + (parseFloat(weights[k]) || 0), 0)

  const handleSave = async () => {
    if (!coachId) return
    setSaving(true)
    try {
      await api.put('/admin/retention-risk-weights', {
        coach_id: coachId,
        w1: parseFloat(weights.w1) || 0,
        w2: parseFloat(weights.w2) || 0,
        w3: parseFloat(weights.w3) || 0,
        w4: parseFloat(weights.w4) || 0,
      })
      await api.put('/admin/retention-risk-settings', {
        coach_id: coachId,
        auto_reengagement_enabled: autoReengagement,
        msg_dia_7: messages.msg_dia_7,
        msg_dia_14: messages.msg_dia_14,
        msg_dia_20: messages.msg_dia_20,
      })
      toast.success('Configuración guardada')
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg max-h-[85vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Configurar riesgo de abandono</DialogTitle>
          <DialogDescription>Pesos de las 4 señales, reenganche automático y el texto que le llega al cliente.</DialogDescription>
        </DialogHeader>

        {loading || !config ? (
          <div className='flex justify-center py-10'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
        ) : (
          <div className='space-y-6'>
            <div className='space-y-2.5'>
              <div className='flex items-center justify-between'>
                <p className='text-sm font-medium'>Pesos de cada señal</p>
                <span className={`text-xs ${Math.abs(weightSum - 1) > 0.01 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  Suma: {weightSum.toFixed(2)}{Math.abs(weightSum - 1) > 0.01 ? ' — se normaliza al guardar' : ''}
                </span>
              </div>
              {(['w1', 'w2', 'w3', 'w4'] as WeightField[]).map(k => (
                <div key={k} className='flex items-center gap-3'>
                  <Label className='text-xs w-44 shrink-0'>{WEIGHT_LABELS[k]}</Label>
                  <Input
                    type='number' min={0} max={1} step={0.05}
                    value={weights[k]}
                    onChange={e => setWeights(w => ({ ...w, [k]: e.target.value }))}
                    className='h-8 text-sm'
                  />
                </div>
              ))}
              <p className='text-[11px] text-muted-foreground'>Valores por defecto: {config.defaults.w1} / {config.defaults.w2} / {config.defaults.w3} / {config.defaults.w4}.</p>
            </div>

            <div className='flex items-center justify-between rounded-md border p-3'>
              <div>
                <p className='text-sm font-medium'>Reenganche automático al cliente</p>
                <p className='text-xs text-muted-foreground'>Si lo desactivas, el score y el Panel de Excepciones siguen funcionando igual — solo se deja de avisar al cliente.</p>
              </div>
              <Switch checked={autoReengagement} onCheckedChange={setAutoReengagement} />
            </div>

            <div className='space-y-3'>
              <p className='text-sm font-medium'>Mensajes de reenganche</p>
              {(['msg_dia_7', 'msg_dia_14', 'msg_dia_20'] as MessageField[]).map(k => (
                <div key={k} className='space-y-1'>
                  <div className='flex items-center justify-between'>
                    <Label className='text-xs'>{MESSAGE_LABELS[k]}</Label>
                    {messages[k] && (
                      <button
                        type='button'
                        className='text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1'
                        onClick={() => setMessages(m => ({ ...m, [k]: '' }))}
                      >
                        <RotateCcw className='size-2.5' /> Restablecer por defecto
                      </button>
                    )}
                  </div>
                  <Textarea
                    value={messages[k]}
                    onChange={e => setMessages(m => ({ ...m, [k]: e.target.value }))}
                    placeholder={config.defaults[k]}
                    rows={2}
                    maxLength={500}
                    className='text-sm resize-none'
                  />
                </div>
              ))}
              <p className='text-[11px] text-muted-foreground'>Vacío = se usa el texto por defecto (el que ves como placeholder). Se envían por push — si tu cuenta OneSignal no está configurada, se registran pero no llegan al móvil todavía.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
