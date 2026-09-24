// Búsqueda de texto insensible a acentos/mayúsculas y tolerante a erratas, común a
// TODOS los buscadores del admin que filtran en el navegador. Es el gemelo, con las
// mismas reglas, de Bckbs::App\Support\FuzzySearch (los buscadores que van al servidor).
//
// Reglas:
//  - Se normaliza: minúsculas, sin acentos ("Elevación" == "elevacion"), ñ == n,
//    espacios colapsados.
//  - La consulta se parte en palabras; TODAS deben encajar (en cualquier campo y en
//    cualquier orden).
//  - Una palabra encaja si está contenida en alguna palabra del texto, o si se parece
//    a una (o a su comienzo, para búsquedas a medio escribir) con hasta N erratas de
//    distancia Damerau-Levenshtein (sustituir/insertar/borrar/intercambiar letras):
//    N = 0 hasta 3 letras, 1 de 4 a 7, 2 desde 8.

const EXTRA: Record<string, string> = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd' }

/** minúsculas, sin acentos, solo letras/números separados por un espacio. */
export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ßæœøłđ]/g, c => EXTRA[c] ?? c)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
  return s.replace(/\s+/g, ' ').trim()
}

export function tokenize(value: unknown): string[] {
  const n = normalizeText(value)
  return n === '' ? [] : n.split(' ')
}

/** Erratas permitidas según la longitud de la palabra buscada. */
export function typoBudget(length: number): number {
  return length <= 3 ? 0 : length <= 7 ? 1 : 2
}

/** Distancia Damerau-Levenshtein (versión "optimal string alignment"). */
export function editDistance(a: string, b: string): number {
  const la = a.length
  const lb = b.length
  if (la === 0) return lb
  if (lb === 0) return la
  let prev2: number[] = []
  let prev: number[] = Array.from({ length: lb + 1 }, (_, j) => j)
  for (let i = 1; i <= la; i++) {
    const cur: number[] = [i]
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur[j] = v
    }
    prev2 = prev
    prev = cur
  }
  return prev[lb]
}

/** Distancia (0 = contenida/exacta) a la que una palabra buscada encaja con las palabras del texto, o null. */
export function tokenDistance(token: string, words: string[]): number | null {
  const budget = typoBudget(token.length)
  let best: number | null = null
  for (const word of words) {
    if (!word) continue
    if (word.includes(token)) return 0
    if (budget === 0) continue
    const d = Math.min(editDistance(token, word), editDistance(token, word.slice(0, token.length)))
    if (d <= budget && (best === null || d < best)) best = d
  }
  return best
}

/** Puntuación de una consulta contra varios campos: null si no encaja; menor = mejor. Consulta vacía => 0. */
export function fuzzyScore(query: string, ...fields: unknown[]): number | null {
  const tokens = tokenize(query)
  if (tokens.length === 0) return 0
  const words = fields.flatMap(f => tokenize(f))
  let total = 0
  for (const token of tokens) {
    const d = tokenDistance(token, words)
    if (d === null) return null
    total += d
  }
  return total
}

/** ¿Encaja la consulta con alguno de los campos? Consulta vacía => true. */
export function fuzzyMatch(query: string, ...fields: unknown[]): boolean {
  return fuzzyScore(query, ...fields) !== null
}

/**
 * Filtra una lista. Con `rank: true` ordena por relevancia (exactos antes que con erratas, conservando el
 * orden original a igual puntuación); por defecto solo filtra y respeta el orden de la lista.
 */
export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  getFields: (item: T) => unknown,
  options: { rank?: boolean } = {},
): T[] {
  if (tokenize(query).length === 0) return [...items]
  const scored: { item: T; score: number; index: number }[] = []
  items.forEach((item, index) => {
    const fields = getFields(item)
    const score = fuzzyScore(query, ...(Array.isArray(fields) ? fields : [fields]))
    if (score !== null) scored.push({ item, score, index })
  })
  if (options.rank) scored.sort((a, b) => a.score - b.score || a.index - b.index)
  return scored.map(s => s.item)
}
