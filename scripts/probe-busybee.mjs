/**
 * Probe BusyBee Balance — reads credentials from .env only (never hardcode keys).
 * Usage: node scripts/probe-busybee.mjs [baseUrl]
 */
import { readFileSync, existsSync } from 'node:fs'
import { busybeeBalance } from '../server/busybee.mjs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

if (process.argv[2]) process.env.BUSYBEE_API_BASE_URL = process.argv[2]

const bal = await busybeeBalance().catch((e) => ({ ok: false, error: e.message }))
console.log(JSON.stringify(bal, null, 2).slice(0, 800))
process.exit(bal.ok ? 0 : bal.status === 429 ? 0 : 1)
