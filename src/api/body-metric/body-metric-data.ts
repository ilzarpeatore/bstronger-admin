import { http, HttpResponse } from 'msw'

type BodyMetricType = { value: string; label: string; unit: string; scope: 'global' | 'client'; client_id: number | null }

const bodyMetricTypes: BodyMetricType[] = [
  { value: 'weight', label: 'Weight', unit: 'kg', scope: 'global', client_id: null },
  { value: 'body_fat', label: 'Body Fat %', unit: '%', scope: 'global', client_id: null },
  { value: 'muscle_mass', label: 'Muscle Mass', unit: 'kg', scope: 'global', client_id: null },
  { value: 'chest', label: 'Chest', unit: 'cm', scope: 'global', client_id: null },
  { value: 'waist', label: 'Waist', unit: 'cm', scope: 'global', client_id: null },
  { value: 'hips', label: 'Hips', unit: 'cm', scope: 'global', client_id: null },
]

export const BodyMetricHandlers = [
  http.get('*/admin/body-metric-type-list', ({ request }) => {
    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')
    const filtered = bodyMetricTypes.filter(t => t.scope === 'global' || (t.scope === 'client' && String(t.client_id) === clientId))
    return HttpResponse.json({ status: 200, data: filtered })
  }),

  http.post('*/admin/body-metric-type-store', async ({ request }) => {
    const body = (await request.json()) as BodyMetricType
    if (!body.value || !body.label) {
      return HttpResponse.json({ status: 400, msg: 'Value and label are required' }, { status: 400 })
    }
    const exists = bodyMetricTypes.find(t => t.value === body.value && (t.scope === 'global' || (t.scope === 'client' && t.client_id === body.client_id)))
    if (exists) {
      return HttpResponse.json({ status: 400, msg: 'A type with this value already exists' }, { status: 400 })
    }
    bodyMetricTypes.push({
      value: body.value,
      label: body.label,
      unit: body.unit || '',
      scope: body.scope || 'global',
      client_id: body.scope === 'client' ? body.client_id : null,
    })
    return HttpResponse.json({ status: 200, data: bodyMetricTypes, msg: 'Created' })
  }),

  http.post('*/admin/body-metric-type-update', async ({ request }) => {
    const body = (await request.json()) as BodyMetricType & { value: string }
    const idx = bodyMetricTypes.findIndex(t => t.value === body.value)
    if (idx === -1) {
      return HttpResponse.json({ status: 404, msg: 'Type not found' }, { status: 404 })
    }
    bodyMetricTypes[idx] = { ...bodyMetricTypes[idx], label: body.label, unit: body.unit || '' }
    return HttpResponse.json({ status: 200, data: bodyMetricTypes, msg: 'Updated' })
  }),

  http.post('*/admin/body-metric-type-delete', async ({ request }) => {
    const body = (await request.json()) as { value: string; client_id: number | null }
    const idx = bodyMetricTypes.findIndex(t => t.value === body.value && (t.scope === 'global' || (t.scope === 'client' && t.client_id === body.client_id)))
    if (idx === -1) {
      return HttpResponse.json({ status: 404, msg: 'Type not found' }, { status: 404 })
    }
    bodyMetricTypes.splice(idx, 1)
    return HttpResponse.json({ status: 200, data: bodyMetricTypes, msg: 'Deleted' })
  }),
]
