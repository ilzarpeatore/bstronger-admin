import type { DragEventHandler, ReactNode } from 'react'
import { DumbbellIcon, MoreVerticalIcon, PlusIcon, CheckCircleIcon } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// Piezas de contenido de día para MonthWeekCalendar. Van aquí (y no en cada
// vista) para que todas las tarjetas/botones de los calendarios se vean igual.

/** Botón discontinuo "+" que ocupa el hueco de un día vacío. */
export function CalendarAddButton({ onClick, title }: { onClick: () => void; title?: string }) {
  return (
    <button
      type='button'
      title={title}
      className='flex-1 rounded-lg border border-dashed hover:border-primary/50 hover:bg-muted/50 transition-colors flex items-center justify-center text-muted-foreground hover:text-primary'
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      <PlusIcon className='size-4' />
    </button>
  )
}

type WorkoutCardProps = {
  title: string
  thumbnail?: string | null
  exerciseCount?: number
  completed?: boolean
  /** Aviso bajo "Completado" (p. ej. "sin series registradas"). */
  completedNote?: string
  /** 'client' = entrenamiento creado por el propio cliente desde la app. */
  tone?: 'default' | 'client'
  /** Línea pequeña bajo el título (p. ej. nombre del programa). */
  subtitle?: string | null
  draggable?: boolean
  onDragStart?: DragEventHandler<HTMLDivElement>
  onOpen: () => void
  /** Contenido del menú "⋮" (DropdownMenuItem...). Sin menu no se pinta el botón. */
  menu?: ReactNode
  /**
   * Checkbox de selección múltiple, flotando sobre la miniatura (mismo sitio
   * que en el "Calendario del programa"). El clic no llega a `onOpen`.
   */
  selection?: ReactNode
}

/** Tarjeta de sesión de entrenamiento de un día (miniatura, título, ejercicios, estado). */
export function CalendarWorkoutCard({ title, thumbnail, exerciseCount, completed, completedNote, tone = 'default', subtitle, draggable, onDragStart, onOpen, menu, selection }: WorkoutCardProps) {
  const client = tone === 'client' && !completed
  return (
    <div
      className={cn(
        'group relative rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow flex-1',
        completed ? 'border-green-500/50 bg-green-500/10 cursor-pointer'
          : client ? 'border-purple-500/50 bg-purple-500/10 cursor-pointer'
            : draggable ? 'bg-card cursor-grab active:cursor-grabbing' : 'bg-card cursor-pointer',
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={(e) => { e.stopPropagation(); onOpen() }}
    >
      {selection && (
        <div
          className='absolute left-1.5 top-1.5 z-10 rounded bg-background/90 p-0.5 shadow-sm'
          onClick={(e) => e.stopPropagation()}
        >
          {selection}
        </div>
      )}
      {thumbnail
        ? <div className={cn('h-16 w-full overflow-hidden', completed ? 'bg-green-500/20' : 'bg-muted')}><img src={thumbnail} alt='' loading='lazy' decoding='async' className='w-full h-full object-cover' /></div>
        : <div className={cn('h-16 w-full flex items-center justify-center', completed ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground/30')}><DumbbellIcon className='size-5' /></div>}
      <div className='px-2 py-1.5'>
        <div className='flex items-start justify-between gap-1'>
          <span className='text-[11px] font-semibold leading-tight hover:underline line-clamp-2' title={title}>{title}</span>
          {menu && (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <button type='button' className='opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-foreground shrink-0' onClick={(e) => e.stopPropagation()}><MoreVerticalIcon className='size-3' /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='text-xs'>{menu}</DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {completed && <p className='text-[10px] font-medium text-green-600 mt-1 flex items-center gap-1'><CheckCircleIcon className='size-3' /> Completado</p>}
        {completed && completedNote && <p className='text-[10px] text-amber-600 mt-0.5'>{completedNote}</p>}
        {!completed && exerciseCount !== undefined && exerciseCount > 0 && <p className='text-[10px] text-muted-foreground mt-1'>{exerciseCount} {exerciseCount !== 1 ? 'ejercicios' : 'ejercicio'}</p>}
        {subtitle && <p className='text-[10px] text-muted-foreground mt-0.5 truncate'>{subtitle}</p>}
      </div>
    </div>
  )
}
