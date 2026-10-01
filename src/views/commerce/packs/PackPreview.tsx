import { CheckCircle2Icon, ImageIcon } from 'lucide-react'
import { formatDuration, formatPrice, includesOf, type PackForm } from './packs-api'

// Vista previa de la tarjeta del pack tal como sale en la web
// (webbs: src/app/(pages)/packs/page.tsx). Colores fijos de la web, no del
// tema del panel, para que se parezca a lo que verá el comprador.
export default function PackPreview({ form }: { form: PackForm }) {
  const includes = [...includesOf(form), 'Seguimiento en la app de BeStronger']
  const duration = formatDuration(parseInt(form.duration, 10) || 1, form.duration_unit)
  const price = form.price ? formatPrice(Number(form.price), form.currency) : '—'

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-xl ring-1 ring-black/5">
        {form.image_url ? (
          <img src={form.image_url} alt="" className="aspect-[16/10] w-full object-cover" />
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center bg-neutral-100 text-neutral-400">
            <ImageIcon className="size-8" />
          </div>
        )}
        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="text-sm font-medium text-neutral-500">{duration}</p>
            <h3 className="mt-1 text-xl font-medium">{form.name || 'Nombre del pack'}</h3>
            <p className="mt-2 text-sm text-neutral-600">
              {form.short_description || 'Una frase que resuma el pack.'}
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {includes.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-neutral-700">
                <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between pt-1">
            <p className="text-xl font-semibold">{price}</p>
            <span className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white">Ver pack</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Pago único · {duration} de programa. En la página del pack se muestra además la descripción completa y el
        botón de compra.
      </p>
    </div>
  )
}
