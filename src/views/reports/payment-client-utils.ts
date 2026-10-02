import type { ClientPaymentRow } from '@/types/apps/subscription-payments'

const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Misma persona con nombres distintos en Notion y en la app (confirmados por
// el admin). Clave y valores normalizados (sin tildes, minúsculas).
const KNOWN_ALIASES: Record<string, string[]> = {
  'hamza bilbao': ['hamsa dris bakkali'],
}

export const clientSource = (client: Pick<ClientPaymentRow, 'source'>) => client.source ?? 'user'

// Los ids de usuarios y de clientes externos son secuencias distintas: la
// clave de fila combina ambos para no mezclar un usuario 5 con un externo 5.
export const clientKey = (client: Pick<ClientPaymentRow, 'id' | 'source'>) => `${clientSource(client)}-${client.id}`

export const monthPaymentUrl = (client: Pick<ClientPaymentRow, 'id' | 'source'>, year: number, month: number) =>
  clientSource(client) === 'external'
    ? `/admin/subscription-payments/external/${client.id}/${year}/${month}`
    : `/admin/subscription-payments/${client.id}/${year}/${month}`

// Mismo criterio que SubscriptionPaymentController::nameScore en el backend:
// tolera tildes, una letra cambiada ("Hamza"/"Hamsa"), diminutivos
// ("Toni"/"Antonio") y apellidos de más o de menos. 0 = no se parecen.
const nameTokens = (name: string) =>
  normalize(name)
    .split(/[^a-z]+/).filter((t) => t.length >= 3 && !['team', 'del', 'las', 'los'].includes(t))

const levenshteinAtMostOne = (a: string, b: string) => {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

const tokensMatch = (a: string, b: string) =>
  a === b || (a.length >= 4 && b.length >= 4 && (levenshteinAtMostOne(a, b) || a.includes(b) || b.includes(a)))

export function nameScore(external: string, candidate: string) {
  const candidateTokens = nameTokens(candidate)
  return nameTokens(external).reduce((score, token, i) =>
    candidateTokens.some((c) => tokensMatch(token, c)) ? score + (i === 0 ? 2 : 1) : score, 0)
}

const firstToken = (name: string) => nameTokens(name)[0] ?? ''

// ¿La coincidencia es lo bastante segura para darla por buena sin que el
// admin la elija? Nombre + apellido (>= 3), mismo nombre de pila exacto, o
// un alias conocido. Evita falsos positivos como "María" ↔ "Marta".
export function isConfidentMatch(name: string, candidate: string) {
  if (KNOWN_ALIASES[normalize(name)]?.includes(normalize(candidate))) return true
  const score = nameScore(name, candidate)
  return score >= 3 || (score >= 2 && firstToken(name) !== '' && firstToken(name) === firstToken(candidate))
}

// Cliente del panel que encaja con seguridad con un nombre (undefined si
// ninguno o si hay empate entre varios). Ante igualdad gana el usuario
// registrado sobre el externo.
export function bestNameMatch<T extends Pick<ClientPaymentRow, 'name' | 'source'>>(name: string, clients: T[]) {
  const ranked = clients
    .filter((c) => isConfidentMatch(name, c.name))
    .map((c) => ({ c, score: nameScore(name, c.name) + (KNOWN_ALIASES[normalize(name)] ? 10 : 0) + (clientSource(c) === 'user' ? 0.5 : 0) }))
    .sort((a, b) => b.score - a.score)
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) return undefined
  return ranked[0]?.c
}
