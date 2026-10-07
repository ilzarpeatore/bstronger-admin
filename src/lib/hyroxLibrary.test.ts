import { describe, expect, it } from 'vitest'
import { divisionLoadsSummary, groupByCategory, normalizeHyroxLibrary } from './hyroxLibrary'

describe('normalizeHyroxLibrary', () => {
  it('acepta {success, data} y agrupa por categoría', () => {
    const lib = normalizeHyroxLibrary({
      success: true,
      data: {
        division: 'pro_f',
        divisions: [{ key: 'pro_f', label: 'Pro mujer', loads: { sled_push: 152, sled_pull: 103, farmers: 24, lunges: 20, wall_ball: 6 }, wall_ball_target: '2,70 m', doubles: false }],
        templates: [
          { key: 'a', title: 'A', category: 'simulacro', category_label: 'Simulacros', description: '', blocks: [{ title: 'B', kind: 'for_time', params: null, instructions: null, steps: ['Carrera 1 km'] }] },
          { key: 'b', title: 'B', category: 'benchmark', category_label: 'Tests', description: '', blocks: [] },
          { key: 'c', title: 'C', category: 'simulacro', category_label: 'Simulacros', description: '', blocks: [] },
        ],
        missing_exercises: ['hyrox_row'],
      },
    })!
    expect(lib.ready).toBe(false)
    expect(groupByCategory(lib.templates).map(g => [g.label, g.items.map(i => i.key)])).toEqual([['Simulacros', ['a', 'c']], ['Tests', ['b']]])
    expect(divisionLoadsSummary(lib.divisions[0])).toContain('Granjero 2 × 24 kg')
  })
  it('basura', () => {
    expect(normalizeHyroxLibrary(null)).toBeNull()
    expect(normalizeHyroxLibrary({ data: {} })).toBeNull()
  })
})
