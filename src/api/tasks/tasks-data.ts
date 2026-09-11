import { http, HttpResponse } from 'msw'

type ClientUser = { id: number; first_name: string; last_name: string; email: string; token: string }

const clients: ClientUser[] = [
  { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com', token: 'client-token-john' },
  { id: 2, first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com', token: 'client-token-jane' },
]

type TaskSeed = { id: number; client_id: number; title: string; description: string | null; priority: string; status: string; due_date: string | null; created_at: string; author: { id: number; first_name: string; last_name: string } | null }

const seedTasks: TaskSeed[] = [
  { id: 1, client_id: 1, title: 'Review weekly meal plan', description: 'Go over the assigned diet for next week', priority: 'high', status: 'pending', due_date: '2026-08-05', created_at: '2026-07-28T10:00:00Z', author: { id: 1, first_name: 'Coach', last_name: 'Admin' } },
  { id: 2, client_id: 1, title: 'Complete full body workout #3', description: 'Record all sets and reps', priority: 'medium', status: 'in_progress', due_date: '2026-08-03', created_at: '2026-07-27T09:00:00Z', author: { id: 1, first_name: 'Coach', last_name: 'Admin' } },
  { id: 3, client_id: 1, title: 'Send progress photos', description: 'Front, side, and back', priority: 'low', status: 'completed', due_date: '2026-07-30', created_at: '2026-07-25T14:00:00Z', author: { id: 1, first_name: 'Coach', last_name: 'Admin' } },
]

function getClientFromToken(request: Request): ClientUser | null {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '')
  return clients.find(c => c.token === token) || null
}

export const TaskClientHandlers = [
  http.get('*/api/client/tasks', ({ request }) => {
    const client = getClientFromToken(request)
    if (!client) return HttpResponse.json({ status: 401, msg: 'Unauthorized' }, { status: 401 })
    const list = seedTasks.filter(t => t.client_id === client.id).map(t => ({
      id: t.id, title: t.title, description: t.description, priority: t.priority,
      status: t.status, due_date: t.due_date, created_at: t.created_at,
      author: t.author ? { id: t.author.id, first_name: t.author.first_name, last_name: t.author.last_name } : null,
    }))
    return HttpResponse.json({ status: 200, data: list })
  }),

  http.post('*/api/client/tasks/:id/status', async ({ request, params }) => {
    const client = getClientFromToken(request)
    if (!client) return HttpResponse.json({ status: 401, msg: 'Unauthorized' }, { status: 401 })
    const body = (await request.json()) as { status: string }
    if (!['pending', 'in_progress', 'completed'].includes(body.status)) {
      return HttpResponse.json({ status: 400, msg: 'Invalid status' }, { status: 400 })
    }
    const idx = seedTasks.findIndex(t => t.id === Number(params.id) && t.client_id === client.id)
    if (idx === -1) return HttpResponse.json({ status: 404, msg: 'Task not found' }, { status: 404 })
    seedTasks[idx].status = body.status as any
    return HttpResponse.json({ status: 200, data: seedTasks[idx], msg: 'Status updated' })
  }),
]
