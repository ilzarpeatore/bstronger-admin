export type MonthPaymentStatus = {
  paid: boolean
  amount: number
  paid_at: string | null
  notes: string | null
}

// 'user': cliente registrado en la app (tabla users).
// 'external': cliente que solo existe en el seguimiento de pagos (no tiene
// cuenta), creado a mano o importado de Notion.
export type PaymentClientSource = 'user' | 'external'

export type ClientPaymentRow = {
  id: number
  // Opcional: si el backend no lo envía, se trata como 'user'.
  source?: PaymentClientSource
  name: string
  email: string | null
  status: string
  monthly_fee: number
  months: Record<number, MonthPaymentStatus>
  // Solo clientes 'user': estado del control de impago del periodo vigente.
  billing?: BillingSummary | null
}

export type SubscriptionPaymentsPayload = {
  year: number
  month_labels: Record<number, string>
  clients: ClientPaymentRow[]
}

export type MonthlySummaryRow = {
  month: number
  label: string
  total: number
  paid_count: number
  unpaid_count: number
}

export type SubscriptionPaymentsSummary = {
  year: number
  monthly: MonthlySummaryRow[]
  total_year: number
  average_month: number
  average_client: number
  total_clients: number
}

// ═══ Aviso de pago pendiente / bloqueo por impago (Bckbs docs/AVISO_IMPAGO.md) ═══

// state: lo que pasaría con el control activado (si está apagado, como si se
// activara hoy). effective_state: lo que se aplica de verdad al cliente.
export type BillingState = 'ok' | 'grace' | 'warning' | 'blocked' | 'exempt' | 'not_applicable'

export type BillingSummary = {
  state: BillingState
  effective_state: BillingState
  enforcement_enabled: boolean
  day: number | null
  block_date: string | null
  due_day: number
  exempt: boolean
  grace_until: string | null
  period: { year: number; month: number; label: string }
}

export type BillingStatus = BillingSummary & {
  due_date: string
  paid: boolean
  amount: number | null
  currency: string
  days_until_block: number | null
  message: string | null
}

export type PaymentControlPayload = {
  user_id: number
  applies: boolean
  settings: { exempt: boolean; due_day: number; grace_until: string | null }
  status: BillingStatus
}

export type PaymentControlSettings = {
  enabled: boolean
  stored_enabled: boolean
  force_off: boolean
  since: string | null
  warning_days: number
  counts: Record<'ok' | 'grace' | 'warning' | 'blocked' | 'exempt', number>
}
