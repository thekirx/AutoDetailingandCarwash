import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const p = 'src/queue/staffTaskLogic.js'
const orig = fs.readFileSync(p, 'utf8')
const broken = orig.replace(
  "pending: new Set(['active'])",
  "pending: new Set(['active', 'released'])",
)
fs.writeFileSync(p, broken)
const red = spawnSync(process.execPath, ['--test', 'tests/staffScope.test.js'], { encoding: 'utf8' })
fs.writeFileSync(p, orig)
const green = spawnSync(process.execPath, ['--test', 'tests/staffScope.test.js'], { encoding: 'utf8' })
console.log('RED exit', red.status)
console.log(red.stdout.match(/fail \d+|pass \d+/g)?.join(' | '))
console.log('GREEN exit', green.status)
console.log(green.stdout.match(/fail \d+|pass \d+/g)?.join(' | '))
process.exit(red.status !== 0 && green.status === 0 ? 0 : 1)
