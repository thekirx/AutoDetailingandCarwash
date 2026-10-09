/**
 * PUSH_AUDIT event matrix (used by e2e-push-real.mjs with PUSH_AUDIT=1).
 * Every persona is subscribed in its own real browser. Each event fires through the real path
 * (HTTP API with the actor's own token where the client calls it; server hook otherwise) and must:
 *   - display on every expected persona's device, with the expected landing url
 *   - NOT display on anyone else's device
 *   - land on that url without access-denied / login bounce
 *   - write inbox rows only for expected people (DB oracle, incl. accounts without a browser)
 * Expectations are hand-written from the product rule, not computed from notifyRouting.
 * Seed rows are tagged and deleted afterwards.
 */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const { notifyBookingStatus } = await import('../server/notifyBooking.mjs')
const { notifyStaffEvent } = await import('../server/notifyOpsEvent.mjs')
const { notifyOpsFormComplaint } = await import('../server/notifyOpsForm.mjs')
const { notifyPosEvent } = await import('../server/notifyPos.mjs')
const { notifyPlannerAssignees } = await import('../server/notifyPlanner.mjs')

const WASH_SERVICE = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const CA_FORM = 'fe103337-850b-4f6f-b6d6-3aa8de9c7fed'
const PLAN_LIST = '763bbbd8-ecb9-4cb2-abef-c44ff1f24fc6'
const OTHER_BRANCH_TL = 'tl.batangas@hakumautocare.com'
const SHEET_DATE = '2000-01-05'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function tokenFor(persona) {
  const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === persona)
  const anon = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({ email: acct.email, password: acct.password })
  if (error) throw new Error(`token ${persona}: ${error.message}`)
  return { token: data.session.access_token, client: anon }
}

async function api(base, path, token, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} ${res.status}: ${json.error || ''}`)
  return json
}

/** Displayed notifications matching the tag on one persona's device. */
async function shownWithTag(page, tagRe) {
  return page
    .evaluate(async (src) => {
      const list = await (await navigator.serviceWorker.ready).getNotifications()
      return list.filter((n) => new RegExp(src).test(n.tag)).map((n) => ({ title: n.title, body: n.body, tag: n.tag, url: n.data?.url || null }))
    }, tagRe.source)
    .catch(() => [])
}

async function landsOn(page, base, url) {
  await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await sleep(3500)
  return page.evaluate(() => ({
    path: location.pathname,
    denied: /access-denied|\/login|\/signin/.test(location.pathname) || /Access denied|You don.t have access/i.test(document.body.innerText),
  }))
}

export async function runPushAudit({ base, db, sessions, userIds, outDir, desktopShot, clearShown, browserId }) {
  const byPersona = Object.fromEntries(sessions.map((s) => [s.persona, s]))
  const otherTl = { id: (await db.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.find((u) => u.email === OTHER_BRANCH_TL)?.id }
  const seeded = { bookings: [], sheets: [], subs: [], inquiries: [], cards: [], tags: [] }
  const rows = []
  const tokens = {}
  const tok = async (p) => (tokens[p] ||= await tokenFor(p))

  const bookingId = randomUUID()
  const sheetId = randomUUID()
  const caId = randomUUID()
  const reviewId = randomUUID()
  const complaintId = randomUUID()
  const saleId = randomUUID()
  const cardId = randomUUID()
  let inquiryId = null

  const EVENTS = [
    {
      name: 'booking waiting (wash, Bacoor) → customer + Bacoor floor + global ops',
      tag: new RegExp(`booking-${bookingId}-waiting$`),
      expect: {
        customer: '/account/queue',
        boss: '/operations/queue',
        asa: '/operations/queue',
        admin: '/operations/queue',
        opslead: '/operations/queue',
        tl: '/operations/queue',
      },
      notInbox: () => [otherTl?.id],
      async fire() {
        const { error } = await db.from('bookings').insert({
          id: bookingId, branch: 'bacoor', status: 'waiting', service_id: WASH_SERVICE, customer_id: userIds.customer,
          customer_name: 'Push Audit', customer_phone: '09000000000', vehicle_make: 'Audit', vehicle_model: 'Car',
          vehicle_plate: 'PUSHAUD', scheduled_start: new Date().toISOString(),
        })
        if (error) throw new Error(`seed booking: ${error.message}`)
        seeded.bookings.push(bookingId)
        return notifyBookingStatus({ id: bookingId, customer_id: userIds.customer, customer_phone: null, customer_name: 'Push Audit', branch: 'bacoor', vehicle_plate: 'PUSHAUD', service_id: WASH_SERVICE, status: 'waiting' }, 'waiting')
      },
    },
    {
      name: 'TL assigns crew1 to the car → only crew1 (My tasks)',
      tag: new RegExp(`^crew-${bookingId}$`),
      expect: { crew1: '/operations/my-tasks' },
      async fire() {
        const { token, client } = await tok('tl')
        const { error } = await client.rpc('sync_queue_assignments', { input_booking_id: bookingId, input_staff_ids: [userIds.crew1] })
        if (error) throw new Error(`TL assign: ${error.message}`)
        return api(base, '/api/notify-ops-event', token, { event: 'crew_assigned', id: bookingId })
      },
    },
    {
      name: 'BA submits the daily sheet → SA + ASA (finance_view) on Finance · Daily sheets',
      tag: new RegExp(`^sheet-submitted-${sheetId}$`),
      expect: { boss: `/operations/finance?tab=sheets&sheet=${sheetId}`, asa: `/operations/finance?tab=sheets&sheet=${sheetId}` },
      async fire() {
        const { error } = await db.from('daily_sheets').insert({ id: sheetId, branch: 'bacoor', business_date: SHEET_DATE, status: 'submitted', created_by: userIds.admin, submitted_by: userIds.admin, submitted_at: new Date().toISOString() })
        if (error) throw new Error(`seed sheet: ${error.message}`)
        seeded.sheets.push(sheetId)
        return api(base, '/api/notify-ops-event', (await tok('admin')).token, { event: 'sheet_submitted', id: sheetId })
      },
    },
    {
      name: 'ASA approves the daily sheet → only the submitting BA on POS · Daily sheet',
      tag: new RegExp(`^sheet-reviewed-${sheetId}$`),
      expect: { admin: `/operations/pos?tab=sheet&date=${SHEET_DATE}` },
      async fire() {
        const { error } = await db.from('daily_sheets').update({ status: 'approved', reviewed_by: userIds.asa, reviewed_at: new Date().toISOString() }).eq('id', sheetId)
        if (error) throw new Error(`approve sheet: ${error.message}`)
        return api(base, '/api/notify-ops-event', (await tok('asa')).token, { event: 'sheet_reviewed', id: sheetId })
      },
    },
    {
      name: 'crew1 requests cash advance → Branch Admin on POS · Daily sheet',
      tag: new RegExp(`^ca-req-${caId}$`),
      expect: { admin: '/operations/pos?tab=sheet' },
      async fire() {
        const { error } = await db.from('ops_form_submissions').insert({ id: caId, form_id: CA_FORM, created_by: userIds.crew1, status: 'new', source: 'staff', payload: { staff_id: userIds.crew1, employee_name: 'Push Audit Crew', amount: 500, branch: 'bacoor', reason: 'push audit' } })
        if (error) throw new Error(`seed CA: ${error.message}`)
        seeded.subs.push(caId)
        return api(base, '/api/notify-ops-event', (await tok('crew1')).token, { event: 'cash_advance_submitted', id: caId })
      },
    },
    {
      name: 'public partnership inquiry → SA + ASA (inquiries) on Inquiries',
      tag: /^inquiry-/,
      expect: { boss: '/operations/inquiries', asa: '/operations/inquiries' },
      async fire() {
        const out = await api(base, '/api/public-inquiry', null, { kind: 'partnership', name: 'Push Audit Lot', email: 'push.audit@example.com', contactNumber: '09000000000', city: 'Imus', message: 'push audit', elapsedMs: 5000 })
        const { data } = await db.from('partnership_inquiries').select('id').eq('email', 'push.audit@example.com').order('created_at', { ascending: false }).limit(1).maybeSingle()
        inquiryId = data?.id
        seeded.inquiries.push(inquiryId)
        this.tag = new RegExp(`^inquiry-${inquiryId}$`)
        return out
      },
    },
    {
      name: 'customer review at Bacoor → SA + ASA + Ops Lead + Bacoor BA on Reviews',
      tag: new RegExp(`^review-${reviewId}$`),
      expect: { boss: '/operations/reviews', asa: '/operations/reviews', opslead: '/operations/reviews', admin: '/operations/reviews' },
      notInbox: () => [otherTl?.id],
      fire: () => notifyStaffEvent(db, 'review', { id: reviewId, rating: 2, name: 'Push Audit', branchName: 'Bacoor', comment: 'audit' }, { branch: 'bacoor' }),
    },
    {
      name: 'staff complaint form (Bacoor) → SA + ASA + Bacoor BA on Planning · forms',
      tag: new RegExp(`^ops-complaint-${complaintId}$`),
      expect: { boss: '/operations/planning?tab=forms', asa: '/operations/planning?tab=forms', admin: '/operations/planning?tab=forms' },
      fire: () => notifyOpsFormComplaint({ formName: 'Customer Complaints', payload: { customer_name: 'Push Audit', branch: 'bacoor', category: 'Audit' }, submissionId: complaintId, branch: 'bacoor' }),
    },
    {
      name: 'SA rings a POS sale at Bacoor → ASA + Bacoor BA on POS (actor excluded)',
      tag: new RegExp(`^pos-sale-${saleId}$`),
      expect: { asa: '/operations/pos', admin: '/operations/pos' },
      fire: () => notifyPosEvent({ event: 'sale', branch: 'bacoor', amountMinor: 35000, entityId: saleId, actorId: userIds.boss }),
    },
    {
      name: 'planner card assigned to marketing, crew1, video → each on a page they can open',
      tag: new RegExp(`^plan-card:${cardId}$`),
      expect: { marketing: '/operations/planning', crew1: '/operations/my-tasks', video: '/operations/my-tasks' },
      async fire() {
        const { error } = await db.from('plan_cards').insert({ id: cardId, list_id: PLAN_LIST, title: 'Push audit task', position: 1 })
        if (error) throw new Error(`seed card: ${error.message}`)
        seeded.cards.push(cardId)
        const ids = ['marketing', 'crew1', 'video'].map((p) => userIds[p])
        const { error: aErr } = await db.from('plan_card_assignees').insert(ids.map((staff_id) => ({ card_id: cardId, staff_id })))
        if (aErr) throw new Error(`seed assignees: ${aErr.message}`)
        return notifyPlannerAssignees({ cardId, userIds: ids, title: 'Push audit task' })
      },
    },
  ]

  try {
    for (const ev of EVENTS) {
      const row = { event: ev.name, ok: true, fired: null, recipients: {}, leaks: [], inbox: null }
      rows.push(row)
      try {
        const out = await ev.fire.call(ev)
        row.fired = { targets: out?.targets ?? out?.notify?.targets ?? out?.ops?.targets ?? null, push: out?.push ?? out?.notify?.push ?? null }
        const deadline = Date.now() + 35000
        const pending = new Set(Object.keys(ev.expect))
        while (pending.size && Date.now() < deadline) {
          for (const p of [...pending]) {
            if (!byPersona[p]) { pending.delete(p); continue }
            const got = await shownWithTag(byPersona[p].page, ev.tag)
            if (got.length) {
              row.recipients[p] = { shown: got[0].title, url: got[0].url }
              pending.delete(p)
            }
          }
          if (pending.size) await sleep(1000)
        }
        await sleep(2500)
        for (const s of sessions) {
          if (ev.expect[s.persona]) continue
          const got = await shownWithTag(s.page, ev.tag)
          if (got.length) row.leaks.push(`${s.persona}: ${got[0].title}`)
        }
        for (const [p, url] of Object.entries(ev.expect)) {
          const r = row.recipients[p]
          if (!byPersona[p]) { row.recipients[p] = { skipped: 'no browser session' }; continue }
          if (!r) { row.recipients[p] = { missing: true }; row.ok = false; continue }
          if (r.url !== url) { r.wrongUrl = `expected ${url}`; row.ok = false }
        }
        if (row.leaks.length) row.ok = false
        const shotPersona = Object.keys(ev.expect).find((p) => row.recipients[p]?.shown)
        if (shotPersona) {
          const slug = ev.name.split(' ')[0].replace(/\W+/g, '').slice(0, 12)
          desktopShot(join(outDir, `${browserId}-audit-${rows.length}-${slug}-${shotPersona}-desktop.png`))
        }
        for (const [p, url] of Object.entries(ev.expect)) {
          if (!row.recipients[p]?.shown) continue
          const land = await landsOn(byPersona[p].page, base, url)
          row.recipients[p].landed = land.path
          if (land.denied || land.path !== url.split('?')[0]) { row.recipients[p].badLanding = true; row.ok = false }
        }
        const tagLike = ev.tag.source.replace(/^\^|\$$/g, '').replace(/\\/g, '')
        const { data: inbox } = await db.from('user_notifications').select('user_id, url, tag').gte('created_at', new Date(Date.now() - 5 * 60_000).toISOString())
        const hits = (inbox || []).filter((n) => ev.tag.test(n.tag || ''))
        const inboxIds = new Set(hits.map((n) => n.user_id))
        seeded.tags.push(...new Set(hits.map((n) => n.tag)))
        const missingInbox = Object.keys(ev.expect).filter((p) => p !== 'customer' && !inboxIds.has(userIds[p]))
        const forbidden = Object.entries(userIds).filter(([p, id]) => !ev.expect[p] && inboxIds.has(id)).map(([p]) => p)
        const otherBranch = (ev.notInbox?.() || []).filter((id) => id && inboxIds.has(id))
        row.inbox = { rows: hits.length, missing: missingInbox, forbidden, otherBranch: otherBranch.length, tag: tagLike }
        if (missingInbox.length || forbidden.length || otherBranch.length) row.ok = false
      } catch (err) {
        row.ok = false
        row.error = String(err.message || err).slice(0, 300)
      }
      await Promise.all(sessions.map((s) => clearShown(s.page)))
      console.log(row.ok ? '✔' : '✖', 'audit', row.event, row.error || '', row.leaks.length ? `LEAK ${row.leaks.join('; ')}` : '')
    }
  } finally {
    const del = async (table, col, ids) => {
      const list = ids.filter(Boolean)
      if (!list.length) return
      const { error } = await db.from(table).delete().in(col, list)
      if (error) console.error(`cleanup ${table}: ${error.message}`)
    }
    await del('queue_assignments', 'booking_id', seeded.bookings)
    await del('bookings', 'id', seeded.bookings)
    await del('daily_sheets', 'id', seeded.sheets)
    await del('ops_form_submissions', 'id', seeded.subs)
    await del('partnership_inquiries', 'id', seeded.inquiries)
    await del('plan_card_assignees', 'card_id', seeded.cards)
    await del('plan_cards', 'id', seeded.cards)
    await del('user_notifications', 'tag', [...new Set(seeded.tags)])
  }
  return rows
}
