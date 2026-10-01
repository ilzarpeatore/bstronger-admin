import { useEffect, useRef, useState } from 'react'
import { ImageUpIcon, Loader2Icon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import PackPreview from './PackPreview'
import {
  EMPTY_FORM,
  WEB_URL,
  formToPayload,
  packToForm,
  slugify,
  slugifyLive,
  uploadPackImage,
  type Option,
  type Pack,
  type PackForm,
} from './packs-api'

type Options = { programs: Option[]; mealPlans: Option[]; habits: Option[]; resources: Option[] }

type Props = {
  open: boolean
  pack: Pack | null
  options: Options
  onClose: () => void
  onSaved: () => void
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function CheckList({
  items,
  selected,
  empty,
  onChange,
}: {
  items: Option[]
  selected: number[]
  empty: string
  onChange: (ids: number[]) => void
}) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>
  return (
    <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-2">
      {items.map((item) => {
        const checked = selected.includes(item.id)
        return (
          <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => onChange(v ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
            />
            {item.title}
          </label>
        )
      })}
    </div>
  )
}

export default function PackEditor({ open, pack, options, onClose, onSaved }: Props) {
  const [form, setForm] = useState<PackForm>(EMPTY_FORM)
  const [slugEdited, setSlugEdited] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setForm(pack ? packToForm(pack) : EMPTY_FORM)
    // En un pack ya creado el enlace no cambia solo al renombrarlo: los
    // enlaces ya compartidos dejarían de funcionar.
    setSlugEdited(!!pack)
  }, [open, pack])

  const set = <K extends keyof PackForm>(key: K, value: PackForm[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  // Mientras se escribe se deja el guion final (si no, no se podría teclear
  // "gluteo-3"); al guardar y en el enlace se limpia del todo.
  const slugInput = slugEdited ? form.slug : slugify(form.name)
  const slug = slugify(slugInput)
  const link = `${WEB_URL}/packs/${slug || 'nombre-del-pack'}`

  const onPickImage = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede pasar de 5 MB')
      return
    }
    setUploading(true)
    try {
      set('image_url', await uploadPackImage(file))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async () => {
    if (!form.name.trim()) return toast.error('Ponle un nombre al pack')
    if (form.price === '' || Number(form.price) < 0) return toast.error('Indica el precio')
    if (form.sold_on_web && !form.training_program_id && !form.meal_plan_template_id && !form.habit_template_ids.length && !form.resource_ids.length) {
      return toast.error('Añade algún contenido antes de ponerlo a la venta')
    }

    setSaving(true)
    try {
      const payload = formToPayload({ ...form, slug }, slugEdited)
      if (pack) await api.put(`/admin/plans/${pack.id}`, payload)
      else await api.post('/admin/plans', payload)
      toast.success(pack ? 'Pack guardado' : 'Pack creado')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el pack')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[97vw]! max-w-6xl!">
        <DialogHeader>
          <DialogTitle>{pack ? `Editar «${pack.name}»` : 'Nuevo pack'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Section title="El pack">
              <div className="space-y-1.5">
                <Label htmlFor="pack-name">Nombre</Label>
                <Input id="pack-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Glúteo 3 meses" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pack-slug">Enlace</Label>
                <div className="flex items-center gap-1 text-sm">
                  <span className="shrink-0 text-muted-foreground">{WEB_URL}/packs/</span>
                  <Input
                    id="pack-slug"
                    value={slugInput}
                    onChange={(e) => {
                      setSlugEdited(true)
                      set('slug', slugifyLive(e.target.value))
                    }}
                    placeholder="gluteo-3-meses"
                  />
                </div>
                {pack && slug !== pack.slug ? (
                  <p className="text-xs text-amber-600">Si cambias el enlace, los que ya hayas compartido dejarán de funcionar.</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pack-short">Frase corta</Label>
                <Input
                  id="pack-short"
                  maxLength={255}
                  value={form.short_description}
                  onChange={(e) => set('short_description', e.target.value)}
                  placeholder="Programa progresivo para desarrollar glúteo, con nutrición incluida."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pack-desc">Descripción completa</Label>
                <Textarea
                  id="pack-desc"
                  rows={5}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Para quién es, qué vas a conseguir, cuántos días a la semana…"
                />
              </div>
            </Section>

            <Section title="Imagen" description="JPG, PNG o WebP, hasta 5 MB. Formato apaisado (16:10) queda mejor.">
              <div className="flex items-center gap-3">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="h-16 w-26 rounded-md object-cover" />
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0])}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2Icon className="size-4 animate-spin" /> : <ImageUpIcon className="size-4" />}
                  {form.image_url ? 'Cambiar imagen' : 'Subir imagen'}
                </Button>
                {form.image_url ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set('image_url', '')}>
                    <Trash2Icon className="size-4" /> Quitar
                  </Button>
                ) : null}
              </div>
            </Section>

            <Section title="Precio y duración" description="Pago único. La duración es lo que dura el programa en la app.">
              <div className="grid gap-3 sm:grid-cols-[1fr_110px_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor="pack-price">Precio</Label>
                  <Input id="pack-price" type="number" min={0} step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="49" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pack-currency">Moneda</Label>
                  <NativeSelect id="pack-currency" className="w-full" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                    <NativeSelectOption value="EUR">EUR (€)</NativeSelectOption>
                    <NativeSelectOption value="USD">USD ($)</NativeSelectOption>
                    <NativeSelectOption value="GBP">GBP (£)</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pack-duration">Duración</Label>
                  <div className="flex gap-2">
                    <Input id="pack-duration" type="number" min={1} className="w-20" value={form.duration} onChange={(e) => set('duration', e.target.value)} />
                    <NativeSelect className="w-full" value={form.duration_unit} onChange={(e) => set('duration_unit', e.target.value as PackForm['duration_unit'])}>
                      <NativeSelectOption value="week">semanas</NativeSelectOption>
                      <NativeSelectOption value="month">meses</NativeSelectOption>
                    </NativeSelect>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Contenido" description="Se asigna solo al cliente cuando termina el cuestionario inicial.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pack-program">Programa de entrenamiento</Label>
                  <NativeSelect id="pack-program" className="w-full" value={form.training_program_id} onChange={(e) => set('training_program_id', e.target.value)}>
                    <NativeSelectOption value="">— Ninguno —</NativeSelectOption>
                    {options.programs.map((o) => (
                      <NativeSelectOption key={o.id} value={String(o.id)}>{o.title}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pack-meal">Plan de nutrición</Label>
                  <NativeSelect id="pack-meal" className="w-full" value={form.meal_plan_template_id} onChange={(e) => set('meal_plan_template_id', e.target.value)}>
                    <NativeSelectOption value="">— Ninguno —</NativeSelectOption>
                    {options.mealPlans.map((o) => (
                      <NativeSelectOption key={o.id} value={String(o.id)}>{o.title}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label>Hábitos</Label>
                  <CheckList items={options.habits} selected={form.habit_template_ids} empty="No hay plantillas de hábitos" onChange={(ids) => set('habit_template_ids', ids)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Guías y recursos</Label>
                  <CheckList items={options.resources} selected={form.resource_ids} empty="No hay recursos" onChange={(ids) => set('resource_ids', ids)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.grants_full_workout_library} onCheckedChange={(v) => set('grants_full_workout_library', v)} />
                  Acceso a todos los entrenamientos
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.grants_full_recipe_library} onCheckedChange={(v) => set('grants_full_recipe_library', v)} />
                  Acceso a todas las recetas
                </label>
              </div>
            </Section>

            <Section title="Publicación">
              <label className="flex items-start gap-3 text-sm">
                <Switch className="mt-0.5" checked={form.sold_on_web} onCheckedChange={(v) => set('sold_on_web', v)} />
                <span>
                  <span className="font-medium">A la venta en la web</span>
                  <span className="block text-xs text-muted-foreground">Aparece en {WEB_URL}/packs y cualquiera puede comprarlo con el enlace.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Switch className="mt-0.5" checked={form.is_active} onCheckedChange={(v) => set('is_active', v)} />
                <span>
                  <span className="font-medium">Activo</span>
                  <span className="block text-xs text-muted-foreground">Desactívalo para retirarlo sin borrarlo; quien ya lo compró lo conserva.</span>
                </span>
              </label>
            </Section>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
            <p className="text-sm font-semibold">Vista previa en la web</p>
            <PackPreview form={form} />
            <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">{link}</p>
          </aside>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || uploading}>
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {pack ? 'Guardar cambios' : 'Crear pack'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
