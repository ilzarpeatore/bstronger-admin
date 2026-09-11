#!/usr/bin/env node
/**
 * Import script for ExerciseDB OSS v1.
 * Downloads body-parts, equipment and all available exercises
 * (1,500) into src/api/exercises/data/ as JSON files.
 *
 * Usage:
 *   node scripts/import-exercisedb.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'src', 'api', 'exercises', 'data')

const BASE_URL = 'https://oss.exercisedb.dev/api/v1'

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text}`)
      }
      return await res.json()
    } catch (err) {
      if (attempt === retries) throw err
      console.warn(`  Retry ${attempt}/${retries} for ${url}`)
      await sleep(1000 * attempt)
    }
  }
}

async function fetchAllExercises() {
  const exercises = []
  let after = null
  let page = 1

  while (true) {
    const params = new URLSearchParams({ limit: '25' })
    if (after) params.set('after', after)

    const url = `${BASE_URL}/exercises?${params}`
    console.log(`Fetching exercise list page ${page}...`)
    const res = await fetchJson(url)
    const items = res.data || []
    exercises.push(...items)

    console.log(`  Got ${items.length} exercises (total so far: ${exercises.length})`)

    if (!res.meta?.hasNextPage || !res.meta?.nextCursor) break
    after = res.meta.nextCursor
    page++
    // Be gentle with the OSS endpoint to avoid Cloudflare rate limits
    await sleep(3000)
  }

  return exercises
}

async function main() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }

  console.log('Fetching body parts...')
  const bodyPartsRes = await fetchJson(`${BASE_URL}/bodyparts`)
  const bodyParts = bodyPartsRes.data || []
  console.log(`  Got ${bodyParts.length} body parts`)

  console.log('Fetching equipment...')
  const equipmentRes = await fetchJson(`${BASE_URL}/equipments`)
  const equipments = equipmentRes.data || []
  console.log(`  Got ${equipments.length} equipment items`)

  const exercises = await fetchAllExercises()
  console.log(`\nTotal exercises downloaded: ${exercises.length}`)

  await writeFile(join(DATA_DIR, 'body-parts.json'), JSON.stringify(bodyParts, null, 2))
  await writeFile(join(DATA_DIR, 'equipment.json'), JSON.stringify(equipments, null, 2))
  await writeFile(join(DATA_DIR, 'exercises.json'), JSON.stringify(exercises, null, 2))

  console.log(`\nSaved data to ${DATA_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
