/**
 * Principal QA Phase C live writes (anon client + RLS).
 * C3 Failed QA, C5 POS expense+sale, C8 planner proof, C9 review insert/deny.
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildPosSalePayload } from '../src/lib/posSale.js'
import { allowedStaffPlanAssigneePatch } from '../src/queue/staffTaskLogic.js'
import { buildDailyCompensationExpense, findPostedCompensationExpense } from '../src/lib/compensation.js'

function loadEnv() {
  const raw = fs.readFileSync('.env', 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
loadEnv()

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anon || !service) {
  console.error('Missing supabase env')
  process.exit(1)
}

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
const results = []
function pass(id, note = '') {
  results.push({ id, ok: true, note })
  console.log(`PASS ${id}${note ? ` — ${note}` : ''}`)
}
function fail(id, note = '') {
  results.push({ id, ok: false, note })
  console.error(`FAIL ${id} — ${note}`)
}

async function asUser(email, password) {
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw Object.assign(new Error(`${email}: ${error.message}`), { id: email })
  return { sb, user: data.user }
}

const stamp = Date.now().toString(36)
const cleanup = { bookingIds: [], expenseIds: [], saleIds: [], reviewIds: [], assigneeIds: [], cardIds: [], formIds: [] }

async function main() {
  const { data: smsPrev } = await admin.from('app_settings').select('value').eq('key', 'sms_notifications').maybeSingle()
  await admin.from('app_settings').upsert({
    key: 'sms_notifications',
    value: { enabled: false },
    updated_at: new Date().toISOString(),
  })

  const { data: wash } = await admin
    .from('services')
    .select('id, name, price_minor')
    .eq('id', 'dddddddd-dddd-dddd-dddd-dddddddddddd')
    .maybeSingle()
  if (!wash?.id) throw new Error('Premium Car Wash service missing')

  const demoCustomerId = '413c4487-2dfb-4e5f-8667-67f8e251f186'

  // C3 — wash ticket + Failed QA as TL
  const { data: booking, error: bookErr } = await admin
    .from('bookings')
    .insert({
      customer_name: 'QA Write Flow',
      customer_id: demoCustomerId,
      customer_email: 'demo.customer@hakumautocare.com',
      customer_phone: '09180000001',
      vehicle_plate: `QA${stamp.slice(-5)}`,
      vehicle_make: 'Toyota',
      vehicle_model: 'Vios',
      service_id: wash.id,
      branch: 'bacoor',
      scheduled_start: new Date().toISOString(),
      status: 'waiting',
      waiting_at: new Date().toISOString(),
      final_price_minor: wash.price_minor,
      price_minor: wash.price_minor,
      is_archived: false,
    })
    .select('id, status')
    .single()
  if (bookErr) throw bookErr
  cleanup.bookingIds.push(booking.id)
  pass('C3-ticket', booking.id)

  const { sb: tl } = await asUser('teamlead@hakumautocare.com', 'HakumTL2026!')
  const now = () => new Date().toISOString()
  const { error: ipErr } = await tl
    .from('bookings')
    .update({ status: 'in_progress', in_progress_at: now() })
    .eq('id', booking.id)
  if (ipErr) fail('C3-in_progress', ipErr.message)
  else pass('C3-in_progress')

  const { error: fcErr } = await tl
    .from('bookings')
    .update({ status: 'final_checking', final_checking_at: now() })
    .eq('id', booking.id)
  if (fcErr) fail('C3-final_checking', fcErr.message)
  else pass('C3-final_checking')

  const { error: qaErr } = await tl
    .from('bookings')
    .update({
      status: 'redo',
      redo_at: now(),
      redo_reason: 'QA Failed QA write flow',
    })
    .eq('id', booking.id)
  if (qaErr) fail('C3-failed-qa', qaErr.message)
  else {
    const { data: redone } = await admin.from('bookings').select('status, redo_at, redo_reason').eq('id', booking.id).single()
    if (redone?.status === 'redo' && redone.redo_at) pass('C3-failed-qa', redone.redo_reason)
    else fail('C3-failed-qa', JSON.stringify(redone))
  }

  const { error: payErr } = await tl
    .from('bookings')
    .update({ status: 'for_payment', for_payment_at: now() })
    .eq('id', booking.id)
  if (payErr) fail('C3-for_payment', payErr.message)
  else pass('C3-for_payment')
  await tl.auth.signOut()

  // C5 — POS merch/wash sale + expense as branch admin
  const { sb: ba } = await asUser('admin@hakumautocare.com', 'HakumAdmin2026!')
  const payload = buildPosSalePayload({
    branch: 'bacoor',
    customerId: demoCustomerId,
    paymentMethod: 'cash',
    cart: [
      {
        item_type: 'service',
        id: wash.id,
        name: wash.name,
        quantity: 1,
        unit_price_minor: wash.price_minor,
      },
    ],
    activeHandoff: { booking_id: booking.id, bookings: { customer_id: demoCustomerId, service_id: wash.id } },
    notes: `QA ceramic toggles shirt=0 card=0 ${stamp}`,
  })
  const { data: sale, error: saleErr } = await ba.rpc('complete_pos_sale', { payload })
  if (saleErr) fail('C5-pos-sale', saleErr.message)
  else {
    cleanup.saleIds.push(sale?.sale_id || sale?.id)
    pass('C5-pos-sale', String(sale?.sale_id || sale?.id || ''))
  }

  const { data: expense, error: expErr } = await ba
    .from('expenses')
    .insert({
      title: `QA daily ${stamp}`,
      total_minor: 15000,
      unit_cost_minor: 15000,
      quantity: 1,
      expense_kind: 'daily',
      branch: 'bacoor',
      status: 'draft',
    })
    .select('id, expense_kind')
    .single()
  if (expErr) fail('C5-expense', expErr.message)
  else {
    cleanup.expenseIds.push(expense.id)
    pass('C5-expense', expense.expense_kind)
  }

  const compDraft = buildDailyCompensationExpense({ date: '2099-01-01', branch: 'bacoor', poolMinor: 12345 })
  if (!compDraft || findPostedCompensationExpense([], { date: '2099-01-01', branch: 'bacoor' })) {
    fail('C10-comp-post', 'draft helper failed')
  } else {
    const { data: compExp, error: compErr } = await ba
      .from('expenses')
      .insert(compDraft)
      .select('id, expense_kind, description')
      .single()
    if (compErr) fail('C10-comp-post', compErr.message)
    else {
      cleanup.expenseIds.push(compExp.id)
      const found = findPostedCompensationExpense([compExp], { date: '2099-01-01', branch: 'bacoor' })
      if (compExp.expense_kind === 'salary_carwash' && found?.id === compExp.id) pass('C10-comp-post', compExp.id)
      else fail('C10-comp-post', 'kind or idempotency key mismatch')
      const { error: dupErr } = await ba.from('expenses').insert(compDraft)
      if (dupErr && (dupErr.code === '23505' || /duplicate|unique/i.test(dupErr.message || ''))) {
        pass('C10-comp-unique', dupErr.code || 'unique')
      } else if (dupErr) fail('C10-comp-unique', dupErr.message)
      else fail('C10-comp-unique', 'second insert succeeded')
    }
  }

  const { data: caForm } = await admin.from('ops_forms').select('id').eq('kind', 'cash_advance').limit(1).maybeSingle()
  if (caForm?.id) {
    const { data: sub, error: subErr } = await admin
      .from('ops_form_submissions')
      .insert({
        form_id: caForm.id,
        payload: { amount_minor: 50000, employee_name: 'QA Staff', notes: stamp },
        status: 'new',
        source: 'staff',
        respondent_label: 'QA CA',
      })
      .select('id, status')
      .single()
    if (subErr) fail('C5-ca-submit', subErr.message)
    else {
      cleanup.formIds.push(sub.id)
      const { error: apprErr } = await ba.from('ops_form_submissions').update({ status: 'resolved' }).eq('id', sub.id)
      if (apprErr) fail('C5-ca-approve', apprErr.message)
      else pass('C5-ca-approve', sub.id)
    }
  } else {
    fail('C5-ca-submit', 'no cash_advance form')
  }
  await ba.auth.signOut()

  // C8 — planner proof as staff
  const { sb: boss } = await asUser('bossmich@hakumautocare.com', 'HakumBoss2026!')
  const { data: board } = await boss
    .from('plan_boards')
    .select('id, plan_lists(id, position)')
    .limit(1)
    .maybeSingle()
  const listId = [...(board?.plan_lists || [])].sort((a, b) => a.position - b.position)[0]?.id
  const { data: staff1 } = await admin
    .from('staff_profiles')
    .select('id')
    .eq('full_name', 'Crew One')
    .eq('role', 'staff')
    .maybeSingle()
  if (!listId || !staff1?.id) fail('C8-assign', 'missing board list or staff1')
  else {
    const { data: card, error: cardErr } = await boss
      .from('plan_cards')
      .insert({ list_id: listId, title: `QA proof ${stamp}` })
      .select('id')
      .single()
    if (cardErr) fail('C8-card', cardErr.message)
    else {
      cleanup.cardIds.push(card.id)
      const { data: asg, error: asgErr } = await boss
        .from('plan_card_assignees')
        .insert({ card_id: card.id, staff_id: staff1.id, status: 'in_progress', assigned_by: (await boss.auth.getUser()).data.user.id })
        .select('id, status')
        .single()
      if (asgErr) fail('C8-assign', asgErr.message)
      else {
        cleanup.assigneeIds.push(asg.id)
        pass('C8-assign', asg.id)
        const { sb: crew } = await asUser('staff1@hakumautocare.com', 'HakumStaff2026!')
        const patch = allowedStaffPlanAssigneePatch(
          { status: 'in_progress', card_id: card.id, staff_id: staff1.id },
          {
            status: 'for_review',
            card_id: card.id,
            staff_id: staff1.id,
            proof_url: 'https://example.com/qa-proof',
            proof_note: 'QA proof note',
          },
        )
        const { error: proofErr } = await crew.from('plan_card_assignees').update(patch).eq('id', asg.id)
        if (proofErr) fail('C8-proof', proofErr.message)
        else {
          const { data: proved } = await admin
            .from('plan_card_assignees')
            .select('status, proof_url, proof_submitted_at')
            .eq('id', asg.id)
            .single()
          if (proved?.status === 'for_review' && proved.proof_url) pass('C8-proof', proved.status)
          else fail('C8-proof', JSON.stringify(proved))
        }
        await crew.auth.signOut()
        const { error: doneErr } = await boss
          .from('plan_card_assignees')
          .update({ status: 'done', reviewed_at: now() })
          .eq('id', asg.id)
        if (doneErr) fail('C8-review-done', doneErr.message)
        else pass('C8-review-done')
      }
    }
  }
  await boss.auth.signOut()

  // Complete booking for customer review
  await admin.from('bookings').update({ status: 'completed', completed_at: now() }).eq('id', booking.id)

  const { sb: staff } = await asUser('staff1@hakumautocare.com', 'HakumStaff2026!')
  const { error: staffReviewErr } = await staff.from('service_reviews').insert({
    booking_id: booking.id,
    customer_id: demoCustomerId,
    customer_name: 'Spoof',
    branch: 'bacoor',
    overall_rating: 5,
    comment: 'staff spoof',
  })
  if (staffReviewErr) pass('C9-staff-denied', staffReviewErr.code || staffReviewErr.message)
  else fail('C9-staff-denied', 'staff insert succeeded')
  await staff.auth.signOut()

  const { sb: cust } = await asUser('demo.customer@hakumautocare.com', 'HakumCustomer2026!')
  const { data: review, error: revErr } = await cust
    .from('service_reviews')
    .insert({
      booking_id: booking.id,
      customer_id: demoCustomerId,
      customer_name: 'Demo Customer',
      branch: 'bacoor',
      overall_rating: 5,
      comment: `QA review ${stamp}`,
    })
    .select('id')
    .single()
  if (revErr) fail('C9-customer-review', revErr.message)
  else {
    cleanup.reviewIds.push(review.id)
    pass('C9-customer-review', review.id)
  }

  const { sb: investor } = await asUser('investor@hakumautocare.com', 'HakumInvest2026!')
  const { data: invSeen, error: invErr } = await investor
    .from('service_reviews')
    .select('id')
    .eq('id', cleanup.reviewIds[0] || '00000000-0000-0000-0000-000000000000')
  if (invErr) fail('C9-investor-hidden', invErr.message)
  else if ((invSeen || []).length === 0) pass('C9-investor-hidden')
  else fail('C9-investor-hidden', `saw ${invSeen.length}`)
  await investor.auth.signOut()

  const { sb: ba2 } = await asUser('admin@hakumautocare.com', 'HakumAdmin2026!')
  const { data: baSeen, error: baReadErr } = await ba2
    .from('service_reviews')
    .select('id, overall_rating')
    .eq('id', cleanup.reviewIds[0] || '00000000-0000-0000-0000-000000000000')
    .maybeSingle()
  if (baReadErr) fail('C9-admin-read', baReadErr.message)
  else if (baSeen?.id) pass('C9-admin-read', String(baSeen.overall_rating))
  else fail('C9-admin-read', 'missing row')
  await ba2.auth.signOut()
  await cust.auth.signOut()

  // Restore SMS setting
  if (smsPrev?.value) {
    await admin.from('app_settings').upsert({
      key: 'sms_notifications',
      value: smsPrev.value,
      updated_at: new Date().toISOString(),
    })
  }

  // Cleanup QA rows (keep booking completed for history is fine if archived)
  if (cleanup.reviewIds.length) await admin.from('service_reviews').delete().in('id', cleanup.reviewIds)
  if (cleanup.assigneeIds.length) await admin.from('plan_card_assignees').delete().in('id', cleanup.assigneeIds)
  if (cleanup.cardIds.length) await admin.from('plan_cards').delete().in('id', cleanup.cardIds)
  if (cleanup.expenseIds.length) await admin.from('expenses').delete().in('id', cleanup.expenseIds)
  if (cleanup.formIds.length) await admin.from('ops_form_submissions').delete().in('id', cleanup.formIds)
  const saleIds = cleanup.saleIds.filter(Boolean)
  if (saleIds.length) {
    await admin.from('sale_line_items').delete().in('sale_id', saleIds)
    await admin.from('sales').delete().in('id', saleIds)
  }
  if (cleanup.bookingIds.length) {
    await admin.from('bookings').update({ is_archived: true, notes: `QA archived ${stamp}` }).in('id', cleanup.bookingIds)
  }
  pass('cleanup', JSON.stringify(cleanup))
}

main()
  .catch((e) => {
    fail('fatal', e.message || String(e))
  })
  .finally(() => {
    const failed = results.filter((r) => !r.ok)
    console.log(`\nSUMMARY ${results.length - failed.length}/${results.length} pass`)
    fs.mkdirSync('docs', { recursive: true })
    fs.writeFileSync(
      'docs/qa-live-writes.json',
      JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
    )
    process.exit(failed.length ? 1 : 0)
  })
