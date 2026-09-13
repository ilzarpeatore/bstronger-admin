import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import {
  PlusIcon,
  BellIcon,
  UserXIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
  UsersIcon,
  CreditCardIcon,
  TrendingDownIcon,
  WalletIcon,
  ReceiptIcon,
  SearchIcon,
  DownloadIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

type Tab = 'subscriptions' | 'payments' | 'expiring'

type Subscriber = {
  id: number
  name: string
  email?: string
}

type Plan = {
  id: number
  name: string
  price?: number
  currency?: string
}

type Subscription = {
  id: number
  subscriber: Subscriber
  subscriber_id?: number
  plan: Plan
  plan_id?: number
  price: number
  currency: string
  starts_at: string
  ends_at: string | null
  canceled_at: string | null
  trial_ends_at: string | null
  status?: string
}

type Transaction = {
  id: number
  user: Subscriber
  plan: Plan
  amount: number
  currency: string
  payment_method: string
  status: string
  paid_at: string | null
}

type Stats = {
  mrr: number
  arpu: number
  active_subscriptions: number
  expired_subscriptions: number
  canceled_this_month: number
  expiring_soon: number
  revenue_this_month: number
  pending_amount: number
}

type Option = { label: string; value: string | number }

type ListResponse<T> = T[] | { data: T[] } | { data?: T[] }

type ReminderChannel = 'push' | 'email' | 'both'

const paymentMethodLabels: Record<string, string> = {
  bizum: 'Bizum',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  stripe: 'Stripe',
  otro: 'Otro',
}

const paymentStatusLabels: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  failed: 'Fallido',
  refunded: 'Reembolsado',
}

function extractList<T>(res: ListResponse<T>): T[] {
  if (Array.isArray(res)) return res
  if (res && typeof res === 'object' && 'data' in res && Array.isArray(res.data)) {
    return res.data
  }
  return []
}

function formatCurrency(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(value)
}

function daysUntil(dateIso: string | null) {
  if (!dateIso) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateIso)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function subscriptionStatus(
  sub: Subscription
): 'canceled' | 'trial' | 'expired' | 'expiring' | 'active' | 'unknown' {
  if (sub.canceled_at) return 'canceled'
  if (sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date()) return 'trial'
  const d = daysUntil(sub.ends_at)
  if (d === null) return 'unknown'
  if (d < 0) return 'expired'
  if (d <= 7) return 'expiring'
  return 'active'
}

function statusBadge(status: ReturnType<typeof subscriptionStatus>) {
  const labels: Record<typeof status, string> = {
    active: 'Activa',
    expiring: 'Por vencer',
    expired: 'Vencida',
    canceled: 'Cancelada',
    trial: 'Prueba',
    unknown: 'Desconocido',
  }

  const variants: Record<typeof status, 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'> = {
    active: 'secondary',
    expiring: 'default',
    expired: 'destructive',
    canceled: 'outline',
    trial: 'default',
    unknown: 'secondary',
  }

  return <Badge variant={variants[status]}>{labels[status]}</Badge>
}

function renewalCell(sub: Subscription) {
  const d = daysUntil(sub.ends_at)
  const dateText = sub.ends_at
    ? new Date(sub.ends_at).toLocaleDateString('es-ES')
    : '—'

  return (
    <div className="flex flex-col">
      <span className="text-sm">{dateText}</span>
      {d !== null && (
        <span
          className={cn(
            'text-xs',
            d <= 7 && d >= 0 ? 'font-medium text-amber-600' : 'text-muted-foreground',
            d < 0 && 'text-destructive'
          )}
        >
          {d < 0 ? `Hace ${Math.abs(d)} días` : d === 0 ? 'Hoy' : `En ${d} días`}
        </span>
      )}
    </div>
  )
}

export default function SubscriptionView() {
  const [activeTab, setActiveTab] = useState<Tab>('subscriptions')

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsTotal, setTransactionsTotal] = useState<number | null>(null)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionSearch, setTransactionSearch] = useState('')
  const [transactionMethod, setTransactionMethod] = useState<string>('all')
  const [transactionStatus, setTransactionStatus] = useState<string>('all')

  const [stats, setStats] = useState<Stats>({
    mrr: 0,
    arpu: 0,
    active_subscriptions: 0,
    expired_subscriptions: 0,
    canceled_this_month: 0,
    expiring_soon: 0,
    revenue_this_month: 0,
    pending_amount: 0,
  })

  const [grantOpen, setGrantOpen] = useState(false)
  const [users, setUsers] = useState<Option[]>([])
  const [plans, setPlans] = useState<Option[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [granting, setGranting] = useState(false)

  const [revokeOpen, setRevokeOpen] = useState(false)
  const [revokeSub, setRevokeSub] = useState<Subscription | null>(null)
  const [revoking, setRevoking] = useState(false)

  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderSub, setReminderSub] = useState<Subscription | null>(null)
  const [batchReminderOpen, setBatchReminderOpen] = useState(false)
  const [reminderChannel, setReminderChannel] = useState<ReminderChannel>('email')
  const [sendingReminder, setSendingReminder] = useState(false)

  const fetchItems = useCallback(async () => {
    setSubscriptionsLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (search) params.set('search', search)
      const res = await api.get<ListResponse<Subscription>>(`/admin/plan-subscriptions?${params.toString()}`)
      const list = extractList(res)
      setSubscriptions(list)
      // FIX (auditoría 2026-09-13): per_page fijo en 100 sin paginación real
      // ni aviso -- si hay más de 100 suscripciones, las de más allá nunca
      // se ven ni se exportan, y antes no había ninguna señal de ello.
      const total = (res as any)?.pagination?.total_items
      if (typeof total === 'number' && total > list.length) {
        toast.warning(`Mostrando ${list.length} de ${total} suscripciones -- afina la búsqueda para ver el resto.`)
      }
    } catch {
      toast.error('Error al cargar suscripciones')
    } finally {
      setSubscriptionsLoading(false)
    }
  }, [search])

  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (transactionSearch) params.set('search', transactionSearch)
      if (transactionMethod !== 'all') params.set('payment_method', transactionMethod)
      if (transactionStatus !== 'all') params.set('payment_status', transactionStatus)
      const res = await api.get<ListResponse<Transaction>>(`/admin/transactions?${params.toString()}`)
      const list = extractList(res)
      setTransactions(list)
      const total = (res as any)?.pagination?.total_items
      setTransactionsTotal(typeof total === 'number' ? total : null)
      if (typeof total === 'number' && total > list.length) {
        toast.warning(`Mostrando ${list.length} de ${total} pagos -- afina la búsqueda para ver el resto.`)
      }
    } catch {
      toast.error('Error al cargar pagos')
    } finally {
      setTransactionsLoading(false)
    }
  }, [transactionSearch, transactionMethod, transactionStatus])

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<Stats>('/admin/subscriptions/stats')
      setStats(res)
    } catch {
      toast.error('Error al cargar estadísticas')
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const text = [sub.subscriber?.name, sub.subscriber?.email, sub.plan?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return text.includes(search.toLowerCase())
    })
  }, [subscriptions, search])

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredSubscriptions.length && filteredSubscriptions.length > 0) {
        return new Set()
      }
      return new Set(filteredSubscriptions.map((s) => s.id))
    })
  }, [filteredSubscriptions])

  const openGrant = useCallback(async () => {
    setGrantOpen(true)
    setSelectedUser('')
    setSelectedPlan('')
    try {
      const [usersRes, plansRes] = await Promise.all([
        api.get<ListResponse<{ id: number; name: string }>>('/admin/users'),
        api.get<ListResponse<{ id: number; name: string; price?: number; currency?: string }>>(
          '/admin/plans?active=1&archived=0'
        ),
      ])
      const usersList = extractList(usersRes)
      const plansList = extractList(plansRes)
      setUsers(usersList.map((u) => ({ label: u.name, value: u.id })))
      setPlans(plansList.map((p) => ({ label: p.name, value: p.id })))
    } catch {
      toast.error('Error al cargar usuarios o planes')
    }
  }, [])

  const handleGrant = useCallback(async () => {
    if (!selectedUser || !selectedPlan) {
      toast.error('Selecciona un usuario y un plan')
      return
    }
    setGranting(true)
    try {
      await api.post('/admin/plan-subscriptions-grant', {
        subscriber_id: Number(selectedUser),
        plan_id: Number(selectedPlan),
      })
      toast.success('Plan concedido correctamente')
      setGrantOpen(false)
      fetchItems()
      fetchStats()
    } catch (err: any) {
      // FIX (auditoría 2026-09-13): antes descartaba el error real del
      // backend (catch sin capturar `err`) -- mensaje fijo aunque el
      // backend explique la causa (ej. "el usuario ya tiene un plan activo").
      toast.error(err?.message || 'Error al conceder el plan')
    } finally {
      setGranting(false)
    }
  }, [selectedUser, selectedPlan, fetchItems, fetchStats])

  const handleReminder = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return
      setSendingReminder(true)
      try {
        await api.post('/admin/subscription/reminder', {
          subscription_ids: ids,
          channel: reminderChannel,
        })
        toast.success('Recordatorio enviado')
        setReminderOpen(false)
        setBatchReminderOpen(false)
        setReminderSub(null)
      } catch {
        toast.error('Error al enviar recordatorio')
      } finally {
        setSendingReminder(false)
      }
    },
    [reminderChannel]
  )

  const handleRevoke = useCallback(async () => {
    if (!revokeSub) return
    setRevoking(true)
    try {
      await api.post(`/admin/users/${revokeSub.subscriber.id}/revoke-access`, {
        reason: 'Suscripción vencida',
      })
      toast.success('Acceso revocado correctamente')
      setRevokeOpen(false)
      setRevokeSub(null)
      fetchItems()
      fetchStats()
    } catch (err: any) {
      toast.error(err?.message || 'Error al revocar el acceso')
    } finally {
      setRevoking(false)
    }
  }, [revokeSub, fetchItems, fetchStats])

  const expiringSubscriptions = useMemo(() => {
    return filteredSubscriptions.filter((sub) => {
      const status = subscriptionStatus(sub)
      const d = daysUntil(sub.ends_at)
      return d !== null && d <= 7 && status !== 'canceled' && status !== 'expired'
    })
  }, [filteredSubscriptions])

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const text = [t.user?.name, t.user?.email, t.plan?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return text.includes(transactionSearch.toLowerCase())
    })
  }, [transactions, transactionSearch])

  const exportCsv = useCallback(() => {
    if (filteredTransactions.length === 0) return
    // FIX (auditoría 2026-09-13): el CSV solo exportaba los 100 pagos
    // cargados en memoria, sin avisar si había más en total.
    if (transactionsTotal != null && transactionsTotal > filteredTransactions.length) {
      toast.warning(`El CSV solo incluye ${filteredTransactions.length} de ${transactionsTotal} pagos -- afina la búsqueda para exportar el resto.`)
    }
    const headers = ['Cliente', 'Plan', 'Importe', 'Método', 'Estado', 'Fecha pago']
    const rows = filteredTransactions.map((t) => [
      t.user?.name ?? '',
      t.plan?.name ?? '',
      formatCurrency(t.amount, t.currency),
      paymentMethodLabels[t.payment_method] ?? t.payment_method,
      paymentStatusLabels[t.status] ?? t.status,
      t.paid_at ? new Date(t.paid_at).toLocaleDateString('es-ES') : '',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'pagos.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [filteredTransactions, transactionsTotal])

  const subscriptionColumns = useMemo<ColumnDef<Subscription>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={filteredSubscriptions.length > 0 && selectedIds.size === filteredSubscriptions.length}
            onCheckedChange={toggleAll}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={() => toggleSelection(row.original.id)}
          />
        ),
      },
      {
        accessorKey: 'id',
        header: 'ID',
      },
      {
        id: 'client',
        header: 'Cliente',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.subscriber?.name}</span>
            {row.original.subscriber?.email && (
              <span className="text-xs text-muted-foreground">{row.original.subscriber.email}</span>
            )}
          </div>
        ),
      },
      {
        id: 'plan',
        header: 'Plan',
        cell: ({ row }) => <span>{row.original.plan?.name}</span>,
      },
      {
        id: 'amount',
        header: 'Importe',
        cell: ({ row }) => formatCurrency(row.original.price, row.original.currency),
      },
      {
        id: 'renewal',
        header: 'Renovación',
        cell: ({ row }) => renewalCell(row.original),
      },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => statusBadge(subscriptionStatus(row.original)),
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              size="icon-xs"
              variant="outline"
              onClick={() => {
                setReminderSub(row.original)
                setReminderOpen(true)
              }}
            >
              <BellIcon />
            </Button>
            <Button
              size="icon-xs"
              variant="destructive"
              onClick={() => {
                setRevokeSub(row.original)
                setRevokeOpen(true)
              }}
            >
              <UserXIcon />
            </Button>
          </div>
        ),
      },
    ],
    [filteredSubscriptions, selectedIds, toggleAll, toggleSelection]
  )

  const transactionColumns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        id: 'client',
        header: 'Cliente',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.user?.name}</span>
            {row.original.user?.email && (
              <span className="text-xs text-muted-foreground">{row.original.user.email}</span>
            )}
          </div>
        ),
      },
      {
        id: 'plan',
        header: 'Plan',
        cell: ({ row }) => <span>{row.original.plan?.name}</span>,
      },
      {
        id: 'amount',
        header: 'Importe',
        cell: ({ row }) => formatCurrency(row.original.amount, row.original.currency),
      },
      {
        accessorKey: 'payment_method',
        header: 'Método',
        cell: ({ row }) => paymentMethodLabels[row.original.payment_method] ?? row.original.payment_method,
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === 'paid'
                ? 'secondary'
                : row.original.status === 'failed'
                ? 'destructive'
                : 'outline'
            }
          >
            {paymentStatusLabels[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
      {
        id: 'paid_at',
        header: 'Fecha pago',
        cell: ({ row }) =>
          row.original.paid_at ? new Date(row.original.paid_at).toLocaleDateString('es-ES') : '—',
      },
    ],
    []
  )

  const subscriptionTable = useReactTable({
    data: activeTab === 'expiring' ? expiringSubscriptions : filteredSubscriptions,
    columns: subscriptionColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  const transactionTable = useReactTable({
    data: filteredTransactions,
    columns: transactionColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  const statCards = [
    { label: 'MRR', value: formatCurrency(stats.mrr), icon: TrendingUpIcon, tone: 'text-primary' },
    { label: 'ARPU', value: formatCurrency(stats.arpu), icon: CreditCardIcon, tone: 'text-muted-foreground' },
    { label: 'Activas', value: stats.active_subscriptions, icon: UsersIcon, tone: 'text-green-600' },
    { label: 'Vencidas', value: stats.expired_subscriptions, icon: TrendingDownIcon, tone: 'text-destructive' },
    { label: 'Ingresos mes', value: formatCurrency(stats.revenue_this_month), icon: WalletIcon, tone: 'text-primary' },
    { label: 'Pendientes cobrar', value: formatCurrency(stats.pending_amount), icon: ReceiptIcon, tone: 'text-amber-600' },
  ]

  return (
    <div className="space-y-6 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={cn('size-5', stat.tone)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="subscriptions">Suscripciones</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="expiring">Próximas a vencer</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm">
              <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente o plan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setBatchReminderOpen(true)}
                >
                  <BellIcon className="size-4" />
                  Avisar {selectedIds.size}
                </Button>
              )}
              <Button onClick={openGrant}>
                <PlusIcon className="size-4" />
                Conceder plan
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  {subscriptionTable.getHeaderGroups().map((group) => (
                    <TableRow key={group.id}>
                      {group.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {subscriptionsLoading ? (
                    <TableRow>
                      <TableCell colSpan={subscriptionColumns.length} className="text-center py-8">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : subscriptionTable.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={subscriptionColumns.length} className="text-center py-8 text-muted-foreground">
                        No se encontraron suscripciones.
                      </TableCell>
                    </TableRow>
                  ) : (
                    subscriptionTable.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative max-w-sm">
                <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente o plan..."
                  value={transactionSearch}
                  onChange={(e) => setTransactionSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={transactionMethod} onValueChange={(v) => v && setTransactionMethod(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los métodos</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="bizum">Bizum</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={transactionStatus} onValueChange={(v) => v && setTransactionStatus(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="failed">Fallido</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportCsv}>
              <DownloadIcon className="size-4" />
              Exportar CSV
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  {transactionTable.getHeaderGroups().map((group) => (
                    <TableRow key={group.id}>
                      {group.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {transactionsLoading ? (
                    <TableRow>
                      <TableCell colSpan={transactionColumns.length} className="text-center py-8">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : transactionTable.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={transactionColumns.length} className="text-center py-8 text-muted-foreground">
                        No se encontraron pagos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactionTable.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring" className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangleIcon className="size-5" />
            <span className="text-sm font-medium">
              Suscripciones que vencen en los próximos 7 días.
            </span>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  {subscriptionTable.getHeaderGroups().map((group) => (
                    <TableRow key={group.id}>
                      {group.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {subscriptionsLoading ? (
                    <TableRow>
                      <TableCell colSpan={subscriptionColumns.length} className="text-center py-8">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : expiringSubscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={subscriptionColumns.length} className="text-center py-8 text-muted-foreground">
                        No hay suscripciones próximas a vencer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    subscriptionTable.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Grant Dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder plan</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Usuario</FieldLabel>
              <Select value={selectedUser} onValueChange={(v) => v && setSelectedUser(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.value} value={String(u.value)}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Plan</FieldLabel>
              <Select value={selectedPlan} onValueChange={(v) => v && setSelectedPlan(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGrant} disabled={granting || !selectedUser || !selectedPlan}>
              {granting ? 'Concediendo...' : 'Conceder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Reminder Dialog */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar recordatorio</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel>Canal</FieldLabel>
            <Select value={reminderChannel} onValueChange={(v) => setReminderChannel(v as ReminderChannel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="push">Push</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => reminderSub && handleReminder([reminderSub.id])}
              disabled={sendingReminder || !reminderSub}
            >
              {sendingReminder ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Reminder Dialog */}
      <Dialog open={batchReminderOpen} onOpenChange={setBatchReminderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avisar a {selectedIds.size} suscripciones</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel>Canal</FieldLabel>
            <Select value={reminderChannel} onValueChange={(v) => setReminderChannel(v as ReminderChannel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="push">Push</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchReminderOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleReminder(Array.from(selectedIds))}
              disabled={sendingReminder || selectedIds.size === 0}
            >
              {sendingReminder ? 'Enviando...' : 'Enviar aviso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revocar acceso</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Revocar el acceso de <strong>{revokeSub?.subscriber?.name}</strong> por suscripción vencida?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? 'Revocando...' : 'Revocar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
