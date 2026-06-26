import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseAndValidateContent, validateContentIntegrity } from '../packages/shared/src/validate.js'

const contentPath = resolve(process.cwd(), 'content/content.sample.json')

console.log(`\nValidating: ${contentPath}\n`)

let raw: unknown
try {
  raw = JSON.parse(readFileSync(contentPath, 'utf-8'))
} catch (err) {
  console.error('Failed to read/parse JSON:', err)
  process.exit(1)
}

try {
  const content = parseAndValidateContent(raw)
  const warnings = validateContentIntegrity(content).filter((e) => e.startsWith('WARN'))

  console.log('✓ Schema validation passed')
  console.log('✓ Integrity check passed')
  console.log(`\nSummary:`)
  console.log(`  Periods : ${content.periods.length}`)
  console.log(`  Rooms   : ${content.rooms.length}`)
  console.log(`  Slots   : ${content.rooms.reduce((n, r) => n + r.slots.length, 0)} (${content.rooms.reduce((n, r) => n + r.slots.filter((s) => s.itemId !== null).length, 0)} assigned)`)
  console.log(`  Items   : ${content.items.length}`)
  console.log(`  Textures: ${content.textures.length}`)

  if (warnings.length > 0) {
    console.log('\nWarnings:')
    warnings.forEach((w) => console.log(`  ${w}`))
  }

  console.log('\n✓ Content is valid and ready to use.\n')
} catch (err) {
  console.error('\n✗ Validation failed:\n')
  console.error((err as Error).message)
  process.exit(1)
}
