import { describe, it, expect } from 'vitest'
import { exercises, bodyParts, equipment, levels } from './exercise-data'

describe('ExerciseDB mock data', () => {
  it('loads imported exercises', () => {
    expect(exercises.length).toBeGreaterThan(0)
  })

  it('loads body parts', () => {
    expect(bodyParts.length).toBeGreaterThan(0)
  })

  it('loads equipment', () => {
    expect(equipment.length).toBeGreaterThan(0)
  })

  it('loads levels', () => {
    expect(levels.length).toBe(3)
  })

  it('maps exercise data to dashboard format', () => {
    const first = exercises[0]
    expect(first.id).toBe(1)
    expect(first.title).toBeTruthy()
    expect(first.slug).toBeTruthy()
    expect(first.status).toBe('active')
  })
})
