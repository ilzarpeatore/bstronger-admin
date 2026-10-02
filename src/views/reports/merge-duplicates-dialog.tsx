import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isConfidentMatch } from './payment-client-utils'

type Candidate = { id: number; name: string; email: string | null; is_personal_client: boolean; score: number }
type ExternalWithCandidates = {
  id: number
  name: string
  email: string | null
  monthly_fee: number
  payments_count: number
  candidates: Candidate[]
}
type AppUser = { id: number; first_name?: string; last_name?: string; display_name?: string | null; name?: string; email?: string }

const userName = (u: AppUser) => u.display_name || u.name || `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()

// Revisa los clientes no registrados que en realidad ya tienen cuenta en la
// app (p. ej. "Hamza Bilbao" = "Hamsa Dris Bakkali") y los fusiona: sus
// pagos pasan al usuario real y el cliente externo desaparece.
export default function MergeDuplicatesDialog({ open, onOpenChange, onMerged }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMerged: (merged: number) => void
}) {
  const [rows, setRows] = useState<ExternalWithCandidates[] | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [targets, setTargets] = useState<Record<number, string>>({})
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setRows(null)
    setError(null)
    api.get('/admin/subscription-payments/merge-candidates').then((res) => {
      const list: ExternalWithCandidates[] = res.data ?? []
      setRows(list)
      setTargets(Object.fromEntries(list.map((r) => [r.id, r.candidates[0] ? String(r.candidates[0].id) : ''])))
      setSelected(Object.fromEntries(list.map((r) => [r.id, !!r.candidates[0] && isConfidentMatch(r.name, r.candidates[0].name)])))
    }).catch(() => setError('No se pudieron cargar los clientes no registrados.'))
    api.get('/admin/users?per_page=500').then((res) => {
      const list: AppUser[] = res.data?.data || res.data || []
      setUsers([...list].sort((a, b) => userName(a).localeCompare(userName(b), 'es')))
    }).catch(() => {})
  }, [open])

  const usersById = useMemo(() => new Map(users.map((u) => [String(u.id), userName(u)])), [users])
  const toMerge = (rows ?? []).filter((r) => selected[r.id] && targets[r.id])

  const handleMerge = async () => {
    setRunning(true)
    setError(null)
    let merged = 0
    try {
      for (const row of toMerge) {
        await api.post(`/admin/subscription-payments/external/${row.id}/merge`, { user_id: Number(targets[row.id]) })
        merged++
      }
      onMerged(merged)
      onOpenChange(false)
    } catch (e) {
      setError(`Se fusionaron ${merged} y falló el siguiente: ${e instanceof Error ? e.message : 'error desconocido'}.`)
    } finally {
      setRunning(false)
    }
  }

  const labelFor = (row: ExternalWithCandidates, value: string) =>
    row.candidates.find((c) => String(c.id) === value)?.name ?? usersById.get(value) ?? 'Elegir usuario...'

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="sm:max-w-3xl!">
        <DialogHeader>
          <DialogTitle>Revisar duplicados</DialogTitle>
          <DialogDescription>
            Clientes no registrados que coinciden con un usuario de la app. Al fusionar, sus pagos pasan al usuario real (si el usuario ya tenía ese mes pagado, se mantiene el suyo) y el duplicado se elimina.
          </DialogDescription>
        </DialogHeader>

        {!rows && !error ? (
          <div className="h-40 bg-muted/50 animate-pulse flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Buscando coincidencias...</span>
          </div>
        ) : rows && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No hay clientes no registrados.</p>
        ) : rows && (
          <div className="max-h-[55vh] overflow-auto border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2 text-left font-medium">No registrado</th>
                  <th className="px-3 py-2 text-left font-medium">Usuario real</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const suggested = new Set(row.candidates.map((c) => String(c.id)))
                  return (
                    <tr key={row.id} className="border-t border-border/50 align-top">
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={!!selected[row.id]}
                          disabled={running || !targets[row.id]}
                          onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [row.id]: !!v }))}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.payments_count} pagos registrados</p>
                      </td>
                      <td className="px-3 py-2 min-w-[280px]">
                        <Select
                          value={targets[row.id] ?? ''}
                          onValueChange={(v) => {
                            if (!v) return
                            setTargets((prev) => ({ ...prev, [row.id]: v }))
                            setSelected((prev) => ({ ...prev, [row.id]: true }))
                          }}
                          disabled={running}
                        >
                          <SelectTrigger className="w-full cursor-pointer">
                            <SelectValue placeholder="Sin coincidencia · elegir usuario">
                              {(value: string) => value
                                ? <span className="flex items-center gap-1.5">{labelFor(row, value)}{suggested.has(value) && <Badge variant="secondary" className="text-[10px]">sugerido</Badge>}</span>
                                : 'Sin coincidencia · elegir usuario'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {row.candidates.map((c) => (
                              <SelectItem key={`s-${c.id}`} value={String(c.id)}>
                                {c.name} · sugerido{c.email ? ` (${c.email})` : ''}
                              </SelectItem>
                            ))}
                            {users.filter((u) => !suggested.has(String(u.id))).map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>{userName(u)}{u.email ? ` (${u.email})` : ''}</SelectItem>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running} className="cursor-pointer">Cancelar</Button>
          <Button onClick={handleMerge} disabled={running || toMerge.length === 0} className="cursor-pointer">
            {running ? 'Fusionando...' : `Fusionar ${toMerge.length} seleccionados`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
