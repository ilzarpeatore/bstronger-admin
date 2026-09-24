import { useCallback, useState, type ReactNode } from 'react'
import ProgramSessionMatrixEditor from '@/components/coaching/ProgramSessionMatrixEditor'

/**
 * Abre el editor de sesiones a nivel programa (matriz ejercicios x semanas) desde cualquier pantalla.
 * Se monta solo mientras está abierto, así cada apertura empieza con el estado limpio.
 *
 *   const { openEditor, editorElement } = useProgramSessionEditor(refrescarCalendario)
 *   openEditor(programaId)                    // todo el programa
 *   openEditor(programaId, [asignacionId...]) // los tipos de sesión de esas asignaciones (todas sus semanas)
 *   ... {editorElement}
 *
 * Desde el calendario de un cliente el `programaId` es SU copia del programa: editarlo no afecta a nadie más.
 */
export function useProgramSessionEditor(onSaved?: () => void): {
  openEditor: (programId: number, assignmentIds?: number[] | null) => void
  editorElement: ReactNode
} {
  const [state, setState] = useState<{ programId: number; ids: number[] | null } | null>(null)
  const openEditor = useCallback((programId: number, assignmentIds: number[] | null = null) => setState({ programId, ids: assignmentIds }), [])

  const editorElement = state ? (
    <ProgramSessionMatrixEditor
      open
      onOpenChange={o => { if (!o) setState(null) }}
      programId={state.programId}
      initialAssignmentIds={state.ids}
      onSaved={onSaved}
    />
  ) : null

  return { openEditor, editorElement }
}

export type ProgramRef = { id: number; title: string }

/** Programas distintos (no personales) presentes en una lista de sesiones de calendario. */
export function distinctPrograms<T>(
  items: readonly T[],
  getProgram: (item: T) => { id?: number | null; title?: string | null } | null,
): ProgramRef[] {
  const map = new Map<number, string>()
  for (const item of items) {
    const p = getProgram(item)
    if (p?.id && !map.has(p.id)) map.set(p.id, p.title || `Programa #${p.id}`)
  }
  return [...map.entries()].map(([id, title]) => ({ id, title }))
}
