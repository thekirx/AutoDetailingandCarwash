import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NOTIFY_EVENTS, pickNotifyUrl, planStaffRecipients } from '../src/lib/notifyRouting.js'
import { opsRouteKeyFromPath } from '../src/auth/authRedirect.js'
import { DEFAULT_ASSISTANT_GRANTS } from '../src/auth/permissions.js'

/**
 * "A notification nobody can open" is the quietest failure in this app.
 *
 * planStaffRecipients does not fall back when a recipient cannot be given a URL
 * they are allowed to open — it drops them:
 *
 *   const url = pickNotifyUrl(p, urls)
 *   if (url) out.push({ id: p.id, url })
 *
 * So a role named in an event's `roles` list, holding one of that event's urls,
 * still receives nothing if `allowRoute` refuses every candidate. Nothing throws,
 * nothing is logged, and the person simply never hears about it. On the shop
 * floor that is a Branch Admin who is told about a queue ticket but is never
 * told the sheet needs approving.
 *
 * This asserts the two halves that make the fan-out complete:
 *   1. every role an event names can open at least one of that event's urls;
 *   2. every url is a route the app actually renders, so a rename cannot leave a
 *      notification pointing at a path that now 404s.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** A representative profile for a role. ASA is grant-driven, so it carries the shipped defaults. */
function profileFor(role) {
  return role === 'assistant_super_admin' ? { role, permission_grants: { ...DEFAULT_ASSISTANT_GRANTS } } : { role }
}

describe('a notification is never fanned out to someone who cannot open it', () => {
  it('the detector can fail — a role that cannot open any url is reported', () => {
    // If pickNotifyUrl could never return null this whole file would pass
    // vacuously, which is how a guard becomes decoration. `/operations/data-center`
    // is denied to a default-grants ASA (rbac_edit is not in DEFAULT_ASSISTANT_GRANTS),
    // which makes it a real negative control rather than an assumed one.
    assert.equal(pickNotifyUrl(profileFor('assistant_super_admin'), ['/operations/inquiries']), '/operations/inquiries')
    assert.equal(
      pickNotifyUrl(profileFor('assistant_super_admin'), ['/operations/data-center']),
      null,
      'a role without access to every candidate url must yield null, or the drop below is unreachable',
    )
    assert.equal(
      pickNotifyUrl(profileFor('staff'), ['/operations/finance', '/operations/data-center']),
      null,
      'crew must not be handed a finance or data-center link',
    )
  })

  for (const [event, rule] of Object.entries(NOTIFY_EVENTS)) {
    it(`${event}: every role it notifies can open one of its urls`, () => {
      const stranded = rule.roles.filter((role) => !pickNotifyUrl(profileFor(role), rule.urls))
      assert.deepEqual(
        stranded,
        [],
        `${event} names these roles but would drop every one of them: ${stranded.join(', ')}. ` +
          `Add a url they can open, or remove them from roles.`,
      )
    })

    it(`${event}: planStaffRecipients actually delivers to a named role`, () => {
      // End-to-end through the real planner, because a url list that is fine in
      // isolation can still be unreachable once branch scope and the active flag
      // are applied.
      const role = rule.roles[0]
      const staff = [
        { id: '11111111-1111-1111-1111-111111111111', role, branch_slug: 'bacoor', is_active: true },
      ]
      const got = planStaffRecipients(staff, { roles: [role], branch: 'bacoor', urls: rule.urls })
      assert.equal(got.length, 1, `${event} dropped ${role} during planning`)
      assert.ok(got[0].url, `${event} gave ${role} no url`)
    })
  }
})

describe('every notification url is a route the app still renders', () => {
  const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
  // Ops routes are declared as relative children of /operations, and as absolute
  // paths for everything outside it. Both shapes have to be read.
  const opsChildren = [...app.matchAll(/<Route\s+path="([a-z0-9-]+)"/g)].map((m) => m[1])
  const absolute = [...app.matchAll(/<Route\s+path="(\/[a-z0-9/:_-]*)"/g)].map((m) => m[1])

  it('the route table was actually parsed — an empty read would pass vacuously', () => {
    assert.ok(opsChildren.length > 20, `only ${opsChildren.length} ops routes parsed from App.jsx`)
    assert.ok(absolute.length > 15, `only ${absolute.length} absolute routes parsed from App.jsx`)
  })

  const allUrls = [...new Set(Object.values(NOTIFY_EVENTS).flatMap((r) => r.urls))]

  for (const url of allUrls) {
    it(`${url} resolves to a rendered route`, () => {
      const path = String(url).split('?')[0]
      if (path.startsWith('/account')) return
      assert.ok(
        opsChildren.includes(path.replace(/^\/operations\//, '')) || absolute.includes(path),
        `${url} is not a route in App.jsx — clicking it lands on the catch-all NotFound`,
      )
      const key = opsRouteKeyFromPath(path)
      assert.ok(key, `${url} maps to no allowRoute key, so pickNotifyUrl can never accept it`)
    })
  }
})