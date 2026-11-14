import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  branchProductStockCount,
  claimState,
  otherBranchesInStock,
  pickupCodeMatches,
  pickupDaysLeft,
  shopItems,
} from '../src/lib/pointsShop.js'
const item = { id:'tee', show_in_app:true, is_active:true, points_price:50, size_options:[{label:'M'},{label:'L'}], product_branch_stock:[{branch_slug:'bacoor',size_key:'m',qty:1},{branch_slug:'bacoor',size_key:'l',qty:0},{branch_slug:'imus',size_key:'l',qty:2}] }
test('shop mapping excludes hidden/free/inactive/internal items and preserves size stock', () => {
 assert.deepEqual(shopItems([item,{...item,show_in_app:false},{...item,points_price:0},{...item,is_active:false},{...item,usage_kind:'internal'}]),[item])
})
test('claim needs points, an in-stock size and branch, and no pending submission', () => {
 assert.equal(claimState(item,'bacoor','m',55).canClaim,true)
 assert.equal(claimState(item,'bacoor','l',55).canClaim,false)
 assert.equal(claimState(item,'bacoor','',55).canClaim,false)
 assert.equal(claimState(item,'imus','m',55).canClaim,false)
 assert.equal(claimState(item,'bacoor','m',49).canClaim,false)
 assert.equal(claimState(item,'bacoor','m',55,true).canClaim,false)
 assert.equal(claimState(item,'bacoor','m',55).left,5)
})
test('unsized items use only the empty stock key', () => {
 const unsized={...item,size_options:[],product_branch_stock:[{branch_slug:'bacoor',size_key:'',qty:2}]}
 assert.equal(claimState(unsized,'bacoor','',55).canClaim,true)
 assert.equal(claimState(unsized,'bacoor','m',55).canClaim,false)
})
test('expiry countdown uses ceiling and never goes negative', () => {
 const now=new Date('2026-11-05T00:00:00Z')
 assert.equal(pickupDaysLeft('2026-11-15T00:00:00Z',now),10)
 assert.equal(pickupDaysLeft('2026-11-05T00:01:00Z',now),1)
 assert.equal(pickupDaysLeft('2026-11-04T00:00:00Z',now),0)
})
test('server code matching rejects wrong claim, branch, status and expired holds', () => {
 const now=new Date('2026-11-05T00:00:00Z')
 const row={id:'a',branch_slug:'bacoor',pickup_code:'HK-A12B34CD',status:'pending',expires_at:'2026-11-15T00:00:00Z'}
 assert.equal(pickupCodeMatches(row,{id:'a',branch:'bacoor',code:'hk-a12b34cd'},now),true)
 for(const change of [{id:'b'},{branch:'imus'},{code:'HK-WRONG'}]) assert.equal(pickupCodeMatches(row,{id:'a',branch:'bacoor',code:'HK-A12B34CD',...change},now),false)
 assert.equal(pickupCodeMatches({...row,status:'fulfilled'},{id:'a',branch:'bacoor',code:row.pickup_code},now),false)
 assert.equal(pickupCodeMatches({...row,expires_at:'2026-11-04'},{id:'a',branch:'bacoor',code:row.pickup_code},now),false)
})

test('staff can type the pickup code with or without HK-, spaces or a dash', async () => {
  const { normalizePickupCode } = await import('../src/lib/pointsShop.js')
  for (const typed of ['HK-1A2B3C4D', 'hk-1a2b3c4d', '1a2b3c4d', 'HK 1A2B 3C4D', 'hk1a2b3c4d']) {
    assert.equal(normalizePickupCode(typed), 'HK-1A2B3C4D')
  }
  assert.equal(normalizePickupCode('hk-1a2'), 'HK-1A2')
  assert.equal(normalizePickupCode(''), '')
})

test('multi-branch stock helpers sum sized/unsized stock at a branch and list other branches in stock', () => {
  const branches = [
    { slug: 'bacoor', name: 'Hakum Auto Care Bacoor', is_active: true, coming_soon: false, is_public: true },
    { slug: 'batangas', name: 'Hakum Auto Care Batangas', is_active: true, coming_soon: false, is_public: true },
    { slug: 'dasmarinas', name: 'Dasmariñas', is_active: false, coming_soon: true, is_public: true },
  ]
  const sized = {
    id: 'tee',
    size_options: [{ label: 'S' }, { label: 'M' }, { label: 'L' }],
    product_branch_stock: [
      { branch_slug: 'bacoor', size_key: 's', qty: 0 },
      { branch_slug: 'bacoor', size_key: 'm', qty: 0 },
      { branch_slug: 'batangas', size_key: 'm', qty: 4 },
      { branch_slug: 'batangas', size_key: 'l', qty: 3 },
      { branch_slug: 'dasmarinas', size_key: 's', qty: 99 },
    ],
  }
  assert.equal(branchProductStockCount(sized, 'bacoor'), 0)
  assert.equal(branchProductStockCount(sized, 'batangas'), 7)
  assert.deepEqual(
    otherBranchesInStock(sized, 'bacoor', branches).map((b) => b.slug),
    ['batangas'],
  )
})
