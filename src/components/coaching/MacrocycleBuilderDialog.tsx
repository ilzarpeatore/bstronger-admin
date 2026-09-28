import { useMemo, useState } from 'react'
import { XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { fuzzyMatch } from '@/lib/textSearch'

// Forma un macrociclo con los mesociclos (programas) que el coach elige a mano.
// POST /admin/training-program-set-macrocycle-bulk (Bckbs TrainingProgramController::setMacrocycleBulk):
// mismo nombre en todos y un nº de mesociclo por programa. Nada se deduce del título.

export type BuilderProgram = {
  id: number
  title: string
  clientName: string | null
  numWeeks: number | null
  /** Macrociclo en el que ya está (asignado a mano), si lo hay. */
  currentMacrocycle: string | null
  currentMesocycle: number | null
  /** Nº de mesociclo que insinúa el título («Mesociclo 2», «M2»); solo prerrellena el número. */
  suggestedMesocycle: number | null
}

export type BuilderSelection = { id: number; mesocycleNumber: string }

export type BulkPayload = {
  macrocycle_name: string
  items: { id: number; mesocycle_number: number | null }[]
}

/** El nº preferido si está libre; si no, el siguiente hueco por encima del mayor usado. */
export function nextMesocycleNumber(used: number[], preferred: number | null): number {
  if (preferred != null && preferred > 0 && !used.includes(preferred)) return preferred
  return used.length === 0 ? 1 : Math.max(...used) + 1
}

/** Selección ordenada por nº de mesociclo (los sin número al final, en el orden en que se eligieron). */
export function sortSelection(selection: BuilderSelection[]): BuilderSelection[] {
  const num = (s: BuilderSelection) => (s.mesocycleNumber.trim() === '' ? Number.POSITIVE_INFINITY : Number(s.mesocycleNumber))
  return selection
    .map((s, i) => ({ s, i }))
    .sort((a, b) => num(a.s) - num(b.s) || a.i - b.i)
    .map((x) => x.s)
}

export function bulkPayload(name: string, selection: BuilderSelection[]): BulkPayload {
  return {
    macrocycle_name: name.trim(),
    items: sortSelection(selection).map((s) => ({
      id: s.id,
      mesocycle_number: s.mesocycleNumber.trim() === '' ? null : Number(s.mesocycleNumber),
    })),
  }
}

type Props = {
  programs: BuilderProgram[]
  /** Macrociclos existentes: nombre y nºs de mesociclo ya usados (para continuar la numeración). */
  existing: { name: string; mesocycles: number[] }[]
  /** Nombre con el que se abre (p. ej. «Añadir mesociclo» desde un macrociclo). */
  initialName?: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export default function MacrocycleBuilderDialog({ programs, existing, initialName = '', onClose, onSaved }: Props) {
  const [name, setName] = useState(initialName)
  const [search, setSearch] = useState('')
  const [onlyFree, setOnlyFree] = useState(true)
  const [selection, setSelection] = useState<BuilderSelection[]>([])
  const [saving, setSaving] = useState(false)

  const byId = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs])
  const existingNumbers = useMemo(() => {
    const found = existing.find((g) => g.name.trim().toLowerCase() === name.trim().toLowerCase())
    return found?.mesocycles ?? []
  }, [existing, name])
  const existingNames = useMemo(() => Array.from(new Set(existing.map((g) => g.name))).sort(), [existing])

  const visible = useMemo(
    () =>
      programs
        .filter((p) => !onlyFree || !p.currentMacrocycle || selection.some((s) => s.id === p.id))
        .filter((p) => !search.trim() || fuzzyMatch(search, p.title, p.clientName, p.currentMacrocycle))
        .slice(0, 80),
    [programs, onlyFree, search, selection],
  )

  const toggle = (program: BuilderProgram, checked: boolean) => {
    setSelection((prev) => {
      if (!checked) return prev.filter((s) => s.id !== program.id)
      if (prev.some((s) => s.id === program.id)) return prev
      const used = [...existingNumbers, ...prev.map((s) => Number(s.mesocycleNumber)).filter((n) => Number.isFinite(n) && n > 0)]
      return [...prev, { id: program.id, mesocycleNumber: String(nextMesocycleNumber(used, program.suggestedMesocycle)) }]
    })
  }

  const setNumber = (id: number, value: string) =>
    setSelection((prev) => prev.map((s) => (s.id === id ? { ...s, mesocycleNumber: value.replace(/[^0-9]/g, '') } : s)))

  const sorted = sortSelection(selection)
  const canSave = name.trim() !== '' && selection.length > 0 && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await api.post('/admin/training-program-set-macrocycle-bulk', bulkPayload(name, selection))
      toast.success(`Macrociclo «${name.trim()}» guardado con ${selection.length} ${selection.length === 1 ? 'mesociclo' : 'mesociclos'}`)
      await onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el macrociclo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[97vw]! max-w-3xl! overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Formar un macrociclo</DialogTitle>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <Field className="gap-2">
            <FieldLabel htmlFor="macrocycle-builder-name">Nombre del macrociclo</FieldLabel>
            <Input
              id="macrocycle-builder-name"
              list="macrocycle-builder-names"
              placeholder="Nombre nuevo, o el de uno existente para añadirle mesociclos"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <datalist id="macrocycle-builder-names">
              {existingNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>

          <Field className="gap-2">
            <FieldLabel htmlFor="macrocycle-builder-search">Mesociclos que lo forman</FieldLabel>
            <Input
              id="macrocycle-builder-search"
              placeholder="Buscar programa por título o cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={onlyFree} onCheckedChange={(v) => setOnlyFree(v === true)} />
              Ocultar los que ya están en un macrociclo
            </label>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              {visible.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Ningún programa coincide.</p>
              ) : (
                visible.map((p) => {
                  const checked = selection.some((s) => s.id === p.id)
                  return (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-start gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={checked}
                        onCheckedChange={(v) => toggle(p, v === true)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{p.title}</span>
                        <span className="block text-muted-foreground">
                          {p.clientName ?? 'Biblioteca'}
                          {p.numWeeks ? ` · ${p.numWeeks} sem.` : ''}
                          {p.currentMacrocycle ? ` · ahora en «${p.currentMacrocycle}»` : ''}
                        </span>
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </Field>

          <Field className="gap-2">
            <FieldLabel>
              Seleccionados <Badge variant="secondary">{selection.length}</Badge>
            </FieldLabel>
            {selection.length === 0 ? (
              <p className="text-sm text-muted-foreground">Marca arriba los programas que forman este macrociclo.</p>
            ) : (
              <div className="space-y-2">
                {sorted.map((s) => {
                  const p = byId.get(s.id)
                  return (
                    <div key={s.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <span className="text-muted-foreground">M</span>
                      <Input
                        className="w-16"
                        inputMode="numeric"
                        aria-label={`Número de mesociclo de ${p?.title ?? s.id}`}
                        value={s.mesocycleNumber}
                        onChange={(e) => setNumber(s.id, e.target.value)}
                      />
                      <span className="min-w-0 flex-1 truncate">{p?.title ?? `Programa #${s.id}`}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Quitar de la selección"
                        onClick={() => setSelection((prev) => prev.filter((x) => x.id !== s.id))}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </div>
                  )
                })}
                <p className="text-xs text-muted-foreground">
                  El número ordena los mesociclos dentro del macrociclo (M1, M2…). No cambia el título del programa ni lo que ve el
                  cliente. Los mesociclos de un cliente se muestran aparte de los de la biblioteca aunque el macrociclo se llame igual.
                </p>
              </div>
            )}
          </Field>
        </FieldGroup>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {saving ? 'Guardando…' : 'Guardar macrociclo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
