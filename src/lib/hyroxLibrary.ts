/**
 * Biblioteca de plantillas Hyrox (fase 2, 2.2): GET admin/hyrox-library?division=
 * y POST admin/hyrox-library/instantiate {key, division, title?} (Bckbs HyroxLibrary).
 */
import type { BlockParams } from './blockKinds'

export type HyroxDivision = {
  key: string
  label: string
  loads: Record<'sled_push' | 'sled_pull' | 'farmers' | 'lunges' | 'wall_ball', number>
  wall_ball_target: string
  doubles: boolean
}

export type HyroxLibraryTemplate = {
  key: string
  title: string
  category: string
  category_label: string
  description: string
  blocks: { title: string; kind: string; params: BlockParams | null; instructions: string | null; steps: string[] }[]
}

export type HyroxLibrary = {
  divisions: HyroxDivision[]
  division: string
  templates: HyroxLibraryTemplate[]
  missing_exercises: string[]
  ready: boolean
}

/** Acepta `{success, data}` o el objeto; null si no tiene forma de biblioteca. */
export function normalizeHyroxLibrary(raw: unknown): HyroxLibrary | null {
  const r = raw as Record<string, any> | null | undefined
  const d = (r && typeof r === 'object' && 'data' in r ? r.data : r) as Record<string, any> | null | undefined
  if (!d || typeof d !== 'object' || !Array.isArray(d.templates)) return null
  const missing = Array.isArray(d.missing_exercises) ? d.missing_exercises.map(String) : []
  return {
    divisions: Array.isArray(d.divisions) ? d.divisions : [],
    division: String(d.division ?? 'open_m'),
    templates: d.templates.map((t: any) => ({
      ...t,
      blocks: Array.isArray(t.blocks) ? t.blocks.map((b: any) => ({ ...b, steps: Array.isArray(b.steps) ? b.steps.map(String) : [] })) : [],
    })),
    missing_exercises: missing,
    ready: d.ready ?? missing.length === 0,
  }
}

/** Plantillas agrupadas por categoría, conservando el orden del backend. */
export function groupByCategory(templates: HyroxLibraryTemplate[]): { category: string; label: string; items: HyroxLibraryTemplate[] }[] {
  const groups: { category: string; label: string; items: HyroxLibraryTemplate[] }[] = []
  for (const t of templates) {
    let g = groups.find(x => x.category === t.category)
    if (!g) {
      g = { category: t.category, label: t.category_label || t.category, items: [] }
      groups.push(g)
    }
    g.items.push(t)
  }
  return groups
}

/** «152 kg · 103 kg · 2 × 24 kg · 20 kg · 6 kg» para la cabecera del selector. */
export function divisionLoadsSummary(d: HyroxDivision): string[] {
  const l = d.loads
  return [
    `Empuje de trineo ${l.sled_push} kg`,
    `Arrastre ${l.sled_pull} kg`,
    `Granjero 2 × ${l.farmers} kg`,
    `Sandbag ${l.lunges} kg`,
    `Wall ball ${l.wall_ball} kg a ${d.wall_ball_target}`,
  ]
}
