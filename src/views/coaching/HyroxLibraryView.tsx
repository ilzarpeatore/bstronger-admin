import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertTriangleIcon, CopyPlusIcon, FlagIcon, RefreshCwIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { blockKindSummary } from '@/lib/blockKinds'
import { divisionLoadsSummary, groupByCategory, normalizeHyroxLibrary, type HyroxLibrary, type HyroxLibraryTemplate } from '@/lib/hyroxLibrary'

/**
 * Biblioteca Hyrox (fase 2, 2.2): plantillas de solo lectura (simulacros,
 * compromised running, EMOM de estaciones, series de carrera y tests). El
 * coach elige división y crea una copia suya, editable y asignable, con
 * las cargas oficiales de esa división.
 */
export default function HyroxLibraryView() {
  const navigate = useNavigate()
  const [division, setDivision] = useState('open_m')
  const [lib, setLib] = useState<HyroxLibrary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'unavailable' | 'failed' | null>(null)
  const [creating, setCreating] = useState<HyroxLibraryTemplate | null>(null)
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchLib = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setLib(normalizeHyroxLibrary(await api.get(`/admin/hyrox-library?division=${division}`)))
    } catch (err) {
      setLib(null)
      setError(err instanceof ApiError && (err.status === 404 || err.status === 405) ? 'unavailable' : 'failed')
    } finally {
      setLoading(false)
    }
  }, [division])

  useEffect(() => { fetchLib() }, [fetchLib])

  const groups = useMemo(() => groupByCategory(lib?.templates ?? []), [lib])
  const currentDivision = lib?.divisions.find(d => d.key === division) ?? null

  const openCreate = (t: HyroxLibraryTemplate) => {
    setCreating(t)
    setTitle(`${t.title} · ${currentDivision?.label ?? ''}`.replace(/ · $/, ''))
  }

  const handleCreate = async () => {
    if (!creating) return
    setSubmitting(true)
    try {
      const res = await api.post<{ data?: { id?: number } }>('/admin/hyrox-library/instantiate', { key: creating.key, division, title: title.trim() || undefined })
      const id = res?.data?.id
      toast.success('Plantilla creada en tus plantillas de entrenamiento')
      setCreating(null)
      if (id) navigate(`/workout-templates/${id}`)
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo crear la plantilla')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='space-y-3'>
          <div>
            <CardTitle className='flex items-center gap-2'><FlagIcon className='size-5' /> Biblioteca Hyrox</CardTitle>
            <CardDescription>
              Plantillas listas para usar. Elige la división y pulsa «Crear plantilla»: se copia en tus plantillas de entrenamiento con las cargas oficiales (temporada 2025/26) y la puedes editar y asignar como cualquier otra.
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-1.5'>
            {(lib?.divisions ?? []).map(d => (
              <button
                key={d.key}
                type='button'
                onClick={() => setDivision(d.key)}
                className={cn('rounded-full border px-3 py-1 text-xs transition-colors', division === d.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}
              >
                {d.label}
              </button>
            ))}
          </div>
          {currentDivision && (
            <div className='flex flex-wrap gap-1.5 text-xs text-muted-foreground'>
              {divisionLoadsSummary(currentDivision).map(t => <span key={t} className='rounded-md bg-muted px-2 py-0.5'>{t}</span>)}
              {currentDivision.doubles && <span className='rounded-md bg-muted px-2 py-0.5'>Dobles: estaciones repartidas, carreras juntos</span>}
            </div>
          )}
        </CardHeader>
      </Card>

      {lib && !lib.ready && (
        <div className='flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'>
          <AlertTriangleIcon className='size-4 mt-0.5 shrink-0' />
          <div>
            Faltan ejercicios Hyrox en el catálogo ({lib.missing_exercises.join(', ')}). Hay que ejecutar <span className='font-mono'>php artisan hyrox:catalogo</span> en el servidor; hasta entonces no se pueden crear plantillas.
          </div>
        </div>
      )}

      {loading ? (
        <div className='flex justify-center py-12'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
      ) : error ? (
        <Card>
          <CardContent className='py-12 text-center text-sm text-muted-foreground'>
            {error === 'unavailable' ? (
              'La biblioteca Hyrox todavía no está disponible en el servidor.'
            ) : (
              <>
                <p>No se pudo cargar la biblioteca.</p>
                <Button variant='outline' size='sm' className='mt-3 gap-1' onClick={fetchLib}><RefreshCwIcon className='size-3.5' /> Reintentar</Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        groups.map(g => (
          <section key={g.category} className='space-y-2'>
            <h2 className='text-sm font-semibold text-muted-foreground'>{g.label}</h2>
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {g.items.map(t => (
                <Card key={t.key} className='flex flex-col'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-base'>{t.title}</CardTitle>
                    <CardDescription className='text-xs'>{t.description}</CardDescription>
                  </CardHeader>
                  <CardContent className='flex flex-1 flex-col gap-3'>
                    {t.blocks.map((b, i) => (
                      <div key={i} className='space-y-1'>
                        <div className='flex flex-wrap items-center gap-1.5'>
                          <Badge variant='secondary'>{blockKindSummary(b.kind, b.params, b.steps.length) ?? b.title}</Badge>
                          {b.params?.benchmark_key && <span className='font-mono text-[10px] text-muted-foreground'>{b.params.benchmark_key}</span>}
                        </div>
                        <ol className='list-decimal pl-5 text-xs text-muted-foreground space-y-0.5'>
                          {b.steps.map((s, j) => <li key={j}>{s}</li>)}
                        </ol>
                      </div>
                    ))}
                    <div className='mt-auto pt-1'>
                      <Button size='sm' className='w-full gap-1' disabled={!lib?.ready} onClick={() => openCreate(t)}>
                        <CopyPlusIcon className='size-4' /> Crear plantilla
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      <Dialog open={creating !== null} onOpenChange={open => { if (!open) setCreating(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear plantilla</DialogTitle></DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor='hyrox-title'>Nombre</FieldLabel>
              <Input id='hyrox-title' value={title} maxLength={190} onChange={e => setTitle(e.target.value)} />
            </Field>
            <p className='text-xs text-muted-foreground'>División: {currentDivision?.label ?? division}. Después podrás cambiar cargas, distancias y orden en el editor.</p>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreating(null)} disabled={submitting}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={submitting}>{submitting ? 'Creando…' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
