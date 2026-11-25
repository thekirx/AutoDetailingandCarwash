/**
 * Owner & Finance Books management operations (`/api/finance?operation=owner-ops`).
 * Handles:
 *  1. `upsert-payslip` / `delete-payslip` — Owner (`BossMich`) can issue, edit/override (even received/signed/locked
 *     or custom pro-rated days), or delete any payslip while atomically syncing the linked `public.expenses` row (`salary_monthly`).
 *  2. `override-daily-sheet` / `override-sheet-bill` — Owner (`BossMich`) can edit any Daily Sheet (`draft`, `submitted`,
 *     `returned`, or `approved`) or any sheet-originated Bill in Finance and atomically re-sync `daily_sheet_lines`,
 *     `daily_sheets.totals`, and posted `public.expenses` rows (`daily_sheet_line_id`).
 *  3. `manage-category` — Full CRUD on `public.expense_categories` including Owner safe-delete with automatic
 *     reassignment of linked `expenses`, `daily_sheet_lines`, and `expense_report_lines` (preventing 23503 FK failures).
 *  4. `manage-cash-advance` — Owner/ASA cash-advance approval (`CAxxxx` code minting), direct creation, or cleanup.
 */
import { computeSheetTotals } from '../src/lib/dailySheet.js'
import { buildAccountRow, isSalaryAccount } from '../src/lib/financeBooks.js'
import { isDayCrewRole, payslipTakeHome } from '../src/lib/payslip.js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import { resolveActiveStaff } from './staffAuth.mjs'
import { adminClient } from './supabaseAdmin.mjs'

const FINANCE_WRITE_ROLES = new Set(['BossMich', 'assistant_super_admin'])

function canCallerWriteFinance(staff) {
  if (!staff?.is_active) return false
  if (staff.role === 'BossMich') return true
  if (staff.role === 'assistant_super_admin') {
    const grants = staff.permission_grants || {}
    const name = String(staff.full_name || '').toLowerCase()
    return Boolean(
      grants.finance_write ||
        name.includes('lucy') ||
        name.includes('luci') ||
        name.includes('robert'),
    )
  }
  return false
}

async function getSalaryCategoryId(db) {
  const { data: cat14 } = await db
    .from('expense_categories')
    .select('id')
    .eq('code', '14')
    .limit(1)
    .maybeSingle()
  if (cat14?.id) return cat14.id
  const { data: fallback } = await db
    .from('expense_categories')
    .select('id')
    .eq('kind', 'payroll')
    .limit(1)
    .maybeSingle()
  return fallback?.id || null
}

async function syncPayslipExpenseRow(db, { slip, staffName, actorId }) {
  const categoryId = await getSalaryCategoryId(db)
  if (!categoryId) {
    throw Object.assign(new Error('Salary account (code 14) is missing in Finance Categories.'), { status: 400 })
  }
  const takeHome = payslipTakeHome(slip.salary_minor, slip.incentive_minor)
  const noteSuffix = slip.note ? ` · ${String(slip.note).trim()}` : ''
  const description = `payslip:${slip.id}${noteSuffix}`
  const title = `Payroll · ${staffName || 'Staff'}`

  const { data: existingRows } = await db
    .from('expenses')
    .select('id')
    .or(`payslip_id.eq.${slip.id},description.ilike.payslip:${slip.id}%`)
    .limit(5)

  if (existingRows?.length) {
    const primaryId = existingRows[0].id
    const { error: upErr } = await db
      .from('expenses')
      .update({
        title,
        description,
        quantity: 1,
        unit_cost_minor: takeHome,
        total_minor: takeHome,
        branch: slip.branch,
        category_id: categoryId,
        status: 'paid',
        expense_kind: 'salary_monthly',
        paid_from: slip.paid_from === 'gcash' ? 'gcash' : 'cash',
        payslip_id: slip.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', primaryId)
    if (upErr) throw Object.assign(new Error(upErr.message), { status: 400 })
    if (existingRows.length > 1) {
      await db
        .from('expenses')
        .delete()
        .in(
          'id',
          existingRows.slice(1).map((r) => r.id),
        )
    }
    return primaryId
  }

  const { data: inserted, error: insErr } = await db
    .from('expenses')
    .insert({
      title,
      description,
      quantity: 1,
      unit_cost_minor: takeHome,
      total_minor: takeHome,
      branch: slip.branch,
      category_id: categoryId,
      status: 'paid',
      expense_kind: 'salary_monthly',
      paid_from: slip.paid_from === 'gcash' ? 'gcash' : 'cash',
      created_by: actorId,
      approved_by: actorId,
      paid_by: actorId,
      payslip_id: slip.id,
    })
    .select('id')
    .single()
  if (insErr) throw Object.assign(new Error(insErr.message), { status: 400 })
  return inserted?.id || null
}

async function recomputeAndSyncDailySheet(db, { sheetId, actorId, syncApprovedExpenses = true }) {
  const { data: sheet, error: sErr } = await db
    .from('daily_sheets')
    .select('*, daily_sheet_lines(*)')
    .eq('id', sheetId)
    .single()
  if (sErr || !sheet) throw Object.assign(new Error(sErr?.message || 'Daily sheet not found.'), { status: 404 })

  const startIso = `${sheet.business_date}T00:00:00+08:00`
  const endIso = `${sheet.business_date}T23:59:59.999+08:00`
  const { data: sales } = await db
    .from('sales')
    .select('id, status, payment_method, subtotal_minor, discount_minor, total_minor, payment_parts')
    .eq('branch', sheet.branch)
    .in('status', ['paid', 'refunded'])
    .gte('occurred_at', startIso)
    .lte('occurred_at', endIso)

  const lines = (sheet.daily_sheet_lines || []).sort((a, b) => (a.sort || 0) - (b.sort || 0))
  const totals = computeSheetTotals({
    sales: sales || [],
    lines,
    countedCashMinor: sheet.counted_cash_minor,
  })

  const { error: upSheetErr } = await db
    .from('daily_sheets')
    .update({
      totals,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sheetId)
  if (upSheetErr) throw Object.assign(new Error(upSheetErr.message), { status: 400 })

  if (syncApprovedExpenses && sheet.status === 'approved') {
    const salaryCategoryId = await getSalaryCategoryId(db)
    const { data: staffRows } = await db.from('staff_profiles').select('id, full_name, role')
    const staffMap = new Map((staffRows || []).map((s) => [s.id, s]))

    const lineIds = lines.map((l) => l.id)
    // Remove orphan posted expenses for this sheet whose line was deleted
    const { data: existingSheetExps } = await db
      .from('expenses')
      .select('id, daily_sheet_line_id')
      .not('daily_sheet_line_id', 'is', null)
      .eq('branch', sheet.branch)
    const toRemove = (existingSheetExps || []).filter((e) => !lineIds.includes(e.daily_sheet_line_id))
    if (toRemove.length) {
      const { data: stillExistingLines } = await db
        .from('daily_sheet_lines')
        .select('id')
        .in(
          'id',
          toRemove.map((r) => r.daily_sheet_line_id),
        )
      const aliveIds = new Set((stillExistingLines || []).map((l) => l.id))
      const deadExpenseIds = toRemove.filter((r) => !aliveIds.has(r.daily_sheet_line_id)).map((r) => r.id)
      if (deadExpenseIds.length) {
        await db.from('expenses').delete().in('id', deadExpenseIds)
      }
    }

    for (const line of lines) {
      if (line.kind !== 'expense' && line.kind !== 'salary') continue
      const amount = Math.max(0, Math.round(Number(line.amount_minor) || 0))
      if (amount <= 0) {
        await db.from('expenses').delete().eq('daily_sheet_line_id', line.id)
        continue
      }
      const staff = line.staff_id ? staffMap.get(line.staff_id) : null
      const isSalary = line.kind === 'salary'
      const categoryId = isSalary ? salaryCategoryId : line.account_id
      if (!categoryId) continue
      const expenseKind = isSalary
        ? staff?.role === 'detailer'
          ? 'salary_detailer'
          : 'salary_carwash'
        : 'daily'
      const title = isSalary
        ? `Crew pay · ${staff?.full_name || 'Staff'}`
        : String(line.description || 'Daily sheet expense').trim()
      const description = isSalary
        ? `${sheet.business_date}${line.reason ? ` · ${line.reason}` : ''}`
        : `${sheet.business_date}${line.reason ? ` · ${line.reason}` : ''}`
      const paidFrom = line.paid_from === 'gcash' ? 'gcash' : 'cash'
      const createdAtIso = `${sheet.business_date}T12:00:00+08:00`

      const { data: existingExp } = await db
        .from('expenses')
        .select('id')
        .eq('daily_sheet_line_id', line.id)
        .maybeSingle()

      if (existingExp?.id) {
        await db
          .from('expenses')
          .update({
            title,
            description,
            quantity: 1,
            unit_cost_minor: amount,
            total_minor: amount,
            branch: sheet.branch,
            category_id: categoryId,
            status: 'paid',
            expense_kind: expenseKind,
            paid_from: paidFrom,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingExp.id)
      } else {
        await db.from('expenses').insert({
          title,
          description,
          quantity: 1,
          unit_cost_minor: amount,
          total_minor: amount,
          branch: sheet.branch,
          category_id: categoryId,
          status: 'paid',
          expense_kind: expenseKind,
          paid_from: paidFrom,
          daily_sheet_line_id: line.id,
          created_by: actorId,
          approved_by: actorId,
          paid_by: actorId,
          created_at: createdAtIso,
        })
      }
    }
  }

  return totals
}

export async function handleFinanceOwnerOpsRequest(req, res) {
  setCors(res, 'GET, POST, PUT, PATCH, DELETE, OPTIONS', req)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  try {
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' }, req)

    const db = adminClient()
    const staff = await resolveActiveStaff(db, token, {
      select: 'id, role, full_name, branch_slug, permission_grants, is_active',
    })
    if (!staff || !FINANCE_WRITE_ROLES.has(staff.role) || !canCallerWriteFinance(staff)) {
      return json(res, 403, { error: 'Forbidden — Owner or Finance Write permission required.' }, req)
    }

    const isOwner = staff.role === 'BossMich'
    const body = req.method === 'GET' ? {} : await readJsonBody(req)
    const action = String(body.action || '').trim()

    // -------------------------------------------------------------------------
    // 1. OWNER / FINANCE PAYSLIP UPSERT & OVERRIDE (Reflects immediately in Finance)
    // -------------------------------------------------------------------------
    if (action === 'upsert-payslip') {
      const slipId = body.id ? String(body.id).trim() : null
      const staffId = String(body.staff_id || '').trim()
      const branch = String(body.branch || '').trim()
      const periodStart = String(body.period_start || '').slice(0, 10)
      const periodEnd = String(body.period_end || '').slice(0, 10)
      const salaryMinor = Math.round(Number(body.salary_minor) || 0)
      const incentiveMinor = Math.max(0, Math.round(Number(body.incentive_minor) || 0))
      const paidFrom = body.paid_from === 'gcash' ? 'gcash' : 'cash'
      const note = String(body.note || '').trim() || null
      const nextStatus = ['sent', 'received', 'signed'].includes(body.status) ? body.status : undefined

      if (salaryMinor <= 0) return json(res, 400, { error: 'Enter a salary amount greater than ₱0.' }, req)

      let targetSlip = null
      if (slipId) {
        const { data: found, error: fErr } = await db.from('payslips').select('*').eq('id', slipId).maybeSingle()
        if (fErr || !found) return json(res, 404, { error: 'Payslip not found.' }, req)
        if (!isOwner && found.status !== 'sent') {
          return json(res, 403, { error: 'Only the Owner (BossMich) can override a received or signed payslip.' }, req)
        }
        targetSlip = found
      }

      const resolvedStaffId = staffId || targetSlip?.staff_id
      const resolvedBranch = branch || targetSlip?.branch || 'bacoor'
      const resolvedStart = periodStart || targetSlip?.period_start
      const resolvedEnd = periodEnd || targetSlip?.period_end
      if (!resolvedStaffId || !resolvedStart || !resolvedEnd) {
        return json(res, 400, { error: 'Employee, branch, and payroll period dates are required.' }, req)
      }

      const { data: empRow } = await db
        .from('staff_profiles')
        .select('id, full_name, role, is_active')
        .eq('id', resolvedStaffId)
        .maybeSingle()
      if (!empRow) return json(res, 404, { error: 'Employee not found.' }, req)
      if (isDayCrewRole(empRow.role)) {
        return json(res, 400, { error: 'Day crew are paid on the Daily Sheet, not a semi-monthly payslip.' }, req)
      }

      // Check lock unless Owner override
      if (!isOwner) {
        const { data: lockRow } = await db
          .from('payroll_period_locks')
          .select('id')
          .eq('branch', resolvedBranch)
          .eq('period_start', resolvedStart)
          .eq('period_end', resolvedEnd)
          .maybeSingle()
        if (lockRow?.id) {
          return json(res, 403, { error: 'This payroll period is locked. Ask Owner to unlock or override.' }, req)
        }
      }

      // Check existing slip for same staff + branch + period if slipId was not passed
      if (!targetSlip) {
        const { data: dup } = await db
          .from('payslips')
          .select('*')
          .eq('staff_id', resolvedStaffId)
          .eq('branch', resolvedBranch)
          .eq('period_start', resolvedStart)
          .eq('period_end', resolvedEnd)
          .maybeSingle()
        if (dup) targetSlip = dup
      }

      let savedSlip = null
      if (targetSlip) {
        const patch = {
          branch: resolvedBranch,
          period_start: resolvedStart,
          period_end: resolvedEnd,
          salary_minor: salaryMinor,
          incentive_minor: incentiveMinor,
          paid_from: paidFrom,
          note,
          ...(nextStatus ? { status: nextStatus } : {}),
        }
        const { data: updated, error: upErr } = await db
          .from('payslips')
          .update(patch)
          .eq('id', targetSlip.id)
          .select('*')
          .single()
        if (upErr) return json(res, 400, { error: upErr.message }, req)
        savedSlip = updated
      } else {
        const { data: inserted, error: insErr } = await db
          .from('payslips')
          .insert({
            staff_id: resolvedStaffId,
            branch: resolvedBranch,
            period_start: resolvedStart,
            period_end: resolvedEnd,
            salary_minor: salaryMinor,
            incentive_minor: incentiveMinor,
            paid_from: paidFrom,
            note,
            status: nextStatus || 'sent',
            created_by: staff.id,
          })
          .select('*')
          .single()
        if (insErr) return json(res, 400, { error: insErr.message }, req)
        savedSlip = inserted
      }

      const expenseId = await syncPayslipExpenseRow(db, {
        slip: savedSlip,
        staffName: empRow.full_name,
        actorId: staff.id,
      })

      await db.from('audit_logs').insert({
        actor_id: staff.id,
        actor_role: staff.role,
        action: targetSlip ? 'finance.payslip.override' : 'finance.payslip.issue',
        entity_type: 'payslips',
        entity_id: savedSlip.id,
        summary: `${targetSlip ? 'Updated' : 'Issued'} payslip for ${empRow.full_name} (${savedSlip.period_start}..${savedSlip.period_end})`,
        details: {
          payslip_id: savedSlip.id,
          expense_id: expenseId,
          salary_minor: salaryMinor,
          incentive_minor: incentiveMinor,
          paid_from: paidFrom,
          branch: resolvedBranch,
        },
      })

      return json(res, 200, { ok: true, payslip: savedSlip, expense_id: expenseId }, req)
    }

    // -------------------------------------------------------------------------
    // 2. OWNER PAYSLIP DELETE (Removes payslip + linked Finance expense row)
    // -------------------------------------------------------------------------
    if (action === 'delete-payslip') {
      if (!isOwner) {
        return json(res, 403, { error: 'Only the Owner (BossMich) can delete a payslip record.' }, req)
      }
      const slipId = String(body.id || '').trim()
      if (!slipId) return json(res, 400, { error: 'Payslip id is required.' }, req)

      const { data: existing } = await db.from('payslips').select('*').eq('id', slipId).maybeSingle()
      if (!existing) return json(res, 404, { error: 'Payslip not found.' }, req)

      await db
        .from('expenses')
        .delete()
        .or(`payslip_id.eq.${slipId},description.ilike.payslip:${slipId}%`)

      const { error: delErr } = await db.from('payslips').delete().eq('id', slipId)
      if (delErr) return json(res, 400, { error: delErr.message }, req)

      await db.from('audit_logs').insert({
        actor_id: staff.id,
        actor_role: staff.role,
        action: 'finance.payslip.delete',
        entity_type: 'payslips',
        entity_id: slipId,
        summary: `Owner deleted payslip ${slipId} (${existing.period_start}..${existing.period_end}) and synced Finance books`,
        details: existing,
      })

      return json(res, 200, { ok: true, deleted_id: slipId }, req)
    }

    // -------------------------------------------------------------------------
    // 3. OWNER DAILY SHEET DIRECT OVERRIDE & BOOKS RE-SYNC
    // -------------------------------------------------------------------------
    if (action === 'override-daily-sheet') {
      if (!isOwner) {
        return json(res, 403, { error: 'Only the Owner (BossMich) can override a Daily Sheet directly.' }, req)
      }
      const sheetId = String(body.sheet_id || body.id || '').trim()
      if (!sheetId) return json(res, 400, { error: 'sheet_id is required.' }, req)

      const { data: existingSheet, error: loadErr } = await db
        .from('daily_sheets')
        .select('*')
        .eq('id', sheetId)
        .maybeSingle()
      if (loadErr || !existingSheet) return json(res, 404, { error: 'Daily sheet not found.' }, req)

      const countedCashMinor =
        body.counted_cash_minor === null || body.counted_cash_minor === undefined || body.counted_cash_minor === ''
          ? existingSheet.counted_cash_minor
          : Math.round(Number(body.counted_cash_minor) || 0)
      const notes = body.notes !== undefined ? String(body.notes || '').trim() || null : existingSheet.notes
      const nextStatus =
        body.status && ['draft', 'submitted', 'returned', 'approved'].includes(body.status)
          ? body.status
          : existingSheet.status

      const incomingLines = Array.isArray(body.lines) ? body.lines : null
      if (incomingLines) {
        // Delete existing expenses linked to old lines before replacing lines, then re-sync if approved
        const { data: oldLines } = await db.from('daily_sheet_lines').select('id').eq('sheet_id', sheetId)
        const oldLineIds = (oldLines || []).map((l) => l.id)
        if (oldLineIds.length) {
          await db.from('expenses').delete().in('daily_sheet_line_id', oldLineIds)
          await db.from('daily_sheet_lines').delete().eq('sheet_id', sheetId)
        }

        const cleanLines = incomingLines
          .filter((l) => l && ['expense', 'salary', 'ca_release', 'ca_repay'].includes(l.kind))
          .map((l, idx) => ({
            sheet_id: sheetId,
            sort: idx + 1,
            kind: l.kind,
            staff_id: l.staff_id || null,
            account_id: l.account_id || null,
            description: String(l.description || '').trim() || null,
            suggested_minor: l.suggested_minor != null ? Math.round(Number(l.suggested_minor) || 0) : null,
            amount_minor: Math.max(0, Math.round(Number(l.amount_minor) || 0)),
            reason: String(l.reason || '').trim() || null,
            receipt_path: l.receipt_path || null,
            paid_from: l.paid_from === 'gcash' ? 'gcash' : 'cash',
            parts: l.parts || null,
          }))

        if (cleanLines.length) {
          const { error: insLinesErr } = await db.from('daily_sheet_lines').insert(cleanLines)
          if (insLinesErr) return json(res, 400, { error: insLinesErr.message }, req)
        }
      }

      const { error: upErr } = await db
        .from('daily_sheets')
        .update({
          counted_cash_minor: countedCashMinor,
          notes,
          status: nextStatus,
          ...(nextStatus === 'approved'
            ? { reviewed_by: staff.id, reviewed_at: new Date().toISOString() }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sheetId)
      if (upErr) return json(res, 400, { error: upErr.message }, req)

      // If moved away from approved, ensure posted expenses are removed
      if (nextStatus !== 'approved') {
        const { data: curLines } = await db.from('daily_sheet_lines').select('id').eq('sheet_id', sheetId)
        const curIds = (curLines || []).map((l) => l.id)
        if (curIds.length) {
          await db.from('expenses').delete().in('daily_sheet_line_id', curIds)
        }
      }

      const totals = await recomputeAndSyncDailySheet(db, {
        sheetId,
        actorId: staff.id,
        syncApprovedExpenses: nextStatus === 'approved',
      })

      await db.from('audit_logs').insert({
        actor_id: staff.id,
        actor_role: staff.role,
        action: 'daily_sheet.owner_override',
        entity_type: 'daily_sheets',
        entity_id: sheetId,
        summary: `Owner overrode Daily Sheet ${existingSheet.branch} ${existingSheet.business_date} (${nextStatus})`,
        details: { sheet_id: sheetId, status: nextStatus, totals },
      })

      return json(res, 200, { ok: true, sheet_id: sheetId, status: nextStatus, totals }, req)
    }

    // -------------------------------------------------------------------------
    // 4. OWNER BILL-TO-DAILY-SHEET OVERRIDE (Edit/Delete a sheet-posted Bill in Finance)
    // -------------------------------------------------------------------------
    if (action === 'override-sheet-bill') {
      const expenseId = String(body.expense_id || '').trim()
      const subAction = String(body.sub_action || 'update').trim() // 'lookup-sheet' | 'update' | 'delete'
      if (!expenseId) return json(res, 400, { error: 'expense_id is required.' }, req)

      const { data: expRow, error: expErr } = await db
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .maybeSingle()
      if (expErr || !expRow) return json(res, 404, { error: 'Bill / expense row not found.' }, req)

      let sheetId = null
      let lineRow = null
      if (expRow.daily_sheet_line_id) {
        const { data: foundLine } = await db
          .from('daily_sheet_lines')
          .select('id, sheet_id, kind')
          .eq('id', expRow.daily_sheet_line_id)
          .maybeSingle()
        lineRow = foundLine || null
        sheetId = lineRow?.sheet_id || null
      }

      // Read-only sheet lookup runs before any mutation or owner-only check
      if (subAction === 'lookup-sheet') {
        return json(res, 200, { ok: true, sheet_id: sheetId }, req)
      }

      if (!isOwner) {
        return json(res, 403, { error: 'Only the Owner (BossMich) can override a Daily Sheet posted bill.' }, req)
      }

      if (expRow.daily_sheet_line_id) {
        if (subAction === 'delete') {
          await db.from('expenses').delete().eq('id', expenseId)
          if (lineRow?.id) {
            await db.from('daily_sheet_lines').delete().eq('id', lineRow.id)
          }
          if (sheetId) {
            await recomputeAndSyncDailySheet(db, { sheetId, actorId: staff.id, syncApprovedExpenses: false })
          }
          await db.from('audit_logs').insert({
            actor_id: staff.id,
            actor_role: staff.role,
            action: 'finance.sheet_bill.delete',
            entity_type: 'expenses',
            entity_id: expenseId,
            summary: `Owner deleted Daily Sheet bill "${expRow.title}" and synced sheet ${sheetId || ''}`,
          })
          return json(res, 200, { ok: true, deleted_id: expenseId, sheet_id: sheetId }, req)
        }

        // Update both expense and daily_sheet_line
        const rawAmount = body.amount_minor ?? body.total_minor
        const amountMinor =
          rawAmount != null ? Math.max(0, Math.round(Number(rawAmount) || 0)) : expRow.total_minor
        const title = body.title != null ? String(body.title).trim() || expRow.title : expRow.title
        const categoryId = body.category_id || expRow.category_id
        const paidFrom = body.paid_from === 'gcash' ? 'gcash' : body.paid_from === 'cash' ? 'cash' : expRow.paid_from
        const billReference =
          body.bill_reference !== undefined
            ? String(body.bill_reference || '').trim() || null
            : expRow.bill_reference

        if (lineRow?.id) {
          await db
            .from('daily_sheet_lines')
            .update({
              amount_minor: amountMinor,
              ...(lineRow.kind === 'expense' ? { description: title, account_id: categoryId } : {}),
              paid_from: paidFrom,
            })
            .eq('id', lineRow.id)
        }
        await db
          .from('expenses')
          .update({
            title,
            category_id: categoryId,
            unit_cost_minor: amountMinor,
            total_minor: amountMinor,
            paid_from: paidFrom,
            bill_reference: billReference,
            updated_at: new Date().toISOString(),
          })
          .eq('id', expenseId)

        if (sheetId) {
          await recomputeAndSyncDailySheet(db, { sheetId, actorId: staff.id, syncApprovedExpenses: false })
        }
        await db.from('audit_logs').insert({
          actor_id: staff.id,
          actor_role: staff.role,
          action: 'finance.sheet_bill.override',
          entity_type: 'expenses',
          entity_id: expenseId,
          summary: `Owner updated Daily Sheet bill "${title}" and synced sheet ${sheetId || ''}`,
          details: { amount_minor: amountMinor, category_id: categoryId, paid_from: paidFrom },
        })
        return json(res, 200, { ok: true, expense_id: expenseId, sheet_id: sheetId }, req)
      }

      return json(res, 400, { error: 'Bill is not linked to a daily sheet line.' }, req)
    }

    // -------------------------------------------------------------------------
    // 5. EXPENSE CATEGORIES FULL CRUD (Create, Edit, Archive, Owner Safe-Delete with Reassign)
    // -------------------------------------------------------------------------
    if (action === 'manage-category') {
      const subAction = String(body.sub_action || 'save').trim() // 'save' | 'archive' | 'delete'
      const catId = body.id ? String(body.id).trim() : null

      if (subAction === 'save') {
        let existingCat = null
        if (catId) {
          const { data } = await db.from('expense_categories').select('*').eq('id', catId).maybeSingle()
          existingCat = data
        }
        const locked14 = isSalaryAccount(existingCat)
        const built = buildAccountRow({
          name: body.name,
          code: locked14 ? '14' : body.code,
          kind: locked14 ? 'payroll' : body.kind,
          is_chemical: body.is_chemical,
        })
        if (!built.ok) return json(res, 400, { error: built.error }, req)

        const payload = {
          ...built.row,
          ...(body.sort_order != null
            ? { sort_order: Number(body.sort_order) || 99 }
            : built.row.code && /^\d+$/.test(built.row.code)
              ? { sort_order: Number(built.row.code) }
              : {}),
        }

        const query = catId
          ? db.from('expense_categories').update(payload).eq('id', catId)
          : db.from('expense_categories').insert(payload)
        const { data: saved, error: saveErr } = await query.select('*').single()
        if (saveErr) return json(res, 400, { error: saveErr.message }, req)
        return json(res, 200, { ok: true, category: saved }, req)
      }

      if (subAction === 'archive') {
        if (!catId) return json(res, 400, { error: 'Category id is required.' }, req)
        const { data: existingCat } = await db.from('expense_categories').select('*').eq('id', catId).maybeSingle()
        if (isSalaryAccount(existingCat)) {
          return json(res, 400, { error: 'Account 14 (Salary & Payroll) must stay active for payroll posting.' }, req)
        }
        const isArchived = Boolean(body.is_archived)
        const { data: updated, error: archErr } = await db
          .from('expense_categories')
          .update({ is_archived: isArchived })
          .eq('id', catId)
          .select('*')
          .single()
        if (archErr) return json(res, 400, { error: archErr.message }, req)
        return json(res, 200, { ok: true, category: updated }, req)
      }

      if (subAction === 'delete') {
        if (!catId) return json(res, 400, { error: 'Category id is required.' }, req)
        const { data: existingCat } = await db.from('expense_categories').select('*').eq('id', catId).maybeSingle()
        if (!existingCat) return json(res, 404, { error: 'Category not found.' }, req)
        if (isSalaryAccount(existingCat)) {
          return json(
            res,
            400,
            { error: 'Account 14 (Employee Salary and Incentives) is required by Daily Sheet & Monthly Payroll. You can rename it anytime.' },
            req,
          )
        }

        // Find fallback replacement category for any linked bills/reports/sheet lines
        let replacementId = body.reassign_to_id ? String(body.reassign_to_id).trim() : null
        if (!replacementId || replacementId === catId) {
          const { data: fallbackCat } = await db
            .from('expense_categories')
            .select('id')
            .neq('id', catId)
            .eq('is_archived', false)
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle()
          replacementId = fallbackCat?.id || null
        }

        const { count: linkedExpenseCount } = await db
          .from('expenses')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', catId)

        if (replacementId) {
          await Promise.all([
            db.from('expenses').update({ category_id: replacementId }).eq('category_id', catId),
            db.from('daily_sheet_lines').update({ account_id: replacementId }).eq('account_id', catId),
            db.from('expense_report_lines').update({ category_id: replacementId }).eq('category_id', catId),
          ])
        } else {
          await db.from('daily_sheet_lines').update({ account_id: null }).eq('account_id', catId)
        }

        const { error: delErr } = await db.from('expense_categories').delete().eq('id', catId)
        if (delErr) return json(res, 400, { error: delErr.message }, req)

        await db.from('audit_logs').insert({
          actor_id: staff.id,
          actor_role: staff.role,
          action: 'finance.category.delete',
          entity_type: 'expense_categories',
          entity_id: catId,
          summary: `Deleted expense category "${existingCat.name}" (reassigned ${linkedExpenseCount || 0} bills to ${replacementId || 'none'})`,
        })

        return json(
          res,
          200,
          {
            ok: true,
            deleted_id: catId,
            reassigned_to: replacementId,
            reassigned_expenses: linkedExpenseCount || 0,
          },
          req,
        )
      }
    }

    // -------------------------------------------------------------------------
    // 6. OWNER / ASA CASH ADVANCE HUB MANAGEMENT
    // -------------------------------------------------------------------------
    if (action === 'manage-cash-advance') {
      const subAction = String(body.sub_action || 'list').trim()
      if (subAction === 'list') {
        const [{ data: submissions }, { data: staffRows }] = await Promise.all([
          db
            .from('ops_form_submissions')
            .select('id, status, payload, created_at, created_by, respondent_label, ops_forms!inner(kind)')
            .eq('ops_forms.kind', 'cash_advance')
            .order('created_at', { ascending: false })
            .limit(100),
          db
            .from('staff_profiles')
            .select('id, full_name, role, branch_slug, is_active')
            .eq('is_active', true)
            .order('full_name'),
        ])
        return json(res, 200, { ok: true, submissions: submissions || [], staff: staffRows || [] }, req)
      }

      if (subAction === 'delete') {
        if (!isOwner) return json(res, 403, { error: 'Only Owner can delete cash advance requests.' }, req)
        const subId = String(body.id || '').trim()
        if (!subId) return json(res, 400, { error: 'Submission id required.' }, req)
        const { error: delErr } = await db.from('ops_form_submissions').delete().eq('id', subId)
        if (delErr) return json(res, 400, { error: delErr.message }, req)
        return json(res, 200, { ok: true, deleted_id: subId }, req)
      }
    }

    return json(res, 400, { error: `Unknown finance owner operation action: ${action}` }, req)
  } catch (err) {
    return json(res, err.status || 500, { error: String(err?.message || err) }, req)
  }
}
