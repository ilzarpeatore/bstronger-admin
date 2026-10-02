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
