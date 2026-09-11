export type ExerciseDbBodyPart = {
  name: string
}

export type ExerciseDbEquipment = {
  name: string
}

export type ExerciseDbExercise = {
  exerciseId: string
  name: string
  gifUrl: string
  bodyParts: string[]
  equipments: string[]
  targetMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  tips?: string | null
  level?: 'beginner' | 'intermediate' | 'expert' | string
  type?: 'cardio' | 'strength' | string
}

export type ExerciseDbPaginatedResponse<T> = {
  success: boolean
  meta: {
    total: number
    hasNextPage: boolean
    hasPreviousPage: boolean
    nextCursor?: string
    previousCursor?: string
  }
  data: T[]
}

export type ExerciseDbListResponse<T> = {
  success: boolean
  data: T[]
}
