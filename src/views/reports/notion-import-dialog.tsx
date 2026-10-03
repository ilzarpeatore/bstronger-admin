import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NOTION_PAYMENTS_YEAR, notionPayments2026 } from '@/api/subscription-payments/notion-payments-2026'
import type { ClientPaymentRow, SubscriptionPaymentsPayload } from '@/types/apps/subscription-payments'
import { bestNameMatch, clientKey, monthPaymentUrl } from './payment-client-utils'

const NEW_CLIENT = '__new__'
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

// Aplica las mensualidades de Notion (año NOTION_PAYMENTS_YEAR). Cada nombre
// se empareja con un cliente del panel (usuario o externo) por nombre
// aproximado (ver nameScore: "Hamza Bilbao" → "Hamsa Dris Bakkali"); si no
// hay coincidencia, se puede elegir uno a mano o crearlo como cliente externo.
// Los meses que ya están pagados con el mismo importe se saltan, así que
// repetir la importación no duplica nada.
export default function NotionImportDialog({ open, onOpenChange, onImported }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (year: number, applied: number) => void
}) {
  const year = NOTION_PAYMENTS_YEAR
  const [clients, setClients] = useState<ClientPaymentRow[] | null>(null)
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setClients(null)
    setError(null)
    setProgress(null)
    api.get(`/admin/subscription-payments?year=${year}`).then((res) => {
      const list: ClientPaymentRow[] = (res.data as SubscriptionPaymentsPayload)?.clients ?? []
      setClients(list)
      setTargets(Object.fromEntries(notionPayments2026.map((n) => {
        const match = bestNameMatch(n.name, list)
        return [n.name, match ? clientKey(match) : NEW_CLIENT]
      })))
    }).catch(() => setError('No se pudieron cargar los clientes del panel.'))
  }, [open, year])

  const clientsByKey = useMemo(() => new Map((clients ?? []).map((c) => [clientKey(c), c])), [clients])
  const newCount = Object.values(targets).filter((t) => t === NEW_CLIENT).length
  const paymentsCount = notionPayments2026.reduce((sum, n) => sum + Object.keys(n.months).length, 0)

  const handleImport = async () => {
    setRunning(true)
    setError(null)
    let applied = 0
    let currentName = ''
    try {
      for (const row of notionPayments2026) {
        currentName = row.name
        setProgress(row.name)
        let client = clientsByKey.get(targets[row.name])
        if (!client) {
          const res = await api.post('/admin/subscription-payments/external', {
            name: row.name,
            email: null,
            monthly_fee: row.monthly_fee,
            notes: 'Importado de Notion',
          })
          client = { ...res.data, source: 'external', months: {} } as ClientPaymentRow
        }
        for (const [monthStr, amount] of Object.entries(row.months)) {
          const month = Number(monthStr)
          const current = client.months[month]
          if (amount == null || (current?.paid && current.amount === amount)) continue
          await api.put(monthPaymentUrl(client, year, month), {
            paid: true,
            amount,
            paid_at: current?.paid_at ?? `${year}-${String(month).padStart(2, '0')}-01`,
          })
          applied++
        }
      }
      onImported(year, applied)
      onOpenChange(false)
    } catch (e) {
      setError(`Error importando ${currentName}: ${e instanceof Error ? e.message : 'error desconocido'}. Puedes volver a lanzarlo; lo ya aplicado no se duplica.`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="sm:max-w-3xl!">
        <DialogHeader>
          <DialogTitle>Importar mensualidades de Notion ({year})</DialogTitle>
          <DialogDescription>
            {notionPayments2026.length} clientes y {paymentsCount} pagos de la base «Be Stronger 2026». Revisa a qué cliente del panel va cada fila; los que no existan se crearán como clientes no registrados.
          </DialogDescription>
        </DialogHeader>

        {!clients && !error ? (
          <div className="h-40 bg-muted/50 animate-pulse flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Cargando clientes...</span>
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-auto border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Notion</th>
                  <th className="px-3 py-2 text-left font-medium">Pagos</th>
                  <th className="px-3 py-2 text-left font-medium">Cliente en el panel</th>
                </tr>
              </thead>
              <tbody>
                {notionPayments2026.map((row) => {
                  const months = Object.entries(row.months)
                  return (
                    <tr key={row.name} className="border-t border-border/50 align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">Tarifa {currency.format(row.monthly_fee)}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {months.length
                          ? months.map(([m, amount]) => `${MONTHS_SHORT[Number(m) - 1]} ${currency.format(amount ?? 0)}`).join(' · ')
                          : 'Sin pagos'}
                      </td>
                      <td className="px-3 py-2 min-w-[220px]">
                        <Select
                          value={targets[row.name] ?? NEW_CLIENT}
                          onValueChange={(v) => v && setTargets((prev) => ({ ...prev, [row.name]: v }))}
                          disabled={running}
                        >
                          <SelectTrigger className="w-full cursor-pointer">
                            <SelectValue>
                              {(value: string) => value === NEW_CLIENT
                                ? <Badge variant="outline">Nuevo · no registrado</Badge>
                                : clientsByKey.get(value)?.name ?? value}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NEW_CLIENT}>Crear como cliente no registrado</SelectItem>
                            {(clients ?? []).map((c) => (
                              <SelectItem key={clientKey(c)} value={clientKey(c)}>
                                {c.name}{c.source === 'external' ? ' (no registrado)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {running && progress && <p className="text-xs text-muted-foreground">Importando {progress}...</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running} className="cursor-pointer">Cancelar</Button>
          <Button onClick={handleImport} disabled={running || !clients} className="cursor-pointer">
            {running ? 'Importando...' : `Aplicar importes${newCount ? ` (${newCount} nuevos)` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
