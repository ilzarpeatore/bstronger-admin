import { useCallback, useEffect, useState } from 'react'

import { PencilIcon, RotateCcwIcon, ZapIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { setTrainingTechniquesCache, type TrainingTechnique } from '@/lib/trainingTechniques'

// Técnicas especiales: textos que ve el cliente en la app al pulsar la técnica
// (ficha con paso a paso). Backend: Bckbs App\Support\TrainingTechniques —
// GET admin/training-technique-list, POST admin/training-technique-save / -reset.
// Las técnicas (claves) son fijas; aquí solo se editan sus textos.

type Draft = { key: string; label: string; description: string; steps: string; mistakes: string; logging: string }

const toDraft = (t: TrainingTechnique): Draft => ({
  key: t.key,
  label: t.label,
  description: t.description,
  steps: (t.steps ?? []).join('\n'),
  mistakes: (t.mistakes ?? []).join('\n'),
  logging: t.logging ?? '',
})

const lines = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean)

export default function TrainingTechniquesView() {
  const [items, setItems] = useState<TrainingTechnique[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const apply = (list: TrainingTechnique[]) => {
    setItems(list)
    setTrainingTechniquesCache(list)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/training-technique-list')
      apply(Array.isArray(res?.data) ? res.data : [])
    } catch {
      toast.error('Error al cargar las técnicas especiales')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!draft) return
    if (!draft.label.trim() || !draft.description.trim()) {
      toast.error('El nombre y la descripción son obligatorios')
      return
    }
    setSaving(true)
    try {
      const res = await api.post('/admin/training-technique-save', {
        key: draft.key,
        label: draft.label.trim(),
        description: draft.description.trim(),
        steps: lines(draft.steps),
        mistakes: lines(draft.mistakes),
        logging: draft.logging.trim(),
      })
      apply(res.data ?? items)
      setDraft(null)
      toast.success('Técnica guardada. La app la mostrará así a partir de ahora.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const reset = async (key: string) => {
    setSaving(true)
    try {
      const res = await api.post('/admin/training-technique-reset', { key })
      apply(res.data ?? items)
      setDraft(null)
      toast.success('Texto original restaurado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo restaurar')
    } finally {
      setSaving(false)
    }
  }

  const editing = draft ? items.find(t => t.key === draft.key) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Técnicas especiales</h1>
        <p className="text-sm text-muted-foreground">
          Lo que ve el cliente en la app al pulsar la técnica de un ejercicio. Las técnicas se asignan en el editor de sesiones de cada
          programa; aquí se editan sus textos.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map(t => (
            <Card key={t.key}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ZapIcon className="size-4 fill-violet-500 text-violet-500" />
                  {t.label}
                  {t.customized && <Badge variant="secondary">Editado</Badge>}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setDraft(toDraft(t))}>
                  <PencilIcon className="mr-1 size-3" />
                  Editar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{t.description}</p>
                {(t.steps ?? []).length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Paso a paso</div>
                    <ol className="list-decimal space-y-0.5 pl-5">
                      {(t.steps ?? []).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {(t.mistakes ?? []).length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Evita</div>
                    <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                      {(t.mistakes ?? []).map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {t.logging && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Cómo apuntarlo: </span>
                    {t.logging}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={o => { if (!o) setDraft(null) }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar técnica</DialogTitle>
            <DialogDescription>Así la verá el cliente en la app. Una línea por paso y por error a evitar.</DialogDescription>
          </DialogHeader>
          {draft && (
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel>Nombre</FieldLabel>
                <Input value={draft.label} maxLength={60} onChange={e => setDraft({ ...draft, label: e.target.value })} />
              </Field>
              <Field className="gap-2">
                <FieldLabel>Qué es</FieldLabel>
                <Textarea rows={3} maxLength={600} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <Field className="gap-2">
                <FieldLabel>Paso a paso (una línea por paso)</FieldLabel>
                <Textarea rows={6} value={draft.steps} onChange={e => setDraft({ ...draft, steps: e.target.value })} />
              </Field>
              <Field className="gap-2">
                <FieldLabel>Evita (una línea por error o aviso)</FieldLabel>
                <Textarea rows={4} value={draft.mistakes} onChange={e => setDraft({ ...draft, mistakes: e.target.value })} />
              </Field>
              <Field className="gap-2">
                <FieldLabel>Cómo apuntarlo en la app</FieldLabel>
                <Textarea rows={2} maxLength={400} value={draft.logging} onChange={e => setDraft({ ...draft, logging: e.target.value })} />
              </Field>
            </FieldGroup>
          )}
          <DialogFooter className="gap-2">
            {editing?.customized && (
              <Button variant="outline" disabled={saving} onClick={() => draft && reset(draft.key)}>
                <RotateCcwIcon className="mr-1 size-3" />
                Restaurar texto original
              </Button>
            )}
            <Button variant="outline" disabled={saving} onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button disabled={saving} onClick={save}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
