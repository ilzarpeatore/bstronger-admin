import { useEffect, useMemo, useState } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { filterInvitable, toClientOption, unwrapList, type ClientOption } from './challengeForm'

type Props = {
  selected: ClientOption[]
  onChange: (next: ClientOption[]) => void
  /** Clientes que ya están en el reto (no se pueden volver a invitar). */
  excludeIds?: number[]
}

/** Buscador de clientes activos para invitar a un reto cerrado. */
const ClientPicker = ({ selected, onChange, excludeIds = [] }: Props) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ status: 'active', per_page: '50' })
        if (query.trim()) params.set('search', query.trim())
        const res = await api.get(`/admin/users?${params}`)
        if (!cancelled) setResults(unwrapList<Parameters<typeof toClientOption>[0]>(res).map(toClientOption))
      } catch {
        if (!cancelled) toast.error('Error al cargar los clientes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  // El backend ya filtra por búsqueda; aquí se quitan inactivos/no clientes y los ya presentes.
  const visible = useMemo(() => filterInvitable(results, '', excludeIds), [results, excludeIds])
  const selectedIds = useMemo(() => new Set(selected.map(c => c.id)), [selected])

  const toggle = (c: ClientOption) => {
    onChange(selectedIds.has(c.id) ? selected.filter(s => s.id !== c.id) : [...selected, c])
  }

  return (
    <div className='flex flex-col gap-3'>
      {selected.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {selected.map(c => (
            <Badge key={c.id} variant='secondary' className='gap-1 pr-1'>
              {c.name}
              <button type='button' aria-label={`Quitar a ${c.name}`} className='rounded-sm hover:bg-foreground/10' onClick={() => toggle(c)}>
                <XIcon className='size-3' />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className='relative'>
        <SearchIcon className='absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
        <Input className='pl-8' placeholder='Buscar cliente activo por nombre o email' value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <div className='max-h-64 overflow-y-auto rounded-md border'>
        {loading && !visible.length ? (
          <p className='p-3 text-center text-muted-foreground'>Buscando…</p>
        ) : visible.length ? (
          visible.map(c => (
            <label key={c.id} className='flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50'>
              <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggle(c)} />
              <span className='flex min-w-0 flex-col'>
                <span className='truncate font-medium'>{c.name}</span>
                <span className='truncate text-xs text-muted-foreground'>{c.email}</span>
              </span>
            </label>
          ))
        ) : (
          <p className='p-3 text-center text-muted-foreground'>No hay clientes activos que coincidan.</p>
        )}
      </div>
      <p className='text-xs text-muted-foreground'>{selected.length} seleccionado{selected.length === 1 ? '' : 's'}. Recibirán una invitación y tendrán que aceptarla para aparecer en la clasificación.</p>
    </div>
  )
}

export default ClientPicker
