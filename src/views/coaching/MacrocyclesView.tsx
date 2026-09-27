import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router'

import { RefreshCwIcon, SearchIcon, LayersIcon, UserIcon, LibraryIcon, PencilIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { fuzzyMatch } from '@/lib/textSearch'

// GET /admin/training-program-macrocycles (Bckbs TrainingProgramController::getMacrocycles):
// no hay entidad "macrociclo" en la BD. Cada programa pertenece a un
// macrociclo si se le asignó a mano (macrocycle_name, POST
// training-program-set-macrocycle) o, si no, según su título ("Macrociclo 2 -
// Mesociclo 1", "M1 (Be Stronger Macrociclo 2)"...). Se agrupa también por
// cliente (cada cliente tiene su copia del programa).
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
  grouping: 'manual' | 'title'
  macrocycle_name: string | null
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

type ProgramOption = {
  id: number
  title: string
  clientName: string | null
  current: string | null
}

type EditState = {
  programId: number | null
  macrocycleName: string
  mesocycleNumber: string
  isManual: boolean
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
  const [unassigned, setUnassigned] = useState<ProgramOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState<OwnerFilter>('all')

  const [edit, setEdit] = useState<EditState | null>(null)
  const [programSearch, setProgramSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/training-program-macrocycles')
      setGroups(res.data?.data || res.data || [])
      setUnassigned(
        (res.unassigned || []).map((p: { id: number; title: string; client: { display_name: string | null } | null }) => ({
          id: p.id,
          title: p.title,
          clientName: p.client?.display_name ?? null,
          current: null,
        })),
      )
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

  // Todos los programas elegibles en el diálogo: los sueltos y los que ya están en algún macrociclo
  const programOptions = useMemo<ProgramOption[]>(() => {
    const grouped = groups.flatMap((g) =>
      g.mesocycles.map((m) => ({ id: m.id, title: m.title, clientName: g.client?.display_name ?? null, current: g.name })),
    )
    return [...unassigned, ...grouped]
  }, [groups, unassigned])

  const macrocycleNames = useMemo(() => Array.from(new Set(groups.map((g) => g.name))).sort(), [groups])

  const visibleOptions = useMemo(
    () => programOptions.filter((p) => !programSearch.trim() || fuzzyMatch(programSearch, p.title, p.clientName)).slice(0, 50),
    [programOptions, programSearch],
  )

  const selectedProgram = programOptions.find((p) => p.id === edit?.programId) ?? null

  const openNew = (macrocycleName = '') => {
    setProgramSearch('')
    setEdit({ programId: null, macrocycleName, mesocycleNumber: '', isManual: false })
  }

  const openEdit = (g: Macrocycle, m: Mesocycle) => {
    setProgramSearch('')
    setEdit({
      programId: m.id,
      macrocycleName: g.name,
      mesocycleNumber: m.mesocycle_number != null ? String(m.mesocycle_number) : '',
      isManual: m.grouping === 'manual',
    })
  }

  const save = async (clear = false) => {
    if (!edit?.programId) return
    if (!clear && !edit.macrocycleName.trim()) {
      toast.error('Escribe el nombre del macrociclo')
      return
    }
    setSaving(true)
    try {
      await api.post('/admin/training-program-set-macrocycle', {
        id: edit.programId,
        macrocycle_name: clear ? null : edit.macrocycleName.trim(),
        mesocycle_number: clear || edit.mesocycleNumber === '' ? null : Number(edit.mesocycleNumber),
      })
      toast.success(clear ? 'Asignación manual quitada' : 'Mesociclo asignado')
      setEdit(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Macrociclos</h1>
          <p className="text-sm text-muted-foreground">
            Mesociclos agrupados por macrociclo: los asignados a mano y, si no, según el título del programa (p. ej.
            «Macrociclo 2 - Mesociclo 1»).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCwIcon className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            Recargar
          </Button>
          <Button onClick={() => openNew()}>
            <PlusIcon className="mr-2 size-4" />
            Asignar mesociclo
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9!"
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
            No hay macrociclos. Usa «Asignar mesociclo», o pon «Mesociclo N» o «Macrociclo» en el título del programa.
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
                <Button size="sm" variant="outline" onClick={() => openNew(g.name)}>
                  <PlusIcon className="mr-1 size-3" />
                  Añadir mesociclo
                </Button>
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
                    <TableHead className="w-12" />
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
                        {m.grouping === 'manual' && (
                          <Badge variant="secondary" className="ml-2">
                            Manual
                          </Badge>
                        )}
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
                      <TableCell>
                        <Button size="icon" variant="ghost" title="Cambiar macrociclo" onClick={() => openEdit(g, m)}>
                          <PencilIcon className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={edit !== null} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar mesociclo a un macrociclo</DialogTitle>
          </DialogHeader>
          {edit && (
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel>Programa (mesociclo)</FieldLabel>
                {selectedProgram ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div>
                      <div className="font-medium">{selectedProgram.title}</div>
                      <div className="text-muted-foreground">
                        {selectedProgram.clientName ?? 'Biblioteca'}
                        {selectedProgram.current && ` · ahora en «${selectedProgram.current}»`}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ ...edit, programId: null, isManual: false })}>
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Buscar programa por título o cliente…"
                      value={programSearch}
                      onChange={(e) => setProgramSearch(e.target.value)}
                    />
                    <div className="max-h-60 overflow-y-auto rounded-md border">
                      {visibleOptions.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">Ningún programa coincide.</p>
                      ) : (
                        visibleOptions.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                            onClick={() => {
                              const inGroup = groups.flatMap((g) => g.mesocycles).find((m) => m.id === p.id)
                              setEdit({
                                ...edit,
                                programId: p.id,
                                isManual: inGroup?.grouping === 'manual',
                                mesocycleNumber:
                                  edit.mesocycleNumber ||
                                  (inGroup?.mesocycle_number != null ? String(inGroup.mesocycle_number) : ''),
                              })
                            }}
                          >
                            <div className="font-medium">{p.title}</div>
                            <div className="text-muted-foreground">
                              {p.clientName ?? 'Biblioteca'}
                              {p.current ? ` · en «${p.current}»` : ' · sin macrociclo'}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </Field>
              <Field className="gap-2">
                <FieldLabel>Macrociclo</FieldLabel>
                <Input
                  list="macrocycle-names"
                  placeholder="Nombre de un macrociclo existente o nuevo"
                  value={edit.macrocycleName}
                  onChange={(e) => setEdit({ ...edit, macrocycleName: e.target.value })}
                />
                <datalist id="macrocycle-names">
                  {macrocycleNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </Field>
              <Field className="gap-2">
                <FieldLabel>Número de mesociclo (opcional)</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  placeholder="1, 2, 3…"
                  value={edit.mesocycleNumber}
                  onChange={(e) => setEdit({ ...edit, mesocycleNumber: e.target.value })}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                No cambia el título del programa ni lo que ve el cliente. Los mesociclos de un cliente se agrupan aparte de
                los de la biblioteca aunque el macrociclo se llame igual.
              </p>
            </FieldGroup>
          )}
          <DialogFooter className="gap-2">
            {edit?.isManual && (
              <Button variant="outline" onClick={() => save(true)} disabled={saving}>
                Quitar asignación manual
              </Button>
            )}
            <Button variant="outline" onClick={() => setEdit(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => save()} disabled={saving || !edit?.programId}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
