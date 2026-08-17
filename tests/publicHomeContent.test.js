import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { describe, it } from 'node:test'
import {
  HOME_SECTION_IDS,
  ceramicPackages,
  featuredServices,
  mediaGallery,
  nanoCeramicTint,
  otherServices,
  ppfInformation,
  services,
} from '../src/data/publicHomeContent.js'

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

  it('maps the approved featured and ceramic WebP assets', async () => {
    assert.deepEqual(featuredServices.map(({ title, image }) => [title, new URL(image).pathname.split('/').at(-1)]), [
      ['PAINT PROTECTION FILM', 'paint-protection-film.webp'],
      ['CERAMIC COATING', 'ceramic-coating.webp'],
      ['DETAILING', 'detailing.webp'],
    ])
    assert.deepEqual(ceramicPackages.map(({ title, bgImage }) => [title, new URL(bgImage).pathname.split('/').at(-1)]), [
      ['PREMIUM', 'ceramic-premium.webp'],
      ['PLATINUM', 'ceramic-platinum.webp'],
    ])
    await Promise.all([
      ...featuredServices.map(({ image }) => access(new URL(image))),
      ...ceramicPackages.map(({ bgImage }) => access(new URL(bgImage))),
    ])
  })

  it('keeps exactly four bookable other services with local images', async () => {
    assert.deepEqual(otherServices.map(({ title }) => title), [
      'CARWASH',
      'INTERIOR DETAILING',
      'GLASS DETAILING',
      'ENGINE WASH',
    ])
    await Promise.all(otherServices.map(({ image }) => access(new URL(image))))
  })

  it('exposes the approved service-focused homepage flow', async () => {
    assert.deepEqual(HOME_SECTION_IDS, [
      'hero',
      'ceramic',
      'ppf-information',
      'ppf-packages',
      'nano-ceramic-tint',
      'media-gallery',
      'latest-post',
      'events',
      'partnership',
      'queue',
      'branches',
    ])
    assert.equal(ppfInformation.eyebrow, 'Paint Protection Film')
    assert.deepEqual(ppfInformation.title.split('\n'), [
      'Between your paint',
      'And everything',
      'Out there.',
    ])
    assert.deepEqual(ppfInformation.chapters.map(({ label }) => label), ['Align', 'Form', 'Seal', 'Protected'])
    assert.deepEqual(ppfInformation.chapters.map(({ start }) => start), [0.15, 0.35, 0.55, 0.75])
    assert.deepEqual(ppfInformation.chapters.at(-1).heading.split('\n'), [
      'Now you see the paint.',
      'Not the protection.',
    ])
    assert.equal(ppfInformation.image, '/media/ppf-install/desktop/frame-0001.webp')
    assert.equal(ppfInformation.imageAlt, 'Ford Ranger Raptor beginning a paint protection film installation sequence')
    assert.equal(nanoCeramicTint.title, 'Cooler cabin. Clearer drive.')
    assert.deepEqual(mediaGallery.map(({ title }) => title), ['DETAILING', 'PAINT PROTECTION FILM', 'CERAMIC COATING'])
  })
})
