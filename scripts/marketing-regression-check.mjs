import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const p = 'server/bookingStatusAccess.mjs'
const orig = fs.readFileSync(p, 'utf8')
const broken = orig.replace(
  'if (!next || !isCrmSafeBookingStatus(next)) return false',
  'if (!next) return false // BROKEN allow any status',
)
fs.writeFileSync(p, broken)
const red = spawnSync(process.execPath, ['--test', 'tests/marketingScope.test.js'], { encoding: 'utf8' })
fs.writeFileSync(p, orig)
const green = spawnSync(process.execPath, ['--test', 'tests/marketingScope.test.js'], { encoding: 'utf8' })
console.log('RED', red.status, red.stdout.match(/fail \d+|pass \d+/g)?.join(' | '))
console.log('GREEN', green.status, green.stdout.match(/fail \d+|pass \d+/g)?.join(' | '))
process.exit(red.status !== 0 && green.status === 0 ? 0 : 1)
