import type { ClientPaymentRow } from '@/types/apps/subscription-payments'

export const clientSource = (client: Pick<ClientPaymentRow, 'source'>) => client.source ?? 'user'

// Los ids de usuarios y de clientes externos son secuencias distintas: la
// clave de fila combina ambos para no mezclar un usuario 5 con un externo 5.
export const clientKey = (client: Pick<ClientPaymentRow, 'id' | 'source'>) => `${clientSource(client)}-${client.id}`

export const monthPaymentUrl = (client: Pick<ClientPaymentRow, 'id' | 'source'>, year: number, month: number) =>
  clientSource(client) === 'external'
    ? `/admin/subscription-payments/external/${client.id}/${year}/${month}`
    : `/admin/subscription-payments/${client.id}/${year}/${month}`
