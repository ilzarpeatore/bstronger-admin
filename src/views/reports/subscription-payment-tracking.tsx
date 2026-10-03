import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Pencil, TrendingUp, Users2, Wallet, BarChart3, UserPlus, Upload, Trash2, Merge } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverTitle } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CardContent } from '@/components/ui/card'
import { DashboardCard } from '@/components/shared/dashboard-card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { ClientPaymentRow, SubscriptionPaymentsPayload, SubscriptionPaymentsSummary } from '@/types/apps/subscription-payments'
import AddExternalClientDialog from './add-external-client-dialog'
import NotionImportDialog from './notion-import-dialog'
import MergeDuplicatesDialog from './merge-duplicates-dialog'
import { clientKey, clientSource, monthPaymentUrl } from './payment-client-utils'

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

const chartConfig = {
  total: { label: 'Ingresos', color: 'var(--color-primary)' },
} satisfies ChartConfig

export default function SubscriptionPaymentTracking() {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [years, setYears] = useState<number[]>([new Date().getFullYear()])
  const [payload, setPayload] = useState<SubscriptionPaymentsPayload | null>(null)
  const [summary, setSummary] = useState<SubscriptionPaymentsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [openCell, setOpenCell] = useState<string | null>(null)
  const [openTariff, setOpenTariff] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [savingCell, setSavingCell] = useState<string | null>(null)

  useEffect(() => {
    api.get('/admin/subscription-payments/years').then((res) => {
      const list: number[] = res.data || []
      setYears(list.length ? list : [new Date().getFullYear()])
    }).catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, summaryRes] = await Promise.all([
        api.get(`/admin/subscription-payments?year=${year}`),
        api.get(`/admin/subscription-payments/summary?year=${year}`),
      ])
      setPayload(listRes.data)
      setSummary(summaryRes.data)
    } catch {
      setPayload(null)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { fetchData() }, [fetchData])

  const togglePaid = async (client: ClientPaymentRow, month: number) => {
    if (!payload) return
    const current = client.months[month]
    const key = `${clientKey(client)}-${month}`
    setSavingCell(key)

    const optimistic: ClientPaymentRow['months'][number] = { ...current, paid: !current.paid, paid_at: !current.paid ? new Date().toISOString().slice(0, 10) : null }
    setPayload({
      ...payload,
      clients: payload.clients.map((c) => clientKey(c) === clientKey(client) ? { ...c, months: { ...c.months, [month]: optimistic } } : c),
    })

    try {
      const res = await api.put(monthPaymentUrl(client, year, month), {
        paid: !current.paid,
        amount: current.amount,
      })
      setPayload((prev) => prev && ({
        ...prev,
        clients: prev.clients.map((c) => clientKey(c) === clientKey(client) ? { ...c, months: { ...c.months, [month]: { paid: res.data.paid, amount: res.data.amount, paid_at: res.data.paid_at, notes: res.data.notes } } } : c),
      }))
      fetchSummaryOnly()
    } catch {
      setPayload((prev) => prev && ({
        ...prev,
        clients: prev.clients.map((c) => clientKey(c) === clientKey(client) ? { ...c, months: { ...c.months, [month]: current } } : c),
      }))
    } finally {
      setSavingCell(null)
    }
  }

  const fetchSummaryOnly = useCallback(async () => {
    try {
      const res = await api.get(`/admin/subscription-payments/summary?year=${year}`)
      setSummary(res.data)
    } catch { /* silencioso, no crítico para la tabla */ }
  }, [year])

  const saveMonthAmount = async (client: ClientPaymentRow, month: number, amount: number, paid: boolean, paidAt: string | null) => {
    const res = await api.put(monthPaymentUrl(client, year, month), { paid, amount, paid_at: paidAt })
    setPayload((prev) => prev && ({
      ...prev,
      clients: prev.clients.map((c) => clientKey(c) === clientKey(client) ? { ...c, months: { ...c.months, [month]: { paid: res.data.paid, amount: res.data.amount, paid_at: res.data.paid_at, notes: res.data.notes } } } : c),
    }))
    setOpenCell(null)
    fetchSummaryOnly()
  }

  const saveTariff = async (client: ClientPaymentRow, fee: number) => {
    if (clientSource(client) === 'external') {
      await api.put(`/admin/subscription-payments/external/${client.id}`, { monthly_fee: fee })
    } else {
      await api.put(`/admin/users/${client.id}/monthly-fee`, { monthly_fee: fee })
    }
    setPayload((prev) => prev && ({
      ...prev,
      clients: prev.clients.map((c) => clientKey(c) === clientKey(client) ? { ...c, monthly_fee: fee } : c),
    }))
    setOpenTariff(null)
  }

  const deleteExternal = async (client: ClientPaymentRow) => {
    if (!window.confirm(`¿Eliminar a ${client.name} y todos sus pagos registrados? Esta acción no se puede deshacer.`)) return
    await api.delete(`/admin/subscription-payments/external/${client.id}`)
    fetchData()
  }

  const handleImported = (importedYear: number, applied: number) => {
    setNotice(`Importación de Notion completada: ${applied} mensualidades aplicadas.`)
    if (importedYear !== year) setYear(importedYear)
    else fetchData()
  }

  const chartData = useMemo(() => summary?.monthly.map((m) => ({ label: m.label.slice(0, 3), total: m.total })) ?? [], [summary])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center flex-wrap gap-3 justify-between">
        <div>
          <h3 className="text-base font-semibold">Seguimiento de pagos de suscripción</h3>
          <p className="text-sm text-muted-foreground">Marca manualmente qué clientes han pagado cada mes y ajusta importes puntuales</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Button variant="outline" onClick={() => setMergeOpen(true)} className="gap-2 cursor-pointer">
            <Merge size={16} />
            Revisar duplicados
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2 cursor-pointer">
            <Upload size={16} />
            Importar de Notion
          </Button>
          <Button onClick={() => setAddOpen(true)} className="gap-2 cursor-pointer">
            <UserPlus size={16} />
            Añadir cliente
          </Button>
          <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
          <SelectTrigger className="w-[110px] cursor-pointer">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
          </Select>
        </div>
      </div>

      <AddExternalClientDialog open={addOpen} onOpenChange={setAddOpen} onCreated={fetchData} />
      <NotionImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={handleImported} />
      <MergeDuplicatesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        onMerged={(merged) => { setNotice(`${merged} clientes no registrados fusionados con su usuario real.`); fetchData() }}
      />

      {notice && (
        <div className="flex items-center justify-between gap-3 border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2"><Check size={14} className="text-emerald-600 dark:text-emerald-400" />{notice}</span>
          <button onClick={() => setNotice(null)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Cerrar</button>
        </div>
      )}

      {loading ? (
        <div className="h-[400px] rounded-none bg-muted/50 animate-pulse flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Cargando...</span>
        </div>
      ) : payload && summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile icon={Wallet} label={`Ingresos ${year}`} value={currency.format(summary.total_year)} />
            <SummaryTile icon={TrendingUp} label="Media mensual" value={currency.format(summary.average_month)} />
            <SummaryTile icon={Users2} label="Media por cliente" value={currency.format(summary.average_client)} />
            <SummaryTile icon={Users2} label="Clientes en seguimiento" value={String(summary.total_clients)} />
          </div>

          <DashboardCard className="flex flex-col gap-0!">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 size={16} className="text-muted-foreground" />
                Ingresos mensuales {year}
              </h3>
            </div>
            <CardContent className="p-5">
              <ChartContainer config={chartConfig} className="h-[260px]! w-full">
                <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                  <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.3 }} content={<ChartTooltipContent formatter={(value) => currency.format(Number(value))} />} />
                  <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </DashboardCard>

          <DashboardCard className="flex flex-col gap-0!">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Clientes ({payload.clients.length})</h3>
              <p className="text-xs text-muted-foreground">Desliza para ver todos los meses</p>
            </div>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="sticky left-0 z-20 bg-muted/50 px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap border-b border-r border-border min-w-[220px]">
                        Cliente / Tarifa
                      </th>
                      {MONTHS_SHORT.map((label, i) => (
                        <th key={i} className="px-2 py-2.5 text-center font-medium text-muted-foreground whitespace-nowrap border-b border-border w-[92px]">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payload.clients.map((client) => (
                      <tr key={clientKey(client)} className="hover:bg-muted/30 transition-colors group">
                        <td className="sticky left-0 z-10 bg-background group-hover:bg-muted/30 px-4 py-2.5 border-b border-r border-border whitespace-nowrap">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium truncate flex items-center gap-1.5">
                                {client.name}
                                {clientSource(client) === 'external' && <Badge variant="outline" className="text-[10px]">No registrado</Badge>}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{client.email || '—'}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                            {clientSource(client) === 'external' && (
                              <button
                                onClick={() => deleteExternal(client)}
                                title="Eliminar cliente no registrado"
                                className="text-muted-foreground hover:text-destructive cursor-pointer p-1"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                            <Popover open={openTariff === clientKey(client)} onOpenChange={(open) => setOpenTariff(open ? clientKey(client) : null)}>
                              <PopoverTrigger render={
                                <button className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold shrink-0 cursor-pointer hover:bg-muted">
                                  {currency.format(client.monthly_fee)}
                                  <Pencil size={11} className="text-muted-foreground" />
                                </button>
                              } />
                              <PopoverContent align="end">
                                <TariffForm client={client} onSave={saveTariff} />
                              </PopoverContent>
                            </Popover>
                            </div>
                          </div>
                        </td>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                          const status = client.months[month]
                          const cellKey = `${clientKey(client)}-${month}`
                          return (
                            <td key={month} className="px-2 py-2.5 border-b border-border text-center align-middle">
                              <div className="flex flex-col items-center gap-1.5">
                                <Checkbox
                                  checked={status.paid}
                                  disabled={savingCell === cellKey}
                                  onCheckedChange={() => togglePaid(client, month)}
                                  className="cursor-pointer"
                                />
                                <div className="flex items-center gap-1.5">
                                  <span className={cn('text-xs', status.paid ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                                    {currency.format(status.amount)}
                                  </span>
                                  <Popover open={openCell === cellKey} onOpenChange={(open) => setOpenCell(open ? cellKey : null)}>
                                    <PopoverTrigger render={
                                      <button className="text-muted-foreground hover:text-foreground cursor-pointer">
                                        <Pencil size={11} />
                                      </button>
                                    } />
                                    <PopoverContent align="center">
                                      <MonthForm
                                        status={status}
                                        onSave={(amount, paid, paidAt) => saveMonthAmount(client, month, amount, paid, paidAt)}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                {status.paid && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                                    <Check size={10} /> pagado
                                  </span>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </DashboardCard>
        </>
      ) : (
        <div className="h-64 flex items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">No hay datos para el año seleccionado</p>
        </div>
      )}
    </div>
  )
}

function SummaryTile({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <DashboardCard className="py-5">
      <CardContent className="flex flex-col gap-1 px-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Icon size={13} />
          {label}
        </p>
        <h3 className="text-2xl font-semibold">{value}</h3>
      </CardContent>
    </DashboardCard>
  )
}

function TariffForm({ client, onSave }: { client: ClientPaymentRow; onSave: (client: ClientPaymentRow, fee: number) => void }) {
  const [value, setValue] = useState(String(client.monthly_fee))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const fee = Number(value)
    if (Number.isNaN(fee) || fee < 0) return
    setSaving(true)
    await onSave(client, fee)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <PopoverHeader>
        <PopoverTitle>Tarifa mensual</PopoverTitle>
      </PopoverHeader>
      <Input type="number" min={0} step={0.01} value={value} onChange={(e) => setValue(e.target.value)} />
      <Button size="sm" onClick={handleSave} disabled={saving} className="cursor-pointer">
        {saving ? 'Guardando...' : 'Guardar tarifa'}
      </Button>
    </div>
  )
}

function MonthForm({ status, onSave }: {
  status: ClientPaymentRow['months'][number]
  onSave: (amount: number, paid: boolean, paidAt: string | null) => void
}) {
  const [amount, setAmount] = useState(String(status.amount))
  const [paid, setPaid] = useState(status.paid)
  const [paidAt, setPaidAt] = useState(status.paid_at ?? new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const value = Number(amount)
    if (Number.isNaN(value) || value < 0) return
    setSaving(true)
    await onSave(value, paid, paid ? paidAt : null)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <PopoverHeader>
        <PopoverTitle>Ajustar pago del mes</PopoverTitle>
      </PopoverHeader>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={paid} onCheckedChange={(v) => setPaid(!!v)} />
        Pagado
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Importe cobrado</span>
        <Input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      {paid && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Fecha de pago</span>
          <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
      )}
      <Button size="sm" onClick={handleSave} disabled={saving} className="cursor-pointer">
        {saving ? 'Guardando...' : 'Guardar'}
      </Button>
    </div>
  )
}
