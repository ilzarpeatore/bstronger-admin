import { useEffect, useState } from 'react'

import { api } from '@/lib/api'

// Catálogo de técnicas especiales. Única fuente: Bckbs App\Support\TrainingTechniques,
// servido en GET /admin/training-technique-list. Se guardan en el `prescribed` de cada
// ejercicio como tecnica / tecnica_series ('todas' | 'ultima') / tecnica_otra.

export type TrainingTechnique = {
  key: string
  label: string
  description: string
  steps?: string[]
  mistakes?: string[]
  logging?: string
  /** true si el coach ha editado los textos por defecto */
  customized?: boolean
}

export const OTHER_TECHNIQUE = 'otra'

let cache: TrainingTechnique[] | null = null
let pending: Promise<TrainingTechnique[]> | null = null

export function loadTrainingTechniques(): Promise<TrainingTechnique[]> {
  if (cache) return Promise.resolve(cache)
  if (!pending) {
    pending = api
      .get('/admin/training-technique-list')
      .then(res => {
        const list = Array.isArray(res?.data) ? (res.data as TrainingTechnique[]) : []
        if (list.length) cache = list
        else pending = null
        return list
      })
      .catch(err => {
        pending = null
        throw err
      })
  }
  return pending
}

/** Sustituye la caché tras editar el catálogo en /tecnicas-especiales. */
export function setTrainingTechniquesCache(list: TrainingTechnique[]) {
  cache = list.length ? list : null
  pending = null
}

export function useTrainingTechniques(): TrainingTechnique[] {
  const [list, setList] = useState<TrainingTechnique[]>(cache ?? [])
  useEffect(() => {
    let alive = true
    loadTrainingTechniques()
      .then(l => alive && setList(l))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return list
}

/** Texto a mostrar: la etiqueta del catálogo, el texto libre si es «Otra», o la clave si no se conoce. */
export function techniqueLabel(key: string | null | undefined, otra: string | null | undefined, catalog: TrainingTechnique[]): string {
  if (!key) return ''
  if (key === OTHER_TECHNIQUE) return (otra ?? '').trim() || 'Otra'
  return catalog.find(t => t.key === key)?.label ?? key.replace(/_/g, ' ')
}
