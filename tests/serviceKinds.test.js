import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  filterPosBayCatalog,
  filterPosDetailingCatalog,
  filterServicesByKind,
  formatQueueNumberForKind,
  isDetailingPayCategory,
  isSameDayQueueKind,
  isTicketOnTodayFloor,
  payCategoryOptionsForCatalogScope,
  defaultPayCategoryForCatalogScope,
  searchServices,
  serviceKindFromPayCategory,
} from '../src/lib/serviceKinds.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(
  join(root, 'supabase/migrations/20260808130000_detailing_persistent_queue_numbers.sql'),
  'utf8',
)

describe('serviceKinds', () => {
  it('maps pay_category to service / package / detailing', () => {
    assert.equal(serviceKindFromPayCategory('general'), 'service')
    assert.equal(serviceKindFromPayCategory('wash'), 'service')
    assert.equal(serviceKindFromPayCategory('addon'), 'service')
    assert.equal(serviceKindFromPayCategory('package'), 'package')
    assert.equal(serviceKindFromPayCategory('ppf'), 'package')
    assert.equal(serviceKindFromPayCategory('detailing'), 'detailing')
    assert.equal(isDetailingPayCategory('detailing'), true)
    assert.equal(isSameDayQueueKind('detailing'), false)
    assert.equal(isSameDayQueueKind('package'), true)
  })

  it('filters and searches catalog rows by kind', () => {
    const rows = [
      { id: '1', name: 'Express Wash', pay_category: 'wash' },
      { id: '2', name: 'Ceramic Package', pay_category: 'package' },
      { id: '3', name: 'Full Interior', pay_category: 'detailing' },
    ]
    assert.equal(filterServicesByKind(rows, 'service').length, 1)
    assert.equal(filterServicesByKind(rows, 'package')[0].id, '2')
    assert.equal(searchServices(rows, 'interior')[0].id, '3')
    assert.equal(filterPosBayCatalog(rows).length, 2)
    assert.equal(filterPosDetailingCatalog(rows)[0].id, '3')
    assert.equal(defaultPayCategoryForCatalogScope('detailing'), 'detailing')
    assert.ok(payCategoryOptionsForCatalogScope('bay').every((r) => r.kind !== 'detailing'))
    assert.ok(payCategoryOptionsForCatalogScope('detailing').every((r) => r.kind === 'detailing'))
  })

  it('keeps open wash/package/detailing on the floor until POS completes', () => {
    const today = '2026-08-08'
    const yesterday = '2026-08-07'
    for (const cat of ['wash', 'package', 'detailing']) {
      assert.equal(
        isTicketOnTodayFloor({ status: 'waiting', queue_date: yesterday, service_pay_category: cat }, today),
        true,
        `waiting ${cat}`,
      )
      assert.equal(
        isTicketOnTodayFloor({ status: 'for_payment', queue_date: yesterday, service_pay_category: cat }, today),
        true,
        `for_payment ${cat}`,
      )
    }
    assert.equal(
      isTicketOnTodayFloor({ status: 'completed', queue_date: yesterday, service_pay_category: 'wash' }, today),
      false,
    )
    assert.equal(
      isTicketOnTodayFloor({ status: 'cancelled', queue_date: yesterday, service_pay_category: 'package' }, today),
      false,
    )
  })

  it('uses D- prefix for detailing queue labels', () => {
    assert.equal(formatQueueNumberForKind(7, 'detailing'), 'D-007')
    assert.equal(formatQueueNumberForKind(7, 'wash'), 'Q-007')
  })
})

describe('detailing persistent queue migration', () => {
  it('adds persistent counter + detailing branch in assign trigger + board pay_category', () => {
    assert.match(migration, /queue_number_counters_persistent/)
    assert.match(migration, /assign_persistent_queue_number/)
    assert.match(migration, /v_pay_category = 'detailing'/)
    assert.match(migration, /service_pay_category/)
    assert.match(migration, /drop view if exists public\.operations_queue_board/)
  })
})
