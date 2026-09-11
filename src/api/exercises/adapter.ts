import type {
  ExerciseDbBodyPart,
  ExerciseDbEquipment,
  ExerciseDbExercise,
} from './exercisedb-types'

export type DashboardBodyPart = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type DashboardEquipment = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type DashboardLevel = {
  id: number
  title: string
}

export type DashboardExercise = {
  id: number
  title: string
  slug: string
  exercise_image: string | null
  level_id: number | null
  level_title: string | null
  equipment_id: number | null
  equipment_title: string | null
  bodypart_ids: number[] | null
  bodypart_names: string | null
  type: string | null
  based: string | null
  duration: string | null
  seconds_per_rep: number | null
  is_premium: boolean
  status: string
  created_at: string
  updated_at: string
  instruction: string | null
  tips: string | null
  video_type: string | null
  video_url: string | null
  // Extra fields preserved from ExerciseDB for richer views
  exerciseDbId: string
  targetMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  keywords: string[]
}

const LEVELS: DashboardLevel[] = [
  { id: 1, title: 'Principiante' },
  { id: 2, title: 'Intermedio' },
  { id: 3, title: 'Avanzado' },
]

function now(): string {
  return new Date().toISOString()
}

export function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function createBodyPartIdMap(bodyParts: ExerciseDbBodyPart[]): Record<string, number> {
  const map: Record<string, number> = {}
  bodyParts.forEach((bp, index) => {
    map[bp.name.toLowerCase()] = index + 1
  })
  return map
}

export function createEquipmentIdMap(equipments: ExerciseDbEquipment[]): Record<string, number> {
  const map: Record<string, number> = {}
  equipments.forEach((eq, index) => {
    map[eq.name.toLowerCase()] = index + 1
  })
  return map
}

export function adaptBodyParts(bodyParts: ExerciseDbBodyPart[]): DashboardBodyPart[] {
  return bodyParts.map((bp, index) => ({
    id: index + 1,
    title: bp.name,
    slug: slugify(bp.name),
    status: 'active',
    created_at: now(),
    updated_at: now(),
  }))
}

export function adaptEquipment(equipments: ExerciseDbEquipment[]): DashboardEquipment[] {
  return equipments.map((eq, index) => ({
    id: index + 1,
    title: eq.name,
    slug: slugify(eq.name),
    status: 'active',
    created_at: now(),
    updated_at: now(),
  }))
}

export function adaptLevels(): DashboardLevel[] {
  return LEVELS
}

function assignLevel(name: string, category?: string): DashboardLevel {
  // Compound / demanding exercises default to intermediate
  const demanding = ['cardio', 'olympic weightlifting', 'plyometrics', 'strongman']
  const lower = name.toLowerCase()
  if (demanding.includes(category ?? '') || lower.includes('advanced') || lower.includes('expert')) {
    return LEVELS[2]
  }
  if (lower.includes('beginner')) {
    return LEVELS[0]
  }
  return LEVELS[1]
}

function levelFromKey(key?: string): DashboardLevel {
  if (key === 'beginner') return LEVELS[0]
  if (key === 'expert') return LEVELS[2]
  return LEVELS[1]
}

function generateKeywords(exercise: ExerciseDbExercise): string[] {
  return [
    exercise.name,
    ...exercise.bodyParts,
    ...exercise.equipments,
    ...exercise.targetMuscles,
    ...exercise.secondaryMuscles,
  ].filter(Boolean)
}

export function adaptExercises(
  exercises: ExerciseDbExercise[],
  bodyPartIdMap: Record<string, number>,
  equipmentIdMap: Record<string, number>,
): DashboardExercise[] {
  return exercises.map((ex, index) => {
    const bodypartIds = ex.bodyParts
      .map((name) => bodyPartIdMap[name.toLowerCase()])
      .filter((id): id is number => id !== undefined)

    const bodypartNames = ex.bodyParts.join(', ')

    const equipmentName = ex.equipments[0] || 'body weight'
    const equipmentId = equipmentIdMap[equipmentName.toLowerCase()] || null
    const level = ex.level ? levelFromKey(ex.level) : assignLevel(ex.name, ex.bodyParts[0]?.toLowerCase() === 'cardio' ? 'cardio' : undefined)

    return {
      id: index + 1,
      title: ex.name,
      slug: slugify(ex.name),
      exercise_image: ex.gifUrl || null,
      level_id: level.id,
      level_title: level.title,
      equipment_id: equipmentId,
      equipment_title: equipmentId ? equipmentName : null,
      bodypart_ids: bodypartIds.length ? bodypartIds : null,
      bodypart_names: bodypartNames || null,
      type: ex.type ?? (ex.bodyParts[0]?.toLowerCase() === 'cardio' ? 'cardio' : 'strength'),
      based: null,
      duration: null,
      seconds_per_rep: null,
      is_premium: false,
      status: 'active',
      created_at: now(),
      updated_at: now(),
      instruction: ex.instructions?.length ? ex.instructions.join('\n\n') : null,
      tips: ex.tips ?? null,
      video_type: ex.gifUrl ? 'gif' : null,
      video_url: ex.gifUrl || null,
      exerciseDbId: ex.exerciseId,
      targetMuscles: ex.targetMuscles,
      secondaryMuscles: ex.secondaryMuscles,
      instructions: ex.instructions,
      keywords: generateKeywords(ex),
    }
  })
}
