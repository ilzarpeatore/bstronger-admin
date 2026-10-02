// Mensualidades ya cobradas en 2026, copiadas de la base de Notion
// "💸 Be Stronger 2026" (vista MENSUALIDADES) el 2026-10-02.
// Se usan desde "Seguimiento de pagos" → "Importar de Notion": los nombres
// que coinciden con un cliente del panel se aplican a ese cliente y el resto
// se crean como clientes externos (no registrados en la app).
// Clave de `months`: número de mes (1 = enero). Solo meses con importe.

export type NotionPaymentClient = {
  name: string
  monthly_fee: number
  months: Partial<Record<number, number>>
}

export const NOTION_PAYMENTS_YEAR = 2026

export const notionPayments2026: NotionPaymentClient[] = [
  { name: 'Alberto Martín Girón', monthly_fee: 65, months: { 2: 65, 4: 65, 6: 75 } },
  { name: 'Andres Rodriguez', monthly_fee: 65, months: { 2: 65, 4: 65, 5: 65 } },
  { name: 'Borja Betanzos', monthly_fee: 55, months: { 1: 23, 2: 55, 3: 55, 4: 55, 5: 55, 6: 55 } },
  { name: 'Fran Garcia Romero', monthly_fee: 65, months: { 3: 65, 4: 65, 5: 65 } },
  { name: 'Hamza Bilbao', monthly_fee: 70, months: { 4: 70, 5: 70, 6: 70 } },
  { name: 'Mario Garcia Guiraro', monthly_fee: 75, months: { 1: 75, 2: 75, 4: 75, 5: 75, 6: 75 } },
  { name: 'María Ángeles Solano', monthly_fee: 60, months: { 1: 60, 2: 60, 4: 60 } },
  { name: 'Miguel Borrego', monthly_fee: 55, months: {} },
  { name: 'Nerea TEAM', monthly_fee: 70, months: { 2: 35, 3: 70, 4: 70, 5: 70 } },
  { name: 'Toni Perez', monthly_fee: 50, months: { 2: 50, 3: 50, 4: 50, 5: 50 } },
  { name: 'Usama El Moukhlofi', monthly_fee: 65, months: {} },
]

// Compara nombres sin tildes, mayúsculas ni espacios de más.
export function normalizeName(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
