import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpenIcon,
  CheckIcon,
  CopyIcon,
  DumbbellIcon,
  ImageUpIcon,
  ListChecksIcon,
  Loader2Icon,
  PackageOpenIcon,
  RotateCcwIcon,
  SaladIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import PackPreview, { type PreviewMode } from './PackPreview'
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

type Status = 'draft' | 'live' | 'inactive'

const STEPS = [
  { id: 'info', label: 'Información' },
  { id: 'image', label: 'Imagen' },
  { id: 'content', label: 'Contenido' },
  { id: 'price', label: 'Precio y duración' },
  { id: 'publish', label: 'Publicación' },
] as const

type StepId = (typeof STEPS)[number]['id']

const DURATION_PRESETS: { label: string; duration: string; unit: PackForm['duration_unit'] }[] = [
  { label: '4 semanas', duration: '4', unit: 'week' },
  { label: '8 semanas', duration: '8', unit: 'week' },
  { label: '12 semanas', duration: '12', unit: 'week' },
  { label: '3 meses', duration: '3', unit: 'month' },
  { label: '6 meses', duration: '6', unit: 'month' },
]

const CURRENCY_SYMBOL: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' }

const SHORT_DESC_TARGET = 140

function statusOf(f: PackForm): Status {
  if (!f.is_active) return 'inactive'
  return f.sold_on_web ? 'live' : 'draft'
}

function withStatus(f: PackForm, s: Status): PackForm {
  return { ...f, is_active: s !== 'inactive', sold_on_web: s === 'live' }
}

// ─── Piezas de presentación ──────────────────────────────────────────

function SectionHeader({ index, title, description, done }: { index: number; title: string; description?: string; done: boolean }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          done ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground',
        )}
      >
        {done ? <CheckIcon className="size-3.5" /> : index}
      </span>
      <div>
        <h3 className="text-[15px] font-semibold leading-6">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  )
}

function FieldHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-xs text-muted-foreground', className)}>{children}</p>
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-lg bg-muted p-0.5', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ChipPicker({ items, selected, empty, onChange }: { items: Option[]; selected: number[]; empty: string; onChange: (ids: number[]) => void }) {
  if (items.length === 0) return <FieldHint>{empty}</FieldHint>
  return (
    <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
      {items.map((item) => {
        const on = selected.includes(item.id)
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((id) => id !== item.id) : [...selected, item.id])}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
              on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
            )}
          >
            {on ? <CheckIcon className="size-3" /> : null}
            {item.title}
          </button>
        )
      })}
    </div>
  )
}

function ContentCard({
  icon: Icon,
  title,
  meta,
  active,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  meta?: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border p-3.5 transition-colors', active ? 'border-primary/40 bg-primary/[0.03]' : 'bg-background')}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className={cn('flex size-7 items-center justify-center rounded-lg', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
          <Icon className="size-4" />
        </span>
        <span className="text-sm font-medium">{title}</span>
        {meta ? <span className="ml-auto text-xs text-muted-foreground">{meta}</span> : null}
      </div>
      {children}
    </div>
  )
}

const STATUS_OPTIONS: { value: Status; title: string; description: string; dot: string }[] = [
  { value: 'draft', title: 'Borrador', description: 'No aparece en la web. Puedes prepararlo con calma.', dot: 'bg-amber-500' },
  { value: 'live', title: 'A la venta', description: 'Visible en la web y se puede comprar con su enlace.', dot: 'bg-emerald-500' },
  { value: 'inactive', title: 'Retirado', description: 'Ya no se vende. Quien lo compró lo conserva.', dot: 'bg-neutral-400' },
]

// ─── Editor ──────────────────────────────────────────────────────────

export default function PackEditor({ open, pack, options, onClose, onSaved }: Props) {
  const [form, setForm] = useState<PackForm>(EMPTY_FORM)
  const [initial, setInitial] = useState<PackForm>(EMPTY_FORM)
  const [slugEdited, setSlugEdited] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('card')
  const [activeStep, setActiveStep] = useState<StepId>('info')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Partial<Record<StepId, HTMLElement | null>>>({})

  useEffect(() => {
    if (!open) return
    const start = pack ? packToForm(pack) : EMPTY_FORM
    setForm(start)
    setInitial(start)
    // En un pack ya creado el enlace no cambia solo al renombrarlo: los
    // enlaces ya compartidos dejarían de funcionar.
    setSlugEdited(!!pack)
    setActiveStep('info')
    setPreviewMode('card')
    scrollRef.current?.scrollTo({ top: 0 })
  }, [open, pack])

  const set = <K extends keyof PackForm>(key: K, value: PackForm[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  // Mientras se escribe se deja el guion final (si no, no se podría teclear
  // "gluteo-3"); al guardar y en el enlace se limpia del todo.
  const slugInput = slugEdited ? form.slug : slugify(form.name)
  const slug = slugify(slugInput)
  const link = `${WEB_URL}/packs/${slug || 'nombre-del-pack'}`
  const status = statusOf(form)
  const symbol = CURRENCY_SYMBOL[form.currency] ?? form.currency
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial])

  const hasContent =
    !!form.training_program_id || !!form.meal_plan_template_id || form.habit_template_ids.length > 0 || form.resource_ids.length > 0
  const done: Record<StepId, boolean> = {
    info: !!form.name.trim() && !!form.short_description.trim(),
    image: !!form.image_url,
    content: hasContent,
    price: form.price !== '' && Number(form.price) > 0 && (parseInt(form.duration, 10) || 0) > 0,
    publish: status === 'live',
  }

  // Lo imprescindible para guardar, y lo que además hace falta para venderlo.
  const blockers = [
    !form.name.trim() && 'nombre',
    (form.price === '' || Number(form.price) < 0) && 'precio',
  ].filter(Boolean) as string[]
  const publishBlockers = [
    ...blockers,
    form.price !== '' && Number(form.price) === 0 && 'un precio mayor que 0',
    !hasContent && 'algún contenido',
  ].filter(Boolean) as string[]
  const recommended = [!form.image_url && 'imagen', !form.short_description.trim() && 'frase corta'].filter(Boolean) as string[]
  const missing = status === 'live' ? publishBlockers : blockers
  const canSave = missing.length === 0 && !saving && !uploading

  const scrollTo = (id: StepId) => {
    setActiveStep(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Paso activo según el scroll del formulario.
  const onScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const top = container.getBoundingClientRect().top + 96
    let current: StepId = 'info'
    for (const step of STEPS) {
      const el = sectionRefs.current[step.id]
      if (el && el.getBoundingClientRect().top <= top) current = step.id
    }
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 4) current = 'publish'
    setActiveStep(current)
  }, [])

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error('Usa una imagen JPG, PNG o WebP')
      return
    }
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

  const save = useCallback(async () => {
    if (!canSave) {
      if (missing.length) toast.error(`Falta: ${missing.join(', ')}`)
      return
    }
    setSaving(true)
    try {
      const payload = formToPayload({ ...form, slug }, slugEdited)
      if (pack) await api.put(`/admin/plans/${pack.id}`, payload)
      else await api.post('/admin/plans', payload)
      toast.success(
        status === 'live'
          ? pack ? 'Cambios publicados' : 'Pack publicado en la web'
          : pack ? 'Cambios guardados' : 'Pack guardado como borrador',
      )
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el pack')
    } finally {
      setSaving(false)
    }
  }, [canSave, missing, form, slug, slugEdited, pack, status, onSaved])

  // Ctrl/Cmd + S guarda.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, save])

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose())

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Enlace copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const primaryLabel = pack
    ? status === 'live' && statusOf(initial) !== 'live'
      ? 'Guardar y publicar'
      : 'Guardar cambios'
    : status === 'live'
      ? 'Crear y publicar'
      : 'Guardar borrador'

  const statusBadge = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0]

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent showCloseButton={false} className="flex! h-[92vh] w-[97vw]! max-w-7xl! flex-col gap-0! overflow-hidden p-0!">
          {/* Cabecera */}
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PackageOpenIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base font-semibold">
                {form.name.trim() || (pack ? pack.name : 'Nuevo pack')}
              </DialogTitle>
              <DialogDescription className="truncate text-xs">
                {pack ? 'Editando pack' : 'Pago único · se vende en la web y llega solo a la app'}
              </DialogDescription>
            </div>
            {dirty ? <span className="hidden text-xs text-muted-foreground sm:inline">Cambios sin guardar</span> : null}
            <Badge variant="outline" className="gap-1.5">
              <span className={cn('size-1.5 rounded-full', statusBadge.dot)} />
              {statusBadge.title}
            </Badge>
            <Button variant="ghost" size="icon-sm" onClick={requestClose} aria-label="Cerrar">
              <XIcon className="size-4" />
            </Button>
          </div>

          {/* Cuerpo */}
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex min-h-0 flex-col">
              {/* Pasos */}
              <nav className="flex gap-1 overflow-x-auto border-b px-4 py-2" aria-label="Secciones">
                {STEPS.map((step, i) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => scrollTo(step.id)}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      activeStep === step.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-full text-[10px]',
                        done[step.id] ? 'bg-emerald-600 text-white' : 'border border-current',
                      )}
                    >
                      {done[step.id] ? <CheckIcon className="size-2.5" /> : i + 1}
                    </span>
                    {step.label}
                  </button>
                ))}
              </nav>

              <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl space-y-10 px-6 pt-6 pb-24">
                  {/* 1. Información */}
                  <section ref={(el) => { sectionRefs.current.info = el }} className="scroll-mt-4">
                    <SectionHeader index={1} title="Información" description="Lo primero que verá el comprador." done={done.info} />
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="pack-name">Nombre del pack</Label>
                        <Input id="pack-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Glúteo 3 meses" className="h-10 text-base" />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="pack-slug">Enlace</Label>
                          {slugEdited && !pack && slug !== slugify(form.name) ? (
                            <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setSlugEdited(false)}>
                              <RotateCcwIcon className="size-3" /> Usar el nombre
                            </button>
                          ) : null}
                        </div>
                        <div className="flex h-9 items-center overflow-hidden rounded-lg border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                          <span className="flex h-full shrink-0 items-center border-r bg-muted px-3 text-xs text-muted-foreground">
                            {WEB_URL.replace(/^https?:\/\//, '')}/packs/
                          </span>
                          <input
                            id="pack-slug"
                            className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                            value={slugInput}
                            onChange={(e) => {
                              setSlugEdited(true)
                              set('slug', slugifyLive(e.target.value))
                            }}
                            placeholder="gluteo-3-meses"
                          />
                          <button type="button" onClick={copyLink} className="flex h-full items-center border-l px-3 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Copiar enlace">
                            <CopyIcon className="size-3.5" />
                          </button>
                        </div>
                        {pack && slug !== pack.slug ? (
                          <FieldHint className="text-amber-600">Al cambiar el enlace, los que ya hayas compartido dejarán de funcionar.</FieldHint>
                        ) : (
                          <FieldHint>Se crea a partir del nombre. Es el que compartirás en redes o por WhatsApp.</FieldHint>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="pack-short">Frase corta</Label>
                          <span className={cn('text-xs tabular-nums', form.short_description.length > SHORT_DESC_TARGET ? 'text-amber-600' : 'text-muted-foreground')}>
                            {form.short_description.length}/{SHORT_DESC_TARGET}
                          </span>
                        </div>
                        <Input
                          id="pack-short"
                          maxLength={255}
                          value={form.short_description}
                          onChange={(e) => set('short_description', e.target.value)}
                          placeholder="Programa progresivo para desarrollar glúteo, con nutrición incluida."
                        />
                        <FieldHint>Aparece en la tarjeta del catálogo. Mejor una sola frase.</FieldHint>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="pack-desc">Descripción completa</Label>
                        <Textarea
                          id="pack-desc"
                          rows={6}
                          value={form.description}
                          onChange={(e) => set('description', e.target.value)}
                          placeholder={'Para quién es, qué vas a conseguir, cuántos días a la semana se entrena…\n\nDeja una línea en blanco entre párrafos.'}
                        />
                      </div>
                    </div>
                  </section>

                  {/* 2. Imagen */}
                  <section ref={(el) => { sectionRefs.current.image = el }} className="scroll-mt-4">
                    <SectionHeader index={2} title="Imagen" description="JPG, PNG o WebP, hasta 5 MB. Apaisada (16:10) queda mejor." done={done.image} />
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(true)
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOver(false)
                        handleFile(e.dataTransfer.files?.[0])
                      }}
                      className={cn(
                        'group relative aspect-[16/10] w-full max-w-md overflow-hidden rounded-xl border-2 transition-colors',
                        form.image_url ? 'border-transparent' : 'border-dashed',
                        dragOver ? 'border-primary bg-primary/5' : !form.image_url && 'border-border',
                      )}
                    >
                      {form.image_url ? (
                        <>
                          <img src={form.image_url} alt="" className="size-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                              <ImageUpIcon className="size-4" /> Cambiar
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => set('image_url', '')}>
                              <Trash2Icon className="size-4" /> Quitar
                            </Button>
                          </div>
                        </>
                      ) : (
                        <button type="button" onClick={() => fileRef.current?.click()} className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/50">
                          {uploading ? <Loader2Icon className="size-6 animate-spin" /> : <ImageUpIcon className="size-6" />}
                          <span className="text-sm font-medium text-foreground">{uploading ? 'Subiendo…' : 'Arrastra una imagen o haz clic'}</span>
                          <span className="text-xs">Recomendado: 1600 × 1000 px</span>
                        </button>
                      )}
                      {uploading && form.image_url ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                          <Loader2Icon className="size-6 animate-spin" />
                        </div>
                      ) : null}
                    </div>
                  </section>

                  {/* 3. Contenido */}
                  <section ref={(el) => { sectionRefs.current.content = el }} className="scroll-mt-4">
                    <SectionHeader index={3} title="Contenido" description="Se asigna solo al cliente cuando termina el cuestionario inicial de la app." done={done.content} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ContentCard icon={DumbbellIcon} title="Entrenamiento" active={!!form.training_program_id}>
                        <NativeSelect className="w-full" value={form.training_program_id} onChange={(e) => set('training_program_id', e.target.value)} aria-label="Programa de entrenamiento">
                          <NativeSelectOption value="">Sin programa</NativeSelectOption>
                          {options.programs.map((o) => (
                            <NativeSelectOption key={o.id} value={String(o.id)}>{o.title}</NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </ContentCard>
                      <ContentCard icon={SaladIcon} title="Nutrición" active={!!form.meal_plan_template_id}>
                        <NativeSelect className="w-full" value={form.meal_plan_template_id} onChange={(e) => set('meal_plan_template_id', e.target.value)} aria-label="Plan de nutrición">
                          <NativeSelectOption value="">Sin plan de nutrición</NativeSelectOption>
                          {options.mealPlans.map((o) => (
                            <NativeSelectOption key={o.id} value={String(o.id)}>{o.title}</NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </ContentCard>
                      <ContentCard
                        icon={ListChecksIcon}
                        title="Hábitos"
                        meta={form.habit_template_ids.length ? `${form.habit_template_ids.length} elegidos` : undefined}
                        active={form.habit_template_ids.length > 0}
                      >
                        <ChipPicker items={options.habits} selected={form.habit_template_ids} empty="No hay plantillas de hábitos." onChange={(ids) => set('habit_template_ids', ids)} />
                      </ContentCard>
                      <ContentCard
                        icon={BookOpenIcon}
                        title="Guías y recursos"
                        meta={form.resource_ids.length ? `${form.resource_ids.length} elegidos` : undefined}
                        active={form.resource_ids.length > 0}
                      >
                        <ChipPicker items={options.resources} selected={form.resource_ids} empty="No hay recursos." onChange={(ids) => set('resource_ids', ids)} />
                      </ContentCard>
                    </div>
                    <div className="mt-3 divide-y rounded-xl border">
                      <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                        <span>
                          <span className="block text-sm font-medium">Biblioteca completa de entrenamientos</span>
                          <FieldHint>Desbloquea también todos los entrenamientos premium.</FieldHint>
                        </span>
                        <Switch checked={form.grants_full_workout_library} onCheckedChange={(v) => set('grants_full_workout_library', v)} />
                      </label>
                      <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                        <span>
                          <span className="block text-sm font-medium">Recetario completo</span>
                          <FieldHint>Desbloquea también todas las recetas premium.</FieldHint>
                        </span>
                        <Switch checked={form.grants_full_recipe_library} onCheckedChange={(v) => set('grants_full_recipe_library', v)} />
                      </label>
                    </div>
                  </section>

                  {/* 4. Precio y duración */}
                  <section ref={(el) => { sectionRefs.current.price = el }} className="scroll-mt-4">
                    <SectionHeader index={4} title="Precio y duración" description="Pago único. La duración es lo que dura el programa en la app." done={done.price} />
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="pack-price">Precio</Label>
                        <div className="flex h-10 items-center overflow-hidden rounded-lg border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                          <span className="flex h-full items-center px-3 text-sm text-muted-foreground">{symbol}</span>
                          <input
                            id="pack-price"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            className="h-full min-w-0 flex-1 bg-transparent text-base tabular-nums outline-none"
                            value={form.price}
                            onChange={(e) => set('price', e.target.value)}
                            placeholder="49"
                          />
                          <select
                            aria-label="Moneda"
                            className="h-full border-l bg-muted px-2 text-xs outline-none"
                            value={form.currency}
                            onChange={(e) => set('currency', e.target.value)}
                          >
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </div>
                        <FieldHint>IVA incluido. Se cobra una sola vez con Stripe.</FieldHint>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pack-duration">Duración del programa</Label>
                        <div className="flex h-10 items-center gap-2">
                          <Input id="pack-duration" type="number" min={1} className="h-10 w-20 tabular-nums" value={form.duration} onChange={(e) => set('duration', e.target.value)} />
                          <Segmented
                            value={form.duration_unit}
                            options={[{ value: 'week', label: 'Semanas' }, { value: 'month', label: 'Meses' }]}
                            onChange={(v) => set('duration_unit', v)}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {DURATION_PRESETS.map((p) => {
                            const on = form.duration === p.duration && form.duration_unit === p.unit
                            return (
                              <button
                                key={p.label}
                                type="button"
                                onClick={() => setForm((prev) => ({ ...prev, duration: p.duration, duration_unit: p.unit }))}
                                className={cn('rounded-full border px-2.5 py-0.5 text-xs transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
                              >
                                {p.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* 5. Publicación */}
                  <section ref={(el) => { sectionRefs.current.publish = el }} className="scroll-mt-4">
                    <SectionHeader index={5} title="Publicación" description="Puedes cambiarlo cuando quieras." done={done.publish} />
                    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Estado del pack">
                      {STATUS_OPTIONS.map((opt) => {
                        const on = status === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setForm((prev) => withStatus(prev, opt.value))}
                            className={cn('rounded-xl border p-3.5 text-left transition-colors', on ? 'border-primary ring-2 ring-primary/20' : 'hover:bg-muted/50')}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <span className={cn('size-2 rounded-full', opt.dot)} />
                              {opt.title}
                              {on ? <CheckIcon className="ml-auto size-4 text-primary" /> : null}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">{opt.description}</span>
                          </button>
                        )
                      })}
                    </div>
                    {status === 'live' && publishBlockers.length > 0 ? (
                      <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                        Para ponerlo a la venta falta: {publishBlockers.join(', ')}.
                      </p>
                    ) : null}
                  </section>
                </div>
              </div>
            </div>

            {/* Vista previa */}
            <aside className="hidden min-h-0 flex-col border-l bg-muted/40 lg:flex">
              <div className="flex items-center justify-between px-5 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista previa</p>
                <Segmented
                  value={previewMode}
                  options={[{ value: 'card', label: 'Tarjeta' }, { value: 'page', label: 'Página' }]}
                  onChange={setPreviewMode}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <PackPreview form={form} mode={previewMode} />
              </div>
              <div className="border-t px-5 py-3">
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">Enlace del pack</p>
                <button type="button" onClick={copyLink} className="flex w-full items-center gap-2 rounded-md bg-background px-3 py-2 text-left font-mono text-xs ring-1 ring-border hover:bg-muted">
                  <span className="min-w-0 flex-1 truncate">{link}</span>
                  <CopyIcon className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              </div>
            </aside>
          </div>

          {/* Pie */}
          <div className="flex flex-wrap items-center gap-3 border-t bg-background px-6 py-3">
            <div className="min-w-0 flex-1 text-xs">
              {missing.length > 0 ? (
                <span className="text-amber-700 dark:text-amber-400">Falta: {missing.join(', ')}</span>
              ) : recommended.length > 0 ? (
                <span className="text-muted-foreground">Recomendado añadir: {recommended.join(', ')}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <CheckIcon className="size-3.5" /> Todo listo
                </span>
              )}
            </div>
            <span className="hidden text-[11px] text-muted-foreground md:inline">Ctrl + S para guardar</span>
            <Button variant="outline" onClick={requestClose}>Cancelar</Button>
            <Button onClick={save} disabled={!canSave}>
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {primaryLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
            <AlertDialogDescription>Has modificado el pack y no lo has guardado. Si sales ahora, se perderán los cambios.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false)
                onClose()
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
