/**
 * Assert auth reset is Supabase-only; BusyBee stays on transactional notify.
 * node scripts/check-user-settings-auth.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const userSettings = read('src/lib/userSettings.js')
assert.match(userSettings, /sms_opt_in/)
assert.match(userSettings, /updateUser/)

const notify = read('server/notifyBooking.mjs')
assert.match(notify, /busybeeSendSms/)
assert.match(notify, /sms_opt_in/)
assert.match(notify, /getUserById/)

const lookup = read('server/customerAuthLookup.mjs')
assert.doesNotMatch(lookup, /busybeeSendSms/)
assert.doesNotMatch(lookup, /sms_events/)
assert.match(lookup, /resetPasswordForEmail/)
assert.match(lookup, /via: 'email'/)
assert.match(lookup, /customers\.hakumautocare\.com/)

const main = read('src/main.jsx')
assert.match(main, /ThemeProvider/)

const settingsModal = read('src/components/UserSettingsModal.jsx')
assert.match(settingsModal, /setTheme/)
assert.match(settingsModal, /PushToggle/)
assert.match(settingsModal, /saveSmsOptIn/)

const ops = read('src/layouts/OperationsLayout.jsx')
assert.match(ops, /UserSettingsModal/)

const admin = read('src/layouts/AdminLayout.jsx')
assert.match(admin, /UserSettingsModal/)

const login = read('src/pages/LoginPage.jsx')
assert.match(login, /resetPasswordForEmail/)
assert.match(login, /Forgot password/)

const customerSignIn = read('src/pages/CustomerSignInPage.jsx')
assert.doesNotMatch(customerSignIn, /viaSms|sms_status|phone and email/)
assert.match(customerSignIn, /Password reset email sent/)

const setPw = read('src/pages/CustomerSetPasswordPage.jsx')
assert.match(setPw, /redirectForRole/)
assert.match(setPw, /Open the reset link from your email/)

console.log('check-user-settings-auth: ok')
