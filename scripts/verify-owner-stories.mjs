/**
 * Verify owner pack: HTML has all role/page tabs, no mermaid, PDF exists.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const htmlPath = path.join(root, 'docs/user-stories/USER-STORIES-OWNER.html')
const pdfPath = path.join(root, 'docs/user-stories/USER-STORIES-OWNER.pdf')

if (!existsSync(htmlPath) || !existsSync(pdfPath)) {
  console.error('Missing HTML or PDF')
  process.exit(1)
}

const t = readFileSync(htmlPath, 'utf8')
if (/mermaid|flowchart TB|flowchart LR/i.test(t)) {
  console.error('Flowcharts/mermaid found — owner pack must be stories only')
  process.exit(1)
}

const required = [
  'panel-start',
  'panel-shop',
  'panel-pay',
  'panel-close',
  'panel-role-owner',
  'panel-role-asa',
  'panel-role-ba',
  'panel-role-tl',
  'panel-role-crew',
  'panel-role-ops',
  'panel-role-sales',
  'panel-role-detailer',
  'panel-role-mkt',
  'panel-role-video',
  'panel-role-inv',
  'panel-role-customer',
  'panel-pages',
]
for (const id of required) {
  if (!t.includes(id)) {
    console.error('Missing panel', id)
    process.exit(1)
  }
}

const stories = (t.match(/class="story"/g) || []).length
const tabs = (t.match(/class="tab-btn/g) || []).length
const pdfKb = Math.round(statSync(pdfPath).size / 1024)
if (stories < 40) {
  console.error('Too few stories', stories)
  process.exit(1)
}
if (pdfKb < 100) {
  console.error('PDF too small', pdfKb)
  process.exit(1)
}

console.log(`OK — ${tabs} tabs, ${stories} stories, PDF ${pdfKb} KB, no flowcharts`)
