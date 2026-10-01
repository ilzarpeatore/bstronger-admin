import { useCallback, useEffect, useState } from 'react'
import { ArchiveIcon, MailIcon, MailOpenIcon, ReplyIcon, SearchIcon, Trash2Icon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatDate, originLabel, Pager, PER_PAGE, type Pagination } from './shared'

// Mensajes del formulario de /contacto de la web. También llegan por email
// (CONTACT_NOTIFY_EMAIL); aquí quedan guardados para no perder ninguno.

type ContactMessage = {
  id: number
  name: string
  email: string
  subject: string | null
  message: string
  status: 'new' | 'read' | 'archived'
  utm_source: string | null
  utm_campaign: string | null
  referrer_host: string | null
  created_at: string | null
}

const statusLabels: Record<ContactMessage['status'], string> = {
  new: 'Nuevo',
  read: 'Leído',
  archived: 'Archivado',
}

const STATUS_OPTIONS = [
  { value: 'inbox', label: 'Bandeja' },
  { value: 'new', label: 'Sin leer' },
  { value: 'read', label: 'Leídos' },
  { value: 'archived', label: 'Archivados' },
  { value: 'all', label: 'Todos' },
]

export default function ContactMessagesView() {
  const [items, setItems] = useState<ContactMessage[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('inbox')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const [deleting, setDeleting] = useState<ContactMessage | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: String(PER_PAGE), page: String(page) })
      if (search.trim()) params.set('search', search.trim())
      if (status !== 'all') params.set('status', status)
      const res = await api.get<{ data: ContactMessage[]; unread?: number; pagination?: Pagination }>(
        `/admin/contact-messages?${params.toString()}`,
      )
      setItems(res.data ?? [])
      setUnread(res.unread ?? 0)
      setTotalPages(Math.max(1, res.pagination?.totalPages ?? 1))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar los mensajes')
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const setMessageStatus = async (m: ContactMessage, next: ContactMessage['status'], quiet = false) => {
    try {
      await api.post('/admin/contact-messages-update', { id: m.id, status: next })
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: next } : x)))
      setSelected((s) => (s && s.id === m.id ? { ...s, status: next } : s))
      if (m.status === 'new' && next !== 'new') setUnread((n) => Math.max(0, n - 1))
      if (m.status !== 'new' && next === 'new') setUnread((n) => n + 1)
      if (!quiet) toast.success(next === 'archived' ? 'Mensaje archivado' : 'Mensaje actualizado')
      if (next === 'archived' && status === 'inbox') {
        setItems((prev) => prev.filter((x) => x.id !== m.id))
        setSelected(null)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar')
    }
  }

  const open = (m: ContactMessage) => {
    setSelected(m)
    if (m.status === 'new') setMessageStatus(m, 'read', true)
  }

  const remove = async () => {
    if (!deleting) return
    try {
      await api.post('/admin/contact-messages-delete', { id: deleting.id })
      toast.success('Mensaje eliminado')
      if (selected?.id === deleting.id) setSelected(null)
      setDeleting(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  const replyHref = (m: ContactMessage) =>
    `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject || 'Tu mensaje a BeStronger'}`)}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Mensajes de contacto
          {unread > 0 ? <Badge>{unread} sin leer</Badge> : null}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Lo que escriben en el formulario de contacto de la web. Al abrir un mensaje se marca como leído; responde desde tu
          correo con el botón «Responder».
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-60 flex-1">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o asunto..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9!"
            />
          </div>
          <Select
            items={STATUS_OPTIONS}
            value={status}
            onValueChange={(v) => {
              if (!v) return
              setStatus(v)
              setPage(1)
              setSelected(null)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="divide-y rounded-lg border">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No hay mensajes</div>
            ) : (
              items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => open(m)}
                  className={cn(
                    'block w-full px-4 py-3 text-left transition-colors hover:bg-muted/60',
                    selected?.id === m.id && 'bg-muted',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('truncate', m.status === 'new' ? 'font-semibold' : 'font-medium')}>
                      {m.status === 'new' ? <span className="mr-2 inline-block size-2 rounded-full bg-primary align-middle" /> : null}
                      {m.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
                  </div>
                  <div className="truncate text-sm">{m.subject || 'Sin asunto'}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.message}</div>
                </button>
              ))
            )}
          </div>

          <div className="rounded-lg border p-5">
            {selected ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">{selected.subject || 'Sin asunto'}</h3>
                    <p className="text-sm">
                      {selected.name} · <span className="text-muted-foreground">{selected.email}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(selected.created_at, true)} · Origen: {originLabel(selected)}
                    </p>
                  </div>
                  <Badge variant={selected.status === 'new' ? 'default' : 'secondary'}>{statusLabels[selected.status]}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.message}</p>
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <Button render={<a href={replyHref(selected)} />}>
                    <ReplyIcon className="size-4" />
                    Responder
                  </Button>
                  {selected.status !== 'new' ? (
                    <Button variant="outline" onClick={() => setMessageStatus(selected, 'new')}>
                      <MailIcon className="size-4" />
                      Marcar como no leído
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setMessageStatus(selected, 'read')}>
                      <MailOpenIcon className="size-4" />
                      Marcar como leído
                    </Button>
                  )}
                  {selected.status !== 'archived' ? (
                    <Button variant="outline" onClick={() => setMessageStatus(selected, 'archived')}>
                      <ArchiveIcon className="size-4" />
                      Archivar
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => setDeleting(selected)}>
                    <Trash2Icon className="size-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
                Selecciona un mensaje para leerlo
              </div>
            )}
          </div>
        </div>

        <Pager page={page} totalPages={totalPages} onChange={setPage} />
      </CardContent>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el mensaje de {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Se borra definitivamente. Si solo quieres quitarlo de la bandeja, archívalo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
