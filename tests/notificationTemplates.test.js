import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  birthdayPerkExpiresAt,
  birthdayQueryDays,
  isBirthdayPerkActive,
  isBirthdayToday,
  isLeapYear,
  parseDateOnly,
} from '../src/lib/birthdayPerk.js'
import {
  SYSTEM_TEMPLATES,
  SYSTEM_TEMPLATE_KEYS,
  applyTemplateText,
  bookingNotifyVars,
  bookingTemplateKey,
  mergeNotificationTemplates,
  templateByKey,
  templatesByKeyMap,
} from '../src/lib/notificationTemplates.js'
import { renderNotificationMessage } from '../src/lib/notificationCopy.js'

describe('system notification catalog', () => {
  it('lists every service status for customer and ops, plus birthday', () => {
    const statuses = [
      'pending',
      'confirmed',
      'waiting',
      'in_progress',
      'final_checking',
      'for_payment',
      'completed',
      'cancelled',
      'redo',
    ]
    for (const status of statuses) {
      assert.ok(templateByKey(bookingTemplateKey(status, 'customer')), status)
      assert.ok(templateByKey(bookingTemplateKey(status, 'ops')), `${status} ops`)
    }
    assert.ok(templateByKey('birthday.greeting'))
    assert.ok(templateByKey('lifecycle.welcome_app'))
    assert.equal(new Set(SYSTEM_TEMPLATE_KEYS).size, SYSTEM_TEMPLATES.length)
  })

  it('overlays SA edits and keeps defaults for blank fields', () => {
    const merged = mergeNotificationTemplates([
      { key: 'birthday.greeting', title: 'Happy bday', body: '', sms_body: 'SMS hi {name}', enabled: false },
      { key: 'unknown.skip', title: 'nope' },
    ])
    const bday = merged.find((t) => t.key === 'birthday.greeting')
    assert.equal(bday.title, 'Happy bday')
    assert.equal(bday.enabled, false)
    assert.match(bday.body, /free service/)
    assert.equal(bday.sms_body, 'SMS hi {name}')
    assert.equal(merged.length, SYSTEM_TEMPLATES.length)
  })

  it('renders booking tokens including when', () => {
    const vars = bookingNotifyVars({
      customer_name: 'Ana',
      vehicle_plate: 'ABC1234',
      branch: 'bacoor',
      scheduled_start: '2026-07-23T10:00:00+08:00',
    })
    const sms = applyTemplateText(
      'Hakum Auto Care: CONFIRMED ({branch}{when}).',
      vars,
    )
    assert.match(sms, /bacoor/)
    assert.match(sms, /2026|Jul|23/)
    assert.equal(renderNotificationMessage('Hi {name} {appUrl}', { name: 'Ana' }), 'Hi Ana hakumautocare.com')
  })

  it('builds a lookup map', () => {
    const map = templatesByKeyMap()
    assert.equal(map['booking.completed.customer'].title, 'Service complete')
  })

  it('Failed QA customer default is an apology', () => {
    const t = templateByKey('booking.redo.customer')
    assert.match(t.body, /sorry/i)
    assert.match(t.sms_body, /sorry/i)
  })

  it('migration creates birthday perk + template tables', async () => {
    const { readFile } = await import('node:fs/promises')
    const { dirname, resolve } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const sql = await readFile(
      resolve(root, 'supabase/migrations/20260811140000_birthday_notification_templates.sql'),
      'utf8',
    )
    assert.match(sql, /date_of_birth/)
    assert.match(sql, /customer_birthday_perks/)
    assert.match(sql, /notification_templates/)
    assert.match(sql, /customers_birthday_md_idx/)
    assert.match(sql, /claim_birthday_perk/)
    assert.match(sql, /list_birthday_customers/)
  })
})

describe('birthday calendar', () => {
  it('parses ISO dates and matches Manila today', () => {
    assert.deepEqual(parseDateOnly('1990-08-11'), { year: 1990, month: 8, day: 11 })
    assert.equal(parseDateOnly('nope'), null)
    assert.equal(isLeapYear(2024), true)
    assert.equal(isLeapYear(2026), false)

    const today = new Date('2026-08-11T08:00:00+08:00')
    assert.equal(isBirthdayToday('1990-08-11', today), true)
    assert.equal(isBirthdayToday('1990-08-12', today), false)
  })

  it('treats Feb 29 as Feb 28 in non-leap years', () => {
    const feb28 = new Date('2026-02-28T12:00:00+08:00')
    const { days } = birthdayQueryDays(feb28)
    assert.ok(days.some((d) => d.month === 2 && d.day === 29))
    assert.equal(isBirthdayToday('2000-02-29', feb28), true)

    const leap = new Date('2024-02-28T12:00:00+08:00')
    assert.equal(isBirthdayToday('2000-02-29', leap), false)
  })

  it('expires a perk after 30 days', () => {
    const granted = new Date('2026-08-11T00:00:00Z')
    const expires = birthdayPerkExpiresAt(granted)
    assert.ok(expires.getTime() > granted.getTime())
    assert.equal(
      isBirthdayPerkActive({ status: 'available', expires_at: expires.toISOString() }, new Date('2026-08-20T00:00:00Z')),
      true,
    )
    assert.equal(
      isBirthdayPerkActive({ status: 'available', expires_at: expires.toISOString() }, new Date('2026-09-20T00:00:00Z')),
      false,
    )
    assert.equal(isBirthdayPerkActive({ status: 'claimed', expires_at: expires.toISOString() }, granted), false)
  })
})
