import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'

import { RefreshCwIcon, SearchIcon, LayersIcon, UserIcon, LibraryIcon, PencilIcon, PlusIcon, BarChart3Icon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import MacrocycleBuilderDialog, { type BuilderProgram } from '@/components/coaching/MacrocycleBuilderDialog'
import { api } from '@/lib/api'
import { fuzzyMatch } from '@/lib/textSearch'

// GET /admin/training-program-macrocycles (Bckbs TrainingProgramController::getMacrocycles):
// no hay entidad "macrociclo" en la BD. Un macrociclo es el nombre que el coach
// pone A MANO a un conjunto de programas (macrocycle_name; POST
// training-program-set-macrocycle-bulk desde «Nuevo macrociclo», o
// training-program-set-macrocycle para uno). NADA se deduce del título (2026-09-28:
// cada mesociclo con un sufijo distinto salía como un macrociclo propio); el título
// solo sugiere el nº de mesociclo. Se agrupa también por cliente (cada cliente
// tiene su copia del programa, que hereda el macrociclo).
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

// Programa sin macrociclo tal y como lo devuelve `unassigned`
type UnassignedProgram = {
  id: number
  title: string
  client: { id: number; display_name: string | null } | null
  num_weeks: number | null
  suggested_mesocycle: number | null
}

type EditState = {
  programId: number
  programTitle: string
  macrocycleName: string
  mesocycleNumber: string
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
  const navigate = useNavigate()
  const [groups, setGroups] = useState<Macrocycle[]>([])
  const [unassigned, setUnassigned] = useState<UnassignedProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState<OwnerFilter>('all')

  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [builder, setBuilder] = useState<{ initialName: string } | null>(null)
  const [dissolve, setDissolve] = useState<Macrocycle | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/training-program-macrocycles')
      setGroups(res.data?.data || res.data || [])
      setUnassigned(res.unassigned || [])
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

  // Programas elegibles en «Nuevo macrociclo»: los que no tienen macrociclo y los que ya están en uno
  const builderPrograms = useMemo<BuilderProgram[]>(() => {
    const free: BuilderProgram[] = unassigned.map((p) => ({
      id: p.id,
      title: p.title,
      clientName: p.client?.display_name ?? null,
      numWeeks: p.num_weeks,
      currentMacrocycle: null,
      currentMesocycle: null,
      suggestedMesocycle: p.suggested_mesocycle,
    }))
    const grouped: BuilderProgram[] = groups.flatMap((g) =>
      g.mesocycles.map((m) => ({
        id: m.id,
        title: m.title,
        clientName: g.client?.display_name ?? null,
        numWeeks: m.num_weeks,
        currentMacrocycle: g.name,
        currentMesocycle: m.mesocycle_number,
        suggestedMesocycle: m.mesocycle_number,
      })),
    )
    return [...free, ...grouped]
  }, [groups, unassigned])

  // Nombres existentes y nºs ya usados, para continuar la numeración al añadir a uno
  const existingMacrocycles = useMemo(() => {
    const byName = new Map<string, { name: string; mesocycles: number[] }>()
    for (const g of groups) {
      const entry = byName.get(g.name.toLowerCase()) ?? { name: g.name, mesocycles: [] }
      entry.mesocycles.push(...g.mesocycles.map((m) => m.mesocycle_number).filter((n): n is number => n != null))
      byName.set(g.name.toLowerCase(), entry)
    }
    return Array.from(byName.values())
  }, [groups])

  const macrocycleNames = useMemo(() => Array.from(new Set(groups.map((g) => g.name))).sort(), [groups])

  const openDashboard = (g: Macrocycle) => {
    const params = new URLSearchParams({
      programs: g.mesocycles.map((m) => m.id).join(','),
      name: g.client?.display_name ? `${g.name} · ${g.client.display_name}` : g.name,
    })
    navigate(`/macrociclos/dashboard?${params}`)
  }

  const openEdit = (g: Macrocycle, m: Mesocycle) => {
    setEdit({
      programId: m.id,
      programTitle: m.title,
      macrocycleName: g.name,
      mesocycleNumber: m.mesocycle_number != null ? String(m.mesocycle_number) : '',
    })
  }

  // Disolver: quita el macrociclo (y el nº) de todos sus mesociclos; los programas no se tocan
  const dissolveGroup = async () => {
    if (!dissolve) return
    setSaving(true)
    try {
      await api.post('/admin/training-program-set-macrocycle-bulk', {
        macrocycle_name: null,
        items: dissolve.mesocycles.map((m) => ({ id: m.id })),
      })
      toast.success(`Macrociclo «${dissolve.name}» disuelto: sus mesociclos quedan sin macrociclo`)
      setDissolve(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo disolver el macrociclo')
    } finally {
      setSaving(false)
    }
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
      toast.success(clear ? 'Mesociclo quitado del macrociclo' : 'Mesociclo guardado')
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
            Un macrociclo es el conjunto de mesociclos que tú eliges: nada se agrupa solo por el título del programa.
            {!loading && unassigned.length > 0 && ` ${unassigned.length} programas sin macrociclo.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCwIcon className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            Recargar
          </Button>
          <Button onClick={() => setBuilder({ initialName: '' })} disabled={loading}>
            <PlusIcon className="mr-2 size-4" />
            Nuevo macrociclo
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
            {groups.length === 0
              ? 'Aún no hay macrociclos. Usa «Nuevo macrociclo» y elige los mesociclos que lo forman.'
              : 'Ningún macrociclo coincide con la búsqueda.'}
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
                <Button size="sm" onClick={() => openDashboard(g)}>
                  <BarChart3Icon className="mr-1 size-3" />
                  Dashboard
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBuilder({ initialName: g.name })}>
                  <PlusIcon className="mr-1 size-3" />
                  Añadir mesociclo
                </Button>
                <Button size="sm" variant="ghost" title="Deshacer el macrociclo (los programas no se borran)" onClick={() => setDissolve(g)}>
                  <Trash2Icon className="mr-1 size-3" />
                  Disolver
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
            <DialogTitle>Cambiar el macrociclo de un mesociclo</DialogTitle>
          </DialogHeader>
          {edit && (
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel>Programa (mesociclo)</FieldLabel>
                <div className="rounded-md border p-2 text-sm font-medium">{edit.programTitle}</div>
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
            <Button variant="outline" onClick={() => save(true)} disabled={saving}>
              Quitar del macrociclo
            </Button>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => save()} disabled={saving || !edit?.programId}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {builder && (
        <MacrocycleBuilderDialog
          programs={builderPrograms}
          existing={existingMacrocycles}
          initialName={builder.initialName}
          onClose={() => setBuilder(null)}
          onSaved={load}
        />
      )}

      <Dialog open={dissolve !== null} onOpenChange={(open) => !open && setDissolve(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disolver «{dissolve?.name}»</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sus {dissolve?.mesocycles.length} mesociclos dejan de formar un macrociclo y pasan a «sin macrociclo». Los programas y
            sus asignaciones a clientes no se tocan.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDissolve(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={dissolveGroup} disabled={saving}>
              {saving ? 'Disolviendo…' : 'Disolver macrociclo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
