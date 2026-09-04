import test from 'node:test'
import assert from 'node:assert/strict'

import { SERVICE_DETAIL_CONTENT } from '../src/data/serviceDetailContent.js'
import { publicServiceDestination } from '../src/lib/publicCatalog.js'

test('public service destinations keep editorial pages, queue, and booking flows distinct', () => {
  assert.deepEqual(
    publicServiceDestination({ id: 'ppf-id', slug: 'paint-protection-film', title: 'Paint Protection Film' }),
    { to: '/services/ppf' },
  )
  assert.deepEqual(
    publicServiceDestination({ id: 'ceramic-id', slug: 'ceramic-coating', title: 'Ceramic Coating' }),
    { to: '/services/ceramic' },
  )
  assert.deepEqual(
    publicServiceDestination({ id: 'tint-id', slug: 'nano-ceramic-tint', title: 'Nano Ceramic Tint' }),
    { to: '/services/tint' },
  )
  assert.deepEqual(
    publicServiceDestination({ id: 'wash-id', slug: 'premium-car-wash', title: 'Premium Car Wash' }),
    { to: '/queue' },
  )
  assert.deepEqual(
    publicServiceDestination({ id: 'interior-id', slug: 'interior-detailing', title: 'Interior Detailing' }),
    { to: '/book', state: { service: 'Interior Detailing', service_id: 'interior-id' } },
  )
  assert.deepEqual(
    publicServiceDestination({ id: 'glass-id', slug: 'glass-detailing', title: 'Glass Detailing' }),
    { to: '/book', state: { service: 'Glass Detailing', service_id: 'glass-id' } },
  )
})

test('each editorial service has a useful and service-specific FAQ set', () => {
  const ppfText = SERVICE_DETAIL_CONTENT.ppf.faqs.map((item) => `${item.question} ${item.answer}`).join(' ')
  const ceramicText = SERVICE_DETAIL_CONTENT.ceramic.faqs.map((item) => `${item.question} ${item.answer}`).join(' ')
  const tintText = SERVICE_DETAIL_CONTENT.tint.faqs.map((item) => `${item.question} ${item.answer}`).join(' ')

  assert.ok(SERVICE_DETAIL_CONTENT.ppf.faqs.length >= 5)
  assert.ok(SERVICE_DETAIL_CONTENT.ceramic.faqs.length >= 5)
  assert.ok(SERVICE_DETAIL_CONTENT.tint.faqs.length >= 5)

  assert.match(ppfText, /paint protection film|PPF/i)
  assert.doesNotMatch(ppfText, /window tint|ceramic coating/i)

  assert.match(ceramicText, /ceramic coating/i)
  assert.doesNotMatch(ceramicText, /window tint|paint protection film|PPF/i)

  assert.match(tintText, /tint/i)
  assert.doesNotMatch(tintText, /ceramic coating|paint protection film|PPF/i)
})

test('ceramic package benefit is owned by both packages without invented conditions', () => {
  assert.deepEqual(SERVICE_DETAIL_CONTENT.ceramic.packageHighlights, {
    premium: 'Unlimited Recoating',
    platinum: 'Unlimited Recoating',
  })
})
