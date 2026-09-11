import { http, HttpResponse } from 'msw'

type ClientUser = { id: number; first_name: string; last_name: string; email: string; token: string }

const clients: ClientUser[] = [
  { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com', token: 'client-token-john' },
  { id: 2, first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com', token: 'client-token-jane' },
]

type AdminHabit = {
  id: number
  client_id: number
  title: string
  emoji: string | null
  description: string | null
  goal_value: number | null
  goal_unit: string | null
  frequency: string | null
  duration_enabled: boolean
  reminder_enabled: boolean
  reminder_time: string | null
  reminder_message: string | null
  current_streak: number
  created_at: string
}

type HabitLog = {
  id: number
  habit_id: number
  date: string
  completed: boolean
  created_at: string
}

let nextHabitId = 3
let nextLogId = 10

const habits: AdminHabit[] = [
  { id: 1, client_id: 1, title: 'Daily Steps', emoji: '👟', description: 'Walk at least 10000 steps daily', goal_value: 10000, goal_unit: 'steps', frequency: 'daily', duration_enabled: false, reminder_enabled: true, reminder_time: '12:00', reminder_message: 'Time for your daily walk!', current_streak: 5, created_at: '2026-06-01T00:00:00Z' },
  { id: 2, client_id: 1, title: 'Meditate', emoji: '🧘', description: 'Daily meditation practice', goal_value: 10, goal_unit: 'min', frequency: 'daily', duration_enabled: false, reminder_enabled: true, reminder_time: '06:00', reminder_message: 'Morning meditation time', current_streak: 12, created_at: '2026-06-01T00:00:00Z' },
]

const logs: HabitLog[] = [
  { id: 1, habit_id: 1, date: '2026-07-25', completed: true, created_at: '2026-07-25T18:00:00Z' },
  { id: 2, habit_id: 1, date: '2026-07-26', completed: true, created_at: '2026-07-26T17:30:00Z' },
  { id: 3, habit_id: 1, date: '2026-07-27', completed: true, created_at: '2026-07-27T19:00:00Z' },
  { id: 4, habit_id: 2, date: '2026-07-25', completed: true, created_at: '2026-07-25T06:30:00Z' },
  { id: 5, habit_id: 2, date: '2026-07-26', completed: true, created_at: '2026-07-26T06:15:00Z' },
  { id: 6, habit_id: 2, date: '2026-07-27', completed: true, created_at: '2026-07-27T06:20:00Z' },
]

function getClientFromToken(request: Request): ClientUser | null {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '')
  return clients.find(c => c.token === token) || null
}

export const HabitHandlers = [
  // ═══ ADMIN: Habit CRUD ═══════════════════════════════════════════════════════
  http.get('*/admin/habit-list', ({ request }) => {
    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')
    const list = clientId ? habits.filter(h => h.client_id === Number(clientId)) : habits
    return HttpResponse.json({ status: 200, data: list })
  }),

  http.post('*/admin/habit-store', async ({ request }) => {
    const body = (await request.json()) as any
    const id = nextHabitId++
    const habit: AdminHabit = {
      id, client_id: Number(body.client_id), title: body.title || 'Untitled',
      emoji: body.emoji || null, description: body.description || null,
      goal_value: body.goal_value ?? null, goal_unit: body.goal_unit || null,
      frequency: body.frequency || 'daily', duration_enabled: !!body.duration_enabled,
      reminder_enabled: body.reminder_enabled !== undefined ? body.reminder_enabled : true,
      reminder_time: body.reminder_time || null, reminder_message: body.reminder_message || null,
      current_streak: 0, created_at: new Date().toISOString(),
    }
    habits.push(habit)
    return HttpResponse.json({ status: 200, data: habit, msg: 'Habit created' })
  }),

  http.post('*/admin/habit-update', async ({ request }) => {
    const body = (await request.json()) as any
    const idx = habits.findIndex(h => h.id === Number(body.id))
    if (idx === -1) return HttpResponse.json({ status: 404, msg: 'Habit not found' }, { status: 404 })
    const h = habits[idx]
    habits[idx] = {
      ...h,
      title: body.title ?? h.title,
      emoji: body.emoji !== undefined ? body.emoji : h.emoji,
      description: body.description !== undefined ? body.description : h.description,
      goal_value: body.goal_value !== undefined ? body.goal_value : h.goal_value,
      goal_unit: body.goal_unit !== undefined ? body.goal_unit : h.goal_unit,
      frequency: body.frequency ?? h.frequency,
      duration_enabled: body.duration_enabled !== undefined ? body.duration_enabled : h.duration_enabled,
      reminder_enabled: body.reminder_enabled !== undefined ? body.reminder_enabled : h.reminder_enabled,
      reminder_time: body.reminder_time !== undefined ? body.reminder_time : h.reminder_time,
      reminder_message: body.reminder_message !== undefined ? body.reminder_message : h.reminder_message,
    }
    return HttpResponse.json({ status: 200, data: habits[idx], msg: 'Habit updated' })
  }),

  http.post('*/admin/habit-delete', async ({ request }) => {
    const body = (await request.json()) as { id: number }
    const idx = habits.findIndex(h => h.id === body.id)
    if (idx === -1) return HttpResponse.json({ status: 404, msg: 'Habit not found' }, { status: 404 })
    habits.splice(idx, 1)
    return HttpResponse.json({ status: 200, msg: 'Deleted' })
  }),

  // ═══ CLIENT: View assigned habits ════════════════════════════════════════════
  http.get('*/api/client/habits', ({ request }) => {
    const client = getClientFromToken(request)
    if (!client) return HttpResponse.json({ status: 401, msg: 'Unauthorized' }, { status: 401 })
    const list = habits.filter(h => h.client_id === client.id).map(h => ({
      id: h.id, title: h.title, emoji: h.emoji, description: h.description,
      goal_value: h.goal_value, goal_unit: h.goal_unit, frequency: h.frequency,
      reminder_enabled: h.reminder_enabled, reminder_time: h.reminder_time,
      reminder_message: h.reminder_message, current_streak: h.current_streak,
      created_at: h.created_at,
    }))
    return HttpResponse.json({ status: 200, data: list })
  }),

  // ═══ CLIENT: Log habit completion ════════════════════════════════════════════
  http.post('*/api/client/habits/:id/log', async ({ request, params }) => {
    const client = getClientFromToken(request)
    if (!client) return HttpResponse.json({ status: 401, msg: 'Unauthorized' }, { status: 401 })
    const habitId = Number(params.id)
    const habit = habits.find(h => h.id === habitId && h.client_id === client.id)
    if (!habit) return HttpResponse.json({ status: 404, msg: 'Habit not found' }, { status: 404 })
    const body = (await request.json()) as { date?: string; value?: number }
    const today = new Date().toISOString().slice(0, 10)
    const logDate = body?.date || today
    const existing = logs.findIndex(l => l.habit_id === habitId && l.date === logDate)
    if (existing !== -1) {
      logs[existing].completed = true
      return HttpResponse.json({ status: 200, data: logs[existing], msg: 'Log updated' })
    }
    const id = nextLogId++
    const log: HabitLog = {
      id, habit_id: habitId, date: logDate, completed: true,
      created_at: new Date().toISOString(),
    }
    logs.push(log)
    habit.current_streak += 1
    return HttpResponse.json({ status: 200, data: log, msg: 'Logged' })
  }),
]
