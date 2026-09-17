export type MonthPaymentStatus = {
  paid: boolean
  amount: number
  paid_at: string | null
  notes: string | null
}

export type ClientPaymentRow = {
  id: number
  name: string
  email: string
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
