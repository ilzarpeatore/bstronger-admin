import { describe, expect, it } from 'vitest'
import { editDistance, fuzzyFilter, fuzzyMatch, fuzzyScore, normalizeText, tokenize, typoBudget } from './textSearch'

describe('normalizeText', () => {
  it('quita acentos, mayúsculas y signos', () => {
    expect(normalizeText('  Elevación  LATERAL ')).toBe('elevacion lateral')
    expect(normalizeText('Peña-Cañón')).toBe('pena canon')
    expect(normalizeText('Press de banca!')).toBe('press de banca')
    expect(normalizeText(null)).toBe('')
    expect(normalizeText(undefined)).toBe('')
    expect(normalizeText(42)).toBe('42')
  })
  it('tokeniza', () => {
    expect(tokenize('Hack Squat | Máquina')).toEqual(['hack', 'squat', 'maquina'])
    expect(tokenize('   ')).toEqual([])
  })
})

describe('distancia y presupuesto', () => {
  it('Damerau-Levenshtein', () => {
    expect(editDistance('lateal', 'lateral')).toBe(1)
    expect(editDistance('banac', 'banca')).toBe(1) // transposición
    expect(editDistance('bnaca', 'banca')).toBe(1)
    expect(editDistance('kitten', 'sitting')).toBe(3)
  })
  it('presupuesto según longitud', () => {
    expect([3, 4, 7, 8].map(typoBudget)).toEqual([0, 1, 1, 2])
  })
})

describe('fuzzyMatch (mismos casos que Bckbs FuzzySearchTest)', () => {
  const ex = 'Elevación lateral con mancuernas'
  const cases: [string, unknown[], boolean][] = [
    ['Elevacion lateal', [ex], true], // el caso reportado: sin tilde y con errata
    ['elevacion lateral', [ex], true],
    ['ELEVACIÓN', [ex], true],
    ['mancuernas elevacion', [ex], true],
    ['elevaci lateral', [ex], true], // a medio escribir con errata
    ['mancuenras', [ex], true], // transposición
    ['pres', ['Press de banca'], true],
    ['pra', ['Press de banca'], false],
    ['sentadilla', ['Press de banca'], false],
    ['elevacion frontal', [ex], false],
    ['juan garcia', ['Juan', 'García López'], true],
    ['   ', [ex], true],
    ['bnaca', ['Press de banca'], true],
    ['press bnca', ['Press de banca'], true],
    ['curl bicep', ['Curl de bíceps con barra'], true],
    ['hack sqaut', ['Hack Squat | Máquina'], true],
  ]
  it.each(cases)('%s', (q, fields, expected) => {
    expect(fuzzyMatch(q, ...fields)).toBe(expected)
  })
  it('null/undefined en los campos no rompen', () => {
    expect(fuzzyMatch('algo', null, undefined, 'Algo más')).toBe(true)
    expect(fuzzyMatch('algo', null)).toBe(false)
  })
  it('los números (ids) se buscan por contenido, sin erratas', () => {
    expect(fuzzyMatch('748', 748, 'Plantilla')).toBe(true)
    expect(fuzzyMatch('749', 748, 'Plantilla')).toBe(false)
  })
})

describe('fuzzyScore / fuzzyFilter', () => {
  it('exacto puntúa 0 y con errata 1', () => {
    expect(fuzzyScore('lateral', 'Elevación lateral')).toBe(0)
    expect(fuzzyScore('lateal', 'Elevación lateral')).toBe(1)
  })
  const items = [
    { id: 1, title: 'Elevación frontal' },
    { id: 2, title: 'Elevación lateral' },
    { id: 3, title: 'Lateral raise (elevacion lateral)' },
    { id: 4, title: 'Sentadilla' },
  ]
  it('filtra respetando el orden original por defecto', () => {
    expect(fuzzyFilter(items, 'elevacion', i => i.title).map(i => i.id)).toEqual([1, 2, 3])
  })
  it('con rank ordena exactos antes que con erratas', () => {
    const r = fuzzyFilter(items, 'elevacion lateal', i => i.title, { rank: true }).map(i => i.id)
    expect(r[0]).toBe(2) // 0 + 1 erratas
    expect(r).not.toContain(4)
  })
  it('consulta vacía devuelve todo; varios campos en array', () => {
    expect(fuzzyFilter(items, '  ', i => i.title)).toHaveLength(4)
    expect(fuzzyFilter(items, 'sentadila 4', i => [i.title, i.id]).map(i => i.id)).toEqual([4])
  })
})
