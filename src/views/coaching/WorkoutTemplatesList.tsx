import { useMemo, useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, FolderOpenIcon, FilterXIcon, PlusIcon, SearchIcon, TrashIcon, LayoutListIcon, FoldersIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DEFAULT_LIST_FILTERS,
  LOOSE_FOLDER_LABEL,
  countActiveListFilters,
  decorate,
  filterItems,
  groupByWeek,
  groupIntoFolders,
  type DecoratedItem,
  type ListFilters,
  type ListSort,
  type TemplateListItem,
} from './workoutTemplateGroups'

type Props = {
  items: TemplateListItem[]
  loading: boolean
  onOpen: (item: TemplateListItem) => void
  onEdit: (item: TemplateListItem) => void
  onDelete: (item: TemplateListItem) => void
  onCreate: () => void
  /** Borra varias plantillas (borrado lógico). Devuelve cuántas se borraron. */
  onBulkDelete: (ids: number[]) => Promise<number>
}

const SORT_LABELS: Record<ListSort, string> = {
  recent: 'Más recientes',
  title: 'Título (A-Z)',
  id: 'ID (mayor a menor)',
  exercises: 'Más ejercicios',
}

function weekRange(weeks: number[]): string {
  if (!weeks.length) return ''
  return weeks.length === 1 ? `S${weeks[0]}` : `S${weeks[0]}–S${weeks[weeks.length - 1]}`
}

export default function WorkoutTemplatesList({ items, loading, onOpen, onEdit, onDelete, onCreate, onBulkDelete }: Props) {
  const [filters, setFilters] = useState<ListFilters>(DEFAULT_LIST_FILTERS)
  const [mode, setMode] = useState<'folders' | 'flat'>('folders')
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const set = (patch: Partial<ListFilters>) => setFilters(f => ({ ...f, ...patch }))

  // Duplicadas se calcula sobre la lista completa (no sobre la filtrada) para
  // que la marca no cambie según los filtros.
  const decorated = useMemo(() => decorate(items), [items])
  const visible = useMemo(() => filterItems(decorated, filters), [decorated, filters])
  const folders = useMemo(() => groupIntoFolders(visible), [visible])
  const activeFilters = countActiveListFilters(filters)
  const totalDuplicates = useMemo(() => decorated.filter(i => i.isDuplicate).length, [decorated])
  const realFolders = folders.filter(f => f.name !== null).length

  // Con búsqueda/filtros activos o una sola carpeta se muestran desplegadas.
  const autoOpen = activeFilters > 0 || folders.length <= 1
  const isOpen = (key: string) => autoOpen || openFolders.has(key)
  const toggleFolder = (key: string) =>
    setOpenFolders(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })

  const toggleSelected = (id: number, on: boolean) =>
    setSelected(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n })
  const setMany = (ids: number[], on: boolean) =>
    setSelected(prev => { const n = new Set(prev); ids.forEach(id => (on ? n.add(id) : n.delete(id))); return n })

  const doBulkDelete = async () => {
    setDeleting(true)
    try {
      await onBulkDelete([...selected])
      setSelected(new Set())
      setConfirmBulk(false)
    } finally {
      setDeleting(false)
    }
  }

  const row = (it: DecoratedItem, showFolder: boolean) => (
    <TableRow key={it.id} className='cursor-pointer hover:bg-muted/50' onClick={() => onOpen(it)}>
      <TableCell className='w-[40px]' onClick={e => e.stopPropagation()}>
        <Checkbox checked={selected.has(it.id)} onCheckedChange={c => toggleSelected(it.id, c === true)} className='cursor-pointer' />
      </TableCell>
      <TableCell className='w-[60px] text-muted-foreground'>{it.id}</TableCell>
      <TableCell className='font-medium'>
        <div className='flex flex-wrap items-center gap-2'>
          <span>{showFolder ? it.title : it.session}</span>
          {it.isDuplicate && <Badge variant='outline' className='border-amber-500/60 text-amber-600'>Duplicada</Badge>}
        </div>
        {it.description && <p className='max-w-[420px] truncate text-xs text-muted-foreground'>{it.description}</p>}
      </TableCell>
      <TableCell><Badge variant='outline'>{it.exercise_count ?? 0}</Badge></TableCell>
      <TableCell>{it.is_exclusive ? <Badge variant='default'>Exclusivo</Badge> : <Badge variant='outline'>Gratuito</Badge>}</TableCell>
      <TableCell>{it.is_public ? <Badge variant='default'>Público</Badge> : <Badge variant='outline'>Privado</Badge>}</TableCell>
      <TableCell className='hidden text-xs text-muted-foreground md:table-cell'>
        {it.created_at ? new Date(it.created_at).toLocaleDateString('es-ES') : '—'}
      </TableCell>
      <TableCell onClick={e => e.stopPropagation()}>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => onEdit(it)}>Editar</Button>
          <Button variant='destructive' size='sm' onClick={() => onDelete(it)}><TrashIcon className='size-3' /></Button>
        </div>
      </TableCell>
    </TableRow>
  )

  const header = (
    <TableHeader>
      <TableRow>
        <TableHead className='w-[40px]' />
        <TableHead className='w-[60px]'>ID</TableHead>
        <TableHead>Título</TableHead>
        <TableHead>Ejercicios</TableHead>
        <TableHead>Acceso</TableHead>
        <TableHead>Visibilidad</TableHead>
        <TableHead className='hidden md:table-cell'>Creada</TableHead>
        <TableHead className='w-[120px]'>Acciones</TableHead>
      </TableRow>
    </TableHeader>
  )

  return (
    <>
      <Card>
        <CardHeader className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <CardTitle>Plantillas de entrenamiento</CardTitle>
            <CardDescription>
              Plantillas sin programa activo. Se agrupan en carpetas por el nombre del programa del que vienen
              (normalmente de un import antiguo); las sesiones de un programa vigente están en su "Calendario del programa".
            </CardDescription>
          </div>
          <Button onClick={onCreate}><PlusIcon className='mr-2 size-4' /> Nueva plantilla</Button>
        </CardHeader>

        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <div className='relative w-full sm:w-72'>
              <SearchIcon className='absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input placeholder='Buscar por título, descripción o ID...' value={filters.search}
                onChange={e => set({ search: e.target.value })} className='pl-9' />
            </div>

            <Select value={filters.access} onValueChange={v => set({ access: (v ?? 'all') as ListFilters['access'] })}>
              <SelectTrigger className='h-9 w-[150px] text-xs'><SelectValue placeholder='Acceso' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Acceso: todos</SelectItem>
                <SelectItem value='free'>Gratuitas</SelectItem>
                <SelectItem value='exclusive'>Exclusivas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.visibility} onValueChange={v => set({ visibility: (v ?? 'all') as ListFilters['visibility'] })}>
              <SelectTrigger className='h-9 w-[160px] text-xs'><SelectValue placeholder='Visibilidad' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Visibilidad: todas</SelectItem>
                <SelectItem value='public'>Públicas</SelectItem>
                <SelectItem value='private'>Privadas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.exercises} onValueChange={v => set({ exercises: (v ?? 'all') as ListFilters['exercises'] })}>
              <SelectTrigger className='h-9 w-[170px] text-xs'><SelectValue placeholder='Ejercicios' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Ejercicios: todas</SelectItem>
                <SelectItem value='with'>Con ejercicios</SelectItem>
                <SelectItem value='empty'>Vacías (0 ejercicios)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.sort} onValueChange={v => set({ sort: (v ?? 'recent') as ListSort })}>
              <SelectTrigger className='h-9 w-[190px] text-xs'><SelectValue placeholder='Ordenar' /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as ListSort[]).map(k => <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>

            <Button variant={filters.onlyDuplicates ? 'default' : 'outline'} size='sm' disabled={totalDuplicates === 0 && !filters.onlyDuplicates}
              onClick={() => set({ onlyDuplicates: !filters.onlyDuplicates })}>
              Solo duplicadas ({totalDuplicates})
            </Button>

            {activeFilters > 0 && (
              <Button variant='ghost' size='sm' onClick={() => setFilters(f => ({ ...DEFAULT_LIST_FILTERS, sort: f.sort }))}>
                <FilterXIcon className='mr-1 size-3.5' /> Limpiar
              </Button>
            )}

            <div className='ml-auto flex items-center gap-1'>
              <Button variant={mode === 'folders' ? 'default' : 'outline'} size='sm' onClick={() => setMode('folders')}>
                <FoldersIcon className='mr-1 size-3.5' /> Carpetas
              </Button>
              <Button variant={mode === 'flat' ? 'default' : 'outline'} size='sm' onClick={() => setMode('flat')}>
                <LayoutListIcon className='mr-1 size-3.5' /> Lista
              </Button>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
            <span>{visible.length === decorated.length ? `${decorated.length} plantillas` : `${visible.length} de ${decorated.length} plantillas`}</span>
            <span>{realFolders} {realFolders === 1 ? 'carpeta' : 'carpetas'}</span>
            {totalDuplicates > 0 && <span className='text-amber-600'>{totalDuplicates} duplicadas (mismo título, versión más antigua)</span>}
          </div>

          {selected.size > 0 && (
            <div className='flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm'>
              <span>{selected.size} seleccionadas</span>
              <Button variant='destructive' size='sm' onClick={() => setConfirmBulk(true)}><TrashIcon className='mr-1 size-3.5' /> Eliminar seleccionadas</Button>
              <Button variant='ghost' size='sm' onClick={() => setSelected(new Set())}>Deseleccionar</Button>
            </div>
          )}

          {loading ? (
            <div className='flex justify-center py-16'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : visible.length === 0 ? (
            <p className='py-16 text-center text-muted-foreground'>No se encontraron plantillas de entrenamiento.</p>
          ) : mode === 'flat' ? (
            <div className='rounded-md border'>
              <Table>
                {header}
                <TableBody>{visible.map(it => row(it, true))}</TableBody>
              </Table>
            </div>
          ) : (
            <div className='space-y-3'>
              {folders.map(folder => {
                const open = isOpen(folder.key)
                const ids = folder.items.map(i => i.id)
                const allSelected = ids.every(id => selected.has(id))
                const dupIds = folder.items.filter(i => i.isDuplicate).map(i => i.id)
                return (
                  <Collapsible key={folder.key} open={open} onOpenChange={() => toggleFolder(folder.key)}>
                    <div className='overflow-hidden rounded-xl border'>
                      <div className='flex flex-wrap items-center gap-2 bg-muted/40 px-3 py-2.5'>
                        <Checkbox checked={allSelected} onCheckedChange={c => setMany(ids, c === true)} className='cursor-pointer' />
                        <CollapsibleTrigger className='flex min-w-0 flex-1 items-center gap-2 text-left' disabled={autoOpen}>
                          {open ? <ChevronDownIcon className='size-4 shrink-0' /> : <ChevronRightIcon className='size-4 shrink-0' />}
                          {open ? <FolderOpenIcon className='size-4 shrink-0 text-primary' /> : <FolderIcon className='size-4 shrink-0 text-primary' />}
                          <span className='truncate font-medium'>{folder.name ?? LOOSE_FOLDER_LABEL}</span>
                        </CollapsibleTrigger>
                        <Badge variant='secondary'>{folder.items.length} {folder.items.length === 1 ? 'sesión' : 'sesiones'}</Badge>
                        {folder.weeks.length > 0 && <Badge variant='outline'>{weekRange(folder.weeks)}</Badge>}
                        {folder.name !== null && folder.distinctTitles !== folder.items.length && (
                          <Badge variant='outline'>{folder.distinctTitles} únicas</Badge>
                        )}
                        {folder.duplicates > 0 && (
                          <>
                            <Badge variant='outline' className='border-amber-500/60 text-amber-600'>{folder.duplicates} duplicadas</Badge>
                            <Button variant='ghost' size='sm' className='h-7 text-xs' onClick={() => setMany(dupIds, true)}>Seleccionar duplicadas</Button>
                          </>
                        )}
                      </div>
                      <CollapsibleContent>
                        <div className='space-y-3 p-3'>
                          {groupByWeek(folder.items).map(group => (
                            <div key={group.week ?? 'none'}>
                              {(folder.name !== null) && (
                                <p className='mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                                  {group.week != null ? `Semana ${group.week}` : 'Sin semana'}
                                </p>
                              )}
                              <div className='rounded-md border'>
                                <Table>
                                  {header}
                                  <TableBody>{group.items.map(it => row(it, folder.name === null))}</TableBody>
                                </Table>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar {selected.size} plantillas</DialogTitle></DialogHeader>
          <p className='text-sm text-muted-foreground'>
            Se eliminarán las {selected.size} plantillas seleccionadas (borrado lógico: se pueden recuperar desde la base de datos).
            Las plantillas que sigan asignadas a un día de programa no se ven en esta lista y no se tocan.
          </p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setConfirmBulk(false)} disabled={deleting}>Cancelar</Button>
            <Button variant='destructive' onClick={doBulkDelete} disabled={deleting}>{deleting ? 'Eliminando...' : 'Eliminar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
