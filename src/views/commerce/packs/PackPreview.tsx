import { CheckCircle2Icon, ImageIcon, LockIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, formatPrice, includesOf, type PackForm } from './packs-api'

export type PreviewMode = 'card' | 'page'

// Vista previa del pack tal como sale en la web (webbs: src/app/(pages)/packs).
// Colores fijos de la web, no del tema del panel, para que se parezca a lo
// que verá el comprador.
export default function PackPreview({ form, mode }: { form: PackForm; mode: PreviewMode }) {
  const includes = [...includesOf(form), 'Seguimiento en la app de BeStronger']
  const duration = formatDuration(parseInt(form.duration, 10) || 1, form.duration_unit)
  const price = form.price !== '' ? formatPrice(Number(form.price), form.currency) : '—'
  const name = form.name.trim() || 'Nombre del pack'
  const short = form.short_description.trim() || 'Una frase que resuma el pack.'

  const image = (ratio: string) =>
    form.image_url ? (
      <img src={form.image_url} alt="" className={cn('w-full object-cover', ratio)} />
    ) : (
      <div className={cn('flex w-full items-center justify-center bg-neutral-100 text-neutral-300', ratio)}>
        <ImageIcon className="size-8" />
      </div>
    )

  const includeList = (
    <ul className="flex flex-col gap-1.5">
      {includes.map((item) => (
        <li key={item} className="flex items-center gap-2 text-[13px] text-neutral-700">
          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
          {item}
        </li>
      ))}
    </ul>
  )

  if (mode === 'card') {
    return (
      <div className="overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-lg ring-1 ring-black/5">
        {image('aspect-[16/10]')}
        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="text-xs font-medium text-neutral-500">{duration}</p>
            <h3 className="mt-1 text-lg font-medium leading-snug">{name}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">{short}</p>
          </div>
          {includeList}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xl font-semibold">{price}</p>
            <span className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white">Ver pack</span>
          </div>
        </div>
      </div>
    )
  }

  // Página del pack, comprimida a una columna (en la web real la caja de
  // compra va a la derecha en escritorio).
  return (
    <div className="overflow-hidden rounded-2xl bg-[#f6f6f4] text-neutral-900 shadow-lg ring-1 ring-black/5">
      <div className="flex items-center gap-1.5 border-b border-black/5 bg-white px-3 py-2">
        <span className="size-2 rounded-full bg-neutral-200" />
        <span className="size-2 rounded-full bg-neutral-200" />
        <span className="size-2 rounded-full bg-neutral-200" />
        <span className="ml-2 flex min-w-0 items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
          <LockIcon className="size-2.5 shrink-0" />
          <span className="truncate">bestronger.es/packs/…</span>
        </span>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-[11px] text-neutral-500">← Todos los packs</p>
        <div>
          <p className="text-xs font-medium text-neutral-500">{duration}</p>
          <h3 className="mt-0.5 text-xl font-medium leading-tight">{name}</h3>
          <p className="mt-1.5 text-[13px] text-neutral-600">{short}</p>
        </div>
        <div className="overflow-hidden rounded-xl">{image('aspect-[16/9]')}</div>
        {form.description.trim() ? (
          <p className="line-clamp-6 whitespace-pre-line text-[13px] leading-relaxed text-neutral-700">{form.description}</p>
        ) : (
          <p className="text-[13px] italic text-neutral-400">Aquí irá la descripción completa.</p>
        )}
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-md">
          <div>
            <p className="text-2xl font-semibold">{price}</p>
            <p className="text-[11px] text-neutral-500">Pago único · {duration} de programa</p>
          </div>
          {includeList}
          <div className="rounded-lg border border-neutral-200 px-3 py-2 text-[12px] text-neutral-400">Tu email</div>
          <div className="rounded-full bg-neutral-900 py-2 text-center text-xs font-medium text-white">Comprar · {price}</div>
        </div>
      </div>
    </div>
  )
}
