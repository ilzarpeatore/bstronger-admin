import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router'

import { RefreshCwIcon, SearchIcon, LayersIcon, UserIcon, LibraryIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { fuzzyMatch } from '@/lib/textSearch'

// GET /admin/training-program-macrocycles (Bckbs TrainingProgramController::getMacrocycles):
// no hay entidad "macrociclo" en la BD, el backend agrupa los programas por
// el nombre de macrociclo que lleva el título ("Macrociclo 2 - Mesociclo 1",
// "M1 (Be Stronger Macrociclo 2)"...) y por cliente (cada cliente tiene su copia).
type MacrocycleAssignment = {
  id: number
  client_id: number
  client_name: string | null
  start_date: string | null
  fecha_fin: string | null
  activo: boolean
  cerrado_at: string | null
}

type Mesocycle = {
  id: number
  title: string
  mesocycle_number: number | null
  num_weeks: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  activo: boolean
  source: string | null
  source_id: number | null
  created_at: string | null
  assignments: MacrocycleAssignment[]
}

type Macrocycle = {
  key: string
  name: string
  client: { id: number; display_name: string | null; email: string | null } | null
  mesocycles: Mesocycle[]
  total_weeks: number
  last_created_at: string
}

type OwnerFilter = 'all' | 'clients' | 'library'

const OWNER_FILTERS: { value: OwnerFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'clients', label: 'De clientes' },
  { value: 'library', label: 'Biblioteca' },
]

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('es-ES')
}

function assignmentStatus(a: MacrocycleAssignment) {
  if (a.cerrado_at) return { label: 'Cerrado', variant: 'secondary' as const }
  if (!a.activo) return { label: 'Inactivo', variant: 'outline' as const }
  const today = new Date().toISOString().slice(0, 10)
  if (a.start_date && a.start_date > today) return { label: 'Próximo', variant: 'outline' as const }
  return { label: 'En curso', variant: 'default' as const }
}

export default function MacrocyclesView() {
  const [groups, setGroups] = useState<Macrocycle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState<OwnerFilter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/training-program-macrocycles')
      setGroups(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar los macrociclos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      if (owner === 'clients' && !g.client) return false
      if (owner === 'library' && g.client) return false
      if (!search.trim()) return true
      return fuzzyMatch(search, g.name, g.client?.display_name, g.client?.email, ...g.mesocycles.map((m) => m.title))
    })
  }, [groups, search, owner])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Macrociclos</h1>
          <p className="text-sm text-muted-foreground">
            Mesociclos agrupados por macrociclo, según el título del programa (p. ej. «Macrociclo 2 - Mesociclo 1»).
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCwIcon className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
          Recargar
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por macrociclo, cliente o mesociclo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {OWNER_FILTERS.map((f) => (
            <Button key={f.value} variant={owner === f.value ? 'default' : 'outline'} onClick={() => setOwner(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay macrociclos. Un programa aparece aquí cuando su título incluye «Mesociclo N» o «Macrociclo».
          </CardContent>
        </Card>
      ) : (
        filtered.map((g) => (
          <Card key={g.key}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LayersIcon className="size-5" />
                {g.name}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {g.client ? (
                  <Link to={`/users/${g.client.id}`}>
                    <Badge variant="default" className="gap-1">
                      <UserIcon className="size-3" />
                      {g.client.display_name || g.client.email || `Cliente #${g.client.id}`}
                    </Badge>
                  </Link>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <LibraryIcon className="size-3" />
                    Biblioteca
                  </Badge>
                )}
                <Badge variant="secondary">
                  {g.mesocycles.length} {g.mesocycles.length === 1 ? 'mesociclo' : 'mesociclos'}
                </Badge>
                {g.total_weeks > 0 && <Badge variant="secondary">{g.total_weeks} semanas</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Meso</TableHead>
                    <TableHead>Programa</TableHead>
                    <TableHead className="w-24">Semanas</TableHead>
                    <TableHead>Asignación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.mesocycles.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.mesocycle_number != null ? `M${m.mesocycle_number}` : '—'}
                      </TableCell>
                      <TableCell>
                        <Link to={`/training-programs/${m.id}`} className="hover:underline">
                          {m.title}
                        </Link>
                        {!m.activo && (
                          <Badge variant="outline" className="ml-2">
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{m.num_weeks ?? '—'}</TableCell>
                      <TableCell>
                        {m.assignments.length === 0 ? (
                          <span className="text-sm text-muted-foreground">Sin asignar</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {m.assignments.map((a) => {
                              const status = assignmentStatus(a)
                              return (
                                <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                                  <Badge variant={status.variant}>{status.label}</Badge>
                                  {!g.client && <span>{a.client_name || `Cliente #${a.client_id}`}</span>}
                                  <span className="text-muted-foreground">
                                    {formatDate(a.start_date)} → {formatDate(a.fecha_fin)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
