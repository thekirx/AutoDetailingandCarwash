import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { aboutImage, services } from '../src/data/publicHomeContent.js'

describe('Public homepage content assets', () => {
  it('maps seven available services to local images', async () => {
    const available = services.filter((service) => service.available)
    assert.equal(available.length, 7)
    assert.deepEqual(available.map((service) => service.title), [
      'Carwash',
      'Interior Detailing',
      'Ceramic Tint',
      'Ceramic Coating',
      'Glass Detailing',
      'Engine Wash',
      'Paint Protection Film',
    ])
    assert.ok(available.every((service) => service.imageAlt?.includes(service.title)))
    await Promise.all(available.map((service) => access(new URL(service.image))))
  })

  it('keeps Mobile Detailing locked without an image', () => {
    const mobile = services.find((service) => service.title === 'Mobile Detailing')
    assert.deepEqual(mobile, {
      number: '08',
      title: 'Mobile Detailing',
      copy: 'Premium Hakum car care delivered where it is most convenient.',
      image: null,
      imageAlt: null,
      available: false,
    })
  })

  it('maps the dedicated About Us image', async () => {
    assert.match(new URL(aboutImage).pathname, /about-hkm-21\.webp$/)
    await access(new URL(aboutImage))
  })
})
