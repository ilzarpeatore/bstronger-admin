import { http, HttpResponse } from 'msw'
import type { DashboardBodyPart, DashboardEquipment, DashboardExercise } from './adapter'
import {
  adaptBodyParts,
  adaptEquipment,
  adaptExercises,
  adaptLevels,
  createBodyPartIdMap,
  createEquipmentIdMap,
  slugify,
} from './adapter'

import bodyPartsRaw from './data/body-parts.json'
import equipmentRaw from './data/equipment.json'
import exercisesRaw from './data/exercises.json'

// Mutable in-memory stores so create/update/delete work during the session
const bodyParts = adaptBodyParts(bodyPartsRaw)
const equipment = adaptEquipment(equipmentRaw)
const levels = adaptLevels()
const exercises = adaptExercises(exercisesRaw, createBodyPartIdMap(bodyPartsRaw), createEquipmentIdMap(equipmentRaw))

let nextBodyPartId = Math.max(...bodyParts.map((b) => b.id), 0) + 1
let nextEquipmentId = Math.max(...equipment.map((e) => e.id), 0) + 1
let nextExerciseId = Math.max(...exercises.map((e) => e.id), 0) + 1

function now(): string {
  return new Date().toISOString()
}

function formValue(formData: FormData, key: string, fallback: string | null = null): string | null {
  const v = formData.get(key)
  if (v === null) return fallback
  const s = String(v).trim()
  return s === '' ? fallback : s
}

function formNumber(formData: FormData, key: string, fallback: number | null = null): number | null {
  const s = formValue(formData, key)
  if (s === null) return fallback
  const n = Number(s)
  return Number.isFinite(n) ? n : fallback
}

function parseBodyPartIds(formData: FormData, fallback: number[] | null): number[] | null {
  const raw = formData.get('bodypart_ids')
  if (raw === null) return fallback
  try {
    const parsed = JSON.parse(String(raw)) as number[]
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function findExerciseIndexById(id: number) {
  return exercises.findIndex((e) => e.id === id)
}

function findBodyPartIndexById(id: number) {
  return bodyParts.findIndex((b) => b.id === id)
}

function findEquipmentIndexById(id: number) {
  return equipment.findIndex((e) => e.id === id)
}

function filterExercises(search: string) {
  const term = search.trim().toLowerCase()
  if (!term) return exercises
  return exercises.filter((e) =>
    e.title.toLowerCase().includes(term) ||
    (e.bodypart_names?.toLowerCase().includes(term) ?? false) ||
    (e.equipment_title?.toLowerCase().includes(term) ?? false) ||
    e.keywords.some((k) => k.toLowerCase().includes(term)),
  )
}

export const ExerciseHandlers = [
  // Body parts
  http.get('/admin/body-parts', ({ request }) => {
    const url = new URL(request.url)
    const perPage = url.searchParams.get('per_page')
    const search = url.searchParams.get('search')?.toLowerCase() || ''
    let data = bodyParts
    if (search) {
      data = bodyParts.filter((b) => b.title.toLowerCase().includes(search))
    }
    if (perPage === '-1') {
      return HttpResponse.json(data)
    }
    return HttpResponse.json({ data })
  }),

  http.post('/admin/body-parts', async ({ request }) => {
    const payload = (await request.json()) as Partial<DashboardBodyPart>
    const item: DashboardBodyPart = {
      id: nextBodyPartId++,
      title: payload.title || 'Sin título',
      slug: payload.slug || slugify(payload.title || 'sin-titulo'),
      status: payload.status || 'active',
      created_at: now(),
      updated_at: now(),
    }
    bodyParts.push(item)
    return HttpResponse.json({ data: item }, { status: 201 })
  }),

  http.put('/admin/body-parts/:id', async ({ request, params }) => {
    const id = Number(params.id)
    const index = findBodyPartIndexById(id)
    if (index === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    const payload = (await request.json()) as Partial<DashboardBodyPart>
    bodyParts[index] = {
      ...bodyParts[index],
      ...payload,
      updated_at: now(),
    }
    return HttpResponse.json({ data: bodyParts[index] })
  }),

  http.delete('/admin/body-parts/:id', ({ params }) => {
    const id = Number(params.id)
    const index = findBodyPartIndexById(id)
    if (index === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    bodyParts.splice(index, 1)
    return HttpResponse.json({ message: 'Deleted' })
  }),

  // Equipment
  http.get('/admin/equipment', ({ request }) => {
    const url = new URL(request.url)
    const perPage = url.searchParams.get('per_page')
    const search = url.searchParams.get('search')?.toLowerCase() || ''
    let data = equipment
    if (search) {
      data = equipment.filter((e) => e.title.toLowerCase().includes(search))
    }
    if (perPage === '-1') {
      return HttpResponse.json(data)
    }
    return HttpResponse.json({ data })
  }),

  http.post('/admin/equipment', async ({ request }) => {
    const payload = (await request.json()) as Partial<DashboardEquipment>
    const item: DashboardEquipment = {
      id: nextEquipmentId++,
      title: payload.title || 'Sin título',
      slug: payload.slug || slugify(payload.title || 'sin-titulo'),
      status: payload.status || 'active',
      created_at: now(),
      updated_at: now(),
    }
    equipment.push(item)
    return HttpResponse.json({ data: item }, { status: 201 })
  }),

  http.put('/admin/equipment/:id', async ({ request, params }) => {
    const id = Number(params.id)
    const index = findEquipmentIndexById(id)
    if (index === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    const payload = (await request.json()) as Partial<DashboardEquipment>
    equipment[index] = {
      ...equipment[index],
      ...payload,
      updated_at: now(),
    }
    return HttpResponse.json({ data: equipment[index] })
  }),

  http.delete('/admin/equipment/:id', ({ params }) => {
    const id = Number(params.id)
    const index = findEquipmentIndexById(id)
    if (index === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    equipment.splice(index, 1)
    return HttpResponse.json({ message: 'Deleted' })
  }),

  // Levels
  http.get('/admin/levels', ({ request }) => {
    const url = new URL(request.url)
    const perPage = url.searchParams.get('per_page')
    if (perPage === '-1') {
      return HttpResponse.json(levels)
    }
    return HttpResponse.json({ data: levels })
  }),

  // Exercises
  http.get('/admin/exercises', ({ request }) => {
    const url = new URL(request.url)
    const perPage = url.searchParams.get('per_page')
    const search = url.searchParams.get('search') || ''
    const data = filterExercises(search)
    if (perPage === '-1') {
      return HttpResponse.json(data)
    }
    return HttpResponse.json({ data })
  }),

  http.post('/admin/exercises', async ({ request }) => {
    const formData = await request.formData()
    const title = formValue(formData, 'title') || 'Sin título'

    const bodypartIds = parseBodyPartIds(formData, null)
    const bodypartNames = bodypartIds?.length
      ? bodyParts
          .filter((b) => bodypartIds!.includes(b.id))
          .map((b) => b.title)
          .join(', ')
      : null

    const levelId = formNumber(formData, 'level_id')
    const levelTitle = levelId ? levels.find((l) => l.id === levelId)?.title ?? null : null
    const equipmentId = formNumber(formData, 'equipment_id')
    const equipmentTitle = equipmentId ? equipment.find((e) => e.id === equipmentId)?.title ?? null : null

    const item: DashboardExercise = {
      id: nextExerciseId++,
      title,
      slug: slugify(title),
      exercise_image: null,
      level_id: levelId,
      level_title: levelTitle,
      equipment_id: equipmentId,
      equipment_title: equipmentTitle,
      bodypart_ids: bodypartIds,
      bodypart_names: bodypartNames,
      type: formValue(formData, 'type'),
      based: formValue(formData, 'based'),
      duration: formValue(formData, 'duration'),
      seconds_per_rep: formNumber(formData, 'seconds_per_rep'),
      is_premium: String(formValue(formData, 'is_premium', '0')) === '1',
      status: formValue(formData, 'status', 'active') || 'active',
      created_at: now(),
      updated_at: now(),
      instruction: formValue(formData, 'instruction'),
      tips: formValue(formData, 'tips'),
      video_type: formValue(formData, 'video_type'),
      video_url: formValue(formData, 'video_url'),
      exerciseDbId: `local_${nextExerciseId}`,
      targetMuscles: [],
      secondaryMuscles: [],
      instructions: [],
      keywords: [],
    }
    exercises.push(item)
    return HttpResponse.json({ data: item }, { status: 201 })
  }),

  http.put('/admin/exercises/:id', async ({ request, params }) => {
    const id = Number(params.id)
    const index = findExerciseIndexById(id)
    if (index === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    const formData = await request.formData()
    const current = exercises[index]

    const title = formValue(formData, 'title', current.title) || current.title

    const bodypartIds = parseBodyPartIds(formData, current.bodypart_ids)
    const bodypartNames = bodypartIds?.length
      ? bodyParts
          .filter((b) => bodypartIds!.includes(b.id))
          .map((b) => b.title)
          .join(', ')
      : null

    const levelId = formNumber(formData, 'level_id', current.level_id)
    const levelTitle = levelId ? levels.find((l) => l.id === levelId)?.title ?? null : null
    const equipmentId = formNumber(formData, 'equipment_id', current.equipment_id)
    const equipmentTitle = equipmentId ? equipment.find((e) => e.id === equipmentId)?.title ?? null : null

    exercises[index] = {
      ...current,
      title,
      slug: slugify(title),
      instruction: formValue(formData, 'instruction', current.instruction),
      tips: formValue(formData, 'tips', current.tips),
      type: formValue(formData, 'type', current.type),
      based: formValue(formData, 'based', current.based),
      duration: formValue(formData, 'duration', current.duration),
      seconds_per_rep: formNumber(formData, 'seconds_per_rep', current.seconds_per_rep),
      is_premium: String(formValue(formData, 'is_premium', String(current.is_premium))) === '1',
      status: formValue(formData, 'status', current.status) ?? current.status,
      level_id: levelId,
      level_title: levelTitle,
      equipment_id: equipmentId,
      equipment_title: equipmentTitle,
      bodypart_ids: bodypartIds,
      bodypart_names: bodypartNames,
      video_type: formValue(formData, 'video_type', current.video_type),
      video_url: formValue(formData, 'video_url', current.video_url),
      updated_at: now(),
    }
    return HttpResponse.json({ data: exercises[index] })
  }),

  http.delete('/admin/exercises/:id', ({ params }) => {
    const id = Number(params.id)
    const index = findExerciseIndexById(id)
    if (index === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    exercises.splice(index, 1)
    return HttpResponse.json({ message: 'Deleted' })
  }),
]

export { bodyParts, equipment, levels, exercises }
