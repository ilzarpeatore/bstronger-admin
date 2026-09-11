import { http, HttpResponse } from 'msw'

// ─── Types ───────────────────────────────────────────────────────────────────
type FormItem = { id: number; title: string; description: string | null; recurrence: string | null; questions_count: number }
type FormQuestion = { id: number; form_id: number; question_text: string; type: string; order: number; is_required: boolean; options: string[] | null; max_files: number | null; metric_id: number | null; sync_type: string | null; allow_multiple: boolean; placeholder: string | null; scale_max: number; star_max: number }
type FormAssignment = { id: number; form_id: number; client_id: number; active: boolean; created_at: string; submitted: boolean; submitted_at: string | null; latest_submission_id: number | null }
type FormSubmission = { id: number; form_assignment_id: number; submitted_at: string; coach_feedback: string | null; answers: { id: number; form_submission_id: number; form_question_id: number; answer_value: string | null }[] }
type ClientUser = { id: number; first_name: string; last_name: string; email: string; token: string }

// ─── Seed data ────────────────────────────────────────────────────────────────
const clients: ClientUser[] = [
  { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com', token: 'client-token-john' },
  { id: 2, first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com', token: 'client-token-jane' },
]
let nextFormId = 2
let nextQuestionId = 10
let nextAssignmentId = 3
let nextSubmissionId = 3
let nextAnswerId = 20

const forms: FormItem[] = [
  { id: 1, title: 'Weekly Check-In', description: 'Standard weekly check-in form', recurrence: 'weekly', questions_count: 3 },
  { id: 2, title: 'Monthly Progress', description: 'End of month progress review', recurrence: 'monthly', questions_count: 0 },
]
const questions: FormQuestion[] = [
  { id: 1, form_id: 1, question_text: 'How are you feeling this week?', type: 'textarea', order: 1, is_required: true, options: null, max_files: null, metric_id: null, sync_type: null, allow_multiple: false, placeholder: 'Share your thoughts...', scale_max: 10, star_max: 5 },
  { id: 2, form_id: 1, question_text: 'Rate your energy level', type: 'scale', order: 2, is_required: true, options: null, max_files: null, metric_id: null, sync_type: null, allow_multiple: false, placeholder: null, scale_max: 10, star_max: 5 },
  { id: 3, form_id: 1, question_text: 'Did you complete all workouts?', type: 'yes_no', order: 3, is_required: true, options: null, max_files: null, metric_id: null, sync_type: null, allow_multiple: false, placeholder: null, scale_max: 10, star_max: 5 },
  { id: 4, form_id: 2, question_text: 'Monthly goal check', type: 'text', order: 1, is_required: true, options: null, max_files: null, metric_id: null, sync_type: null, allow_multiple: false, placeholder: 'Describe your progress', scale_max: 10, star_max: 5 },
  { id: 5, form_id: 2, question_text: 'Weight', type: 'metric', order: 2, is_required: false, options: null, max_files: null, metric_id: 1, sync_type: 'weight', allow_multiple: false, placeholder: null, scale_max: 10, star_max: 5 },
]
const assignments: FormAssignment[] = [
  { id: 1, form_id: 1, client_id: 1, active: true, created_at: '2026-06-01T00:00:00Z', submitted: true, submitted_at: '2026-06-07T12:00:00Z', latest_submission_id: 1 },
  { id: 2, form_id: 2, client_id: 1, active: true, created_at: '2026-06-01T00:00:00Z', submitted: false, submitted_at: null, latest_submission_id: null },
]
const submissions: FormSubmission[] = [
  {
    id: 1, form_assignment_id: 1, submitted_at: '2026-06-07T12:00:00Z', coach_feedback: 'Great week! Keep it up.',
    answers: [
      { id: 1, form_submission_id: 1, form_question_id: 1, answer_value: 'Feeling great this week!' },
      { id: 2, form_submission_id: 1, form_question_id: 2, answer_value: '8' },
      { id: 3, form_submission_id: 1, form_question_id: 3, answer_value: 'yes' },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getClientFromToken(request: Request): ClientUser | null {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '')
  return clients.find(c => c.token === token) || null
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
export const FormHandlers = [
  // ═══ ADMIN: Form CRUD ════════════════════════════════════════════════════════
  http.get('*/admin/admin-form-list', ({ request }) => {
    const url = new URL(request.url)
    const perPage = Number(url.searchParams.get('per_page')) || 100
    const page = Number(url.searchParams.get('page')) || 1
    const total = forms.length
    const start = (page - 1) * perPage
    const items = forms.slice(start, start + perPage).map(f => ({
      ...f,
      questions_count: questions.filter(q => q.form_id === f.id).length,
    }))
    return HttpResponse.json({ status: 200, data: { data: items, total, current_page: page, per_page: perPage } })
  }),

  http.get('*/admin/admin-form-detail', ({ request }) => {
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    const form = forms.find(f => f.id === id)
    if (!form) return HttpResponse.json({ status: 404, msg: 'Form not found' }, { status: 404 })
    const qs = questions.filter(q => q.form_id === id).sort((a, b) => a.order - b.order)
    return HttpResponse.json({ status: 200, data: { ...form, questions: qs } })
  }),

  http.post('*/admin/admin-form-store', async ({ request }) => {
    const body = (await request.json()) as any
    const id = nextFormId++
    const form: FormItem = { id, title: body.title || 'Untitled', description: body.description || null, recurrence: body.recurrence || null, questions_count: 0 }
    forms.push(form)
    return HttpResponse.json({ status: 200, data: form, msg: 'Form created' })
  }),

  http.post('*/admin/admin-form-delete', async ({ request }) => {
    const body = (await request.json()) as { id: number }
    const idx = forms.findIndex(f => f.id === body.id)
    if (idx === -1) return HttpResponse.json({ status: 404, msg: 'Not found' }, { status: 404 })
    forms.splice(idx, 1)
    return HttpResponse.json({ status: 200, msg: 'Deleted' })
  }),

  // ═══ ADMIN: Question CRUD ════════════════════════════════════════════════════
  http.post('*/admin/admin-form-question-store', async ({ request }) => {
    const body = (await request.json()) as any
    const id = nextQuestionId++
    const q: FormQuestion = { id, form_id: body.form_id, question_text: body.question_text || 'New question', type: body.type || 'text', order: body.order || 0, is_required: body.is_required !== undefined ? body.is_required : true, options: body.options || null, max_files: body.max_files || null, metric_id: body.metric_id || null, sync_type: body.sync_type || null, allow_multiple: body.allow_multiple || false, placeholder: body.placeholder || null, scale_max: body.scale_max || 10, star_max: body.star_max || 5 }
    questions.push(q)
    const form = forms.find(f => f.id === body.form_id)
    if (form) form.questions_count = questions.filter(x => x.form_id === body.form_id).length
    return HttpResponse.json({ status: 200, data: q, msg: 'Question created' })
  }),

  http.post('*/admin/admin-form-question-delete', async ({ request }) => {
    const body = (await request.json()) as { id: number }
    const idx = questions.findIndex(q => q.id === body.id)
    if (idx === -1) return HttpResponse.json({ status: 404, msg: 'Not found' }, { status: 404 })
    const removed = questions[idx]
    questions.splice(idx, 1)
    const form = forms.find(f => f.id === removed.form_id)
    if (form) form.questions_count = questions.filter(x => x.form_id === removed.form_id).length
    return HttpResponse.json({ status: 200, msg: 'Deleted' })
  }),

  // ═══ ADMIN: Assignments ══════════════════════════════════════════════════════
  http.post('*/admin/admin-form-assign', async ({ request }) => {
    const body = (await request.json()) as { form_id: number; client_id: number }
    const id = nextAssignmentId++
    const assignment: FormAssignment = { id, form_id: body.form_id, client_id: body.client_id, active: true, created_at: new Date().toISOString(), submitted: false, submitted_at: null, latest_submission_id: null }
    assignments.push(assignment)
    return HttpResponse.json({ status: 200, data: assignment, msg: 'Form assigned' })
  }),

  http.get('*/admin/admin-form-assigned-list', ({ request }) => {
    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')
    const list = assignments.filter(a => !clientId || String(a.client_id) === clientId).map(a => {
      const form = forms.find(f => f.id === a.form_id)
      const qs = questions.filter(q => q.form_id === a.form_id).sort((x, y) => x.order - y.order)
      return { ...a, form: { ...form, questions: qs }, client: clients.find(c => c.id === a.client_id) || null }
    })
    return HttpResponse.json({ status: 200, data: list })
  }),

  // ═══ ADMIN: Submissions ══════════════════════════════════════════════════════
  http.get('*/admin/admin-form-submission-list', ({ request }) => {
    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')
    const formId = url.searchParams.get('form_id')
    const perPage = Number(url.searchParams.get('per_page')) || 100
    let list = submissions
    if (clientId) {
      const clientAssignmentIds = assignments.filter(a => String(a.client_id) === clientId).map(a => a.id)
      list = list.filter(s => clientAssignmentIds.includes(s.form_assignment_id))
    }
    if (formId && formId !== 'all' && formId !== '') {
      const formAssignmentIds = assignments.filter(a => a.form_id === Number(formId)).map(a => a.id)
      list = list.filter(s => formAssignmentIds.includes(s.form_assignment_id))
    }
    const result = list.slice(0, perPage).map(s => {
      const assignment = assignments.find(a => a.id === s.form_assignment_id)
      const form = assignment ? forms.find(f => f.id === assignment.form_id) : null
      const client = assignment ? clients.find(c => c.id === assignment.client_id) : null
      const enrichedAnswers = s.answers.map(a => {
        const q = questions.find(qq => qq.id === a.form_question_id)
        return { ...a, question: q }
      })
      return { ...s, answers: enrichedAnswers, form_assignment: { id: assignment?.id, form_id: assignment?.form_id, client_id: assignment?.client_id, form, client } }
    })
    return HttpResponse.json({ status: 200, data: { data: result, total: list.length } })
  }),

  http.post('*/admin/admin-form-feedback', async ({ request }) => {
    const body = (await request.json()) as { submission_id: number; coach_feedback: string }
    const sub = submissions.find(s => s.id === body.submission_id)
    if (!sub) return HttpResponse.json({ status: 404, msg: 'Submission not found' }, { status: 404 })
    sub.coach_feedback = body.coach_feedback
    return HttpResponse.json({ status: 200, msg: 'Feedback saved', data: sub })
  }),

  // ═══ CLIENT: Auth ════════════════════════════════════════════════════════════
  http.post('*/api/client/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    const client = clients.find(c => c.email === body.email)
    if (!client) return HttpResponse.json({ status: 401, msg: 'Invalid credentials' }, { status: 401 })
    return HttpResponse.json({ status: 200, data: { id: client.id, first_name: client.first_name, last_name: client.last_name, email: client.email }, token: client.token })
  }),

  http.get('*/api/client/me', ({ request }) => {
    const client = getClientFromToken(request)
    if (!client) return HttpResponse.json({ status: 401, msg: 'Unauthorized' }, { status: 401 })
    return HttpResponse.json({ status: 200, data: { id: client.id, first_name: client.first_name, last_name: client.last_name, email: client.email } })
  }),

  http.post('*/api/client/logout', () => {
    return HttpResponse.json({ status: 200, msg: 'Logged out' })
  }),

  // ═══ CLIENT: Assigned forms ══════════════════════════════════════════════════
  http.get('*/api/client/assigned-forms', ({ request }) => {
    const client = getClientFromToken(request)
    if (!client) return HttpResponse.json({ status: 401, msg: 'Unauthorized' }, { status: 401 })
    const list = assignments.filter(a => a.client_id === client.id && a.active).map(a => {
      const form = forms.find(f => f.id === a.form_id)
      return { id: a.id, form_id: a.form_id, form, submitted: a.submitted, submitted_at: a.submitted_at, latest_submission_id: a.latest_submission_id, created_at: a.created_at }
    })
    return HttpResponse.json({ status: 200, data: list })
  }),

  // ═══ CLIENT: Form detail with questions ══════════════════════════════════════
  http.get('*/api/client/form/:id', ({ request, params }) => {
    const client = getClientFromToken(request)
    if (!client) return HttpResponse.json({ status: 401, msg: 'Unauthorized' }, { status: 401 })
    const assignmentId = Number(params.id)
    const assignment = assignments.find(a => a.id === assignmentId && a.client_id === client.id)
    if (!assignment) return HttpResponse.json({ status: 404, msg: 'Assignment not found' }, { status: 404 })
    const form = forms.find(f => f.id === assignment.form_id)
    if (!form) return HttpResponse.json({ status: 404, msg: 'Form not found' }, { status: 404 })
    const qs = questions.filter(q => q.form_id === form.id).sort((a, b) => a.order - b.order)
    return HttpResponse.json({ status: 200, data: { assignment: { id: assignment.id, submitted: assignment.submitted, submitted_at: assignment.submitted_at }, form: { ...form, questions: qs } } })
  }),

  // ═══ CLIENT: Submit answers ══════════════════════════════════════════════════
  http.post('*/api/client/form-submit', async ({ request }) => {
    const client = getClientFromToken(request)
    if (!client) return HttpResponse.json({ status: 401, msg: 'Unauthorized' }, { status: 401 })
    const body = (await request.json()) as { assignment_id: number; answers: { question_id: number; value: string }[] }
    const assignment = assignments.find(a => a.id === body.assignment_id && a.client_id === client.id)
    if (!assignment) return HttpResponse.json({ status: 404, msg: 'Assignment not found' }, { status: 404 })
    if (assignment.submitted) return HttpResponse.json({ status: 400, msg: 'Already submitted' }, { status: 400 })
    const id = nextSubmissionId++
    const subAnswers = body.answers.map(a => ({ id: nextAnswerId++, form_submission_id: id, form_question_id: a.question_id, answer_value: a.value }))
    const sub: FormSubmission = { id, form_assignment_id: body.assignment_id, submitted_at: new Date().toISOString(), coach_feedback: null, answers: subAnswers }
    submissions.push(sub)
    assignment.submitted = true
    assignment.submitted_at = sub.submitted_at
    assignment.latest_submission_id = id
    return HttpResponse.json({ status: 200, data: { id, submitted_at: sub.submitted_at }, msg: 'Submitted' })
  }),

  // ═══ CLIENT: Submission history ══════════════════════════════════════════════
  http.get('*/api/client/submissions', ({ request }) => {
    const client = getClientFromToken(request)
    if (!client) return HttpResponse.json({ status: 401, msg: 'Unauthorized' }, { status: 401 })
    const clientAssignmentIds = assignments.filter(a => a.client_id === client.id).map(a => a.id)
    const list = submissions.filter(s => clientAssignmentIds.includes(s.form_assignment_id)).map(s => {
      const assignment = assignments.find(a => a.id === s.form_assignment_id)
      const form = assignment ? forms.find(f => f.id === assignment.form_id) : null
      const enrichedAnswers = s.answers.map(a => {
        const q = questions.find(qq => qq.id === a.form_question_id)
        return { ...a, question: q }
      })
      return { id: s.id, submitted_at: s.submitted_at, coach_feedback: s.coach_feedback, form: form ? { id: form.id, title: form.title } : null, answers: enrichedAnswers }
    })
    return HttpResponse.json({ status: 200, data: list })
  }),

]
