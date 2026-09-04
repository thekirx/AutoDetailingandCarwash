/**
 * Assert P1/P2 audit checklist hardening + P3 prompt stagger / chunks.
 * node scripts/check-audit-p2.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

assert.equal(existsSync(join(root, 'src/pages/CustomerLoginPage.jsx')), false)

const publicPages = read('src/pages/PublicPages.jsx')
assert.match(publicPages, /Marketing overview/)

const queue = read('src/pages/PublicUtilityPage.jsx')
assert.doesNotMatch(queue, /useParams/)
assert.doesNotMatch(queue, /Redirecting to live queue/)

const ops = read('src/pages/OperationsPages.jsx')
assert.match(ops, /handoffs ready for POS checkout/)
assert.doesNotMatch(ops, /future POS/)

const auth = read('src/auth/AuthProvider.jsx')
assert.match(auth, /keep last profile on transient/)
assert.doesNotMatch(auth, /\.catch\(\(\) => setProfile\(null\)\)/)

const finance = read('src/pages/FinancePage.jsx')
assert.match(finance, /Unable to load finance data/)

const pos = read('src/pages/PosPage.jsx')
assert.match(pos, /stats\.error/)
assert.match(pos, /getAccessTokenFresh/)
assert.match(pos, /customer notify failed/)

const reports = read('src/pages/ReportsPage.jsx')
assert.match(reports, /lines\.error/)

const sms = read('src/pages/SmsPage.jsx')
assert.match(sms, /t\.error/)
assert.match(sms, /getAccessTokenFresh/)
assert.doesNotMatch(sms, /09625294043/)

const booking = read('src/pages/BookingBoardPage.jsx')
assert.match(booking, /getAccessTokenFresh/)

const crm = read('src/pages/CrmPage.jsx')
assert.match(crm, /l\.error/)
assert.match(crm, /getAccessTokenFresh/)

const adminApi = read('src/lib/adminApi.js')
assert.match(adminApi, /getAccessTokenFresh/)
assert.doesNotMatch(adminApi, /getSession\(\)/)

const queueApi = read('src/queue/queueApi.js')
assert.match(queueApi, /getAccessTokenFresh/)
assert.doesNotMatch(queueApi, /getSession\(\)/)

const bookPage = read('src/pages/CustomerBookPage.jsx')
assert.match(bookPage, /svc\.error/)

const login = read('src/pages/LoginPage.jsx')
assert.match(login, /Unable to load your staff profile/)

const customerSignIn = read('src/pages/CustomerSignInPage.jsx')
assert.match(customerSignIn, /customerError/)

const vite = read('vite.config.js')
assert.match(vite, /manualChunks/)

const css = read('src/styles.css')
assert.match(css, /html:not\(\.dark\) \.floor-shell/)

const install = read('src/components/InstallGuide.jsx')
assert.match(install, /5200/)

const push = read('src/components/PushToggle.jsx')
assert.match(push, /hakum-prompt-busy/)

console.log('check-audit-p2: ok')
