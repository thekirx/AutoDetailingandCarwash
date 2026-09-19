import test from 'node:test'
import assert from 'node:assert/strict'

import { SERVICE_DETAIL_CONTENT } from '../src/data/serviceDetailContent.js'
import {
  GALLERY_PAGES,
  IMAGES,
  ORIGIN,
  SERVICES,
  SERVICE_POINT_CARDS,
  WASH_GALLERY_PAGES,
  WASH_SERVICES,
  WHY_SECTIONS,
} from '../src/components/public/bredesign/content.js'
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

test('homepage gallery features one real clip from each proof-backed service', () => {
  const featured = Object.entries(SERVICE_DETAIL_CONTENT).flatMap(([serviceId, service]) =>
    (service.proof?.clips || [])
      .filter((clip) => clip.homepageFeatured)
      .map((clip) => ({ serviceId, id: clip.id, poster: clip.poster, sources: clip.sources })),
  )

  assert.deepEqual(
    featured.map(({ serviceId, id }) => [serviceId, id]),
    [
      ['ppf', 'fortuner'],
      ['ceramic', 'honda-city'],
      ['tint', 'naval'],
    ],
  )
  assert.ok(featured.every((clip) => clip.poster.endsWith('-poster.webp')))
  assert.ok(featured.every((clip) => clip.sources.av1.endsWith('.av1.mp4')))
  assert.ok(featured.every((clip) => clip.sources.h264.endsWith('.h264.mp4')))
})

test('PPF and tint loops contain every approved video once on their service page and homepage', () => {
  const ppfIds = SERVICE_DETAIL_CONTENT.ppf.proof.clips.map((clip) => clip.id)
  const tintIds = SERVICE_DETAIL_CONTENT.tint.proof.clips.map((clip) => clip.id)
  const allSources = [
    ...SERVICE_DETAIL_CONTENT.ppf.proof.clips,
    ...SERVICE_DETAIL_CONTENT.tint.proof.clips,
    ...SERVICE_DETAIL_CONTENT.ceramic.proof.clips,
  ].flatMap((clip) => Object.values(clip.sources))
  const homepageClipIds = GALLERY_PAGES.flatMap((page) => page.tiles)
    .filter((tile) => tile.clip)
    .map((tile) => tile.clip[1])

  assert.deepEqual(ppfIds, [
    'fortuner',
    'hilux',
    'sorento',
    'full-body-install',
    'panel-install',
    'civic-feedback',
    'mini-cooper',
    'santa-fe',
    'toyota-cross',
    'white-hilux-install',
    'black-vehicle-install',
    'xpander-cross',
  ])
  assert.deepEqual(tintIds, ['naval', 'wigo', 'toyota86'])
  /* One rail, one clip: the same file must never appear twice on a rail, nor
     under two services. A "Santa Fe ceramic coating" file turned out to be the
     PPF Santa Fe clip, which this catches. */
  const ceramicIds = SERVICE_DETAIL_CONTENT.ceramic.proof.clips.map((clip) => clip.id)
  assert.deepEqual(ceramicIds, [
    'honda-city',
    'byd-emax6',
    'crv',
    'veloz',
    'vios',
    'nissan',
    'tesla',
    'mg',
    'vespa',
  ])
  assert.equal(new Set(ceramicIds).size, ceramicIds.length)
  assert.equal(new Set(ppfIds).size, ppfIds.length)
  assert.equal(new Set(tintIds).size, tintIds.length)
  assert.equal(new Set(allSources).size, allSources.length)
  assert.ok(ppfIds.every((id) => homepageClipIds.filter((homepageId) => homepageId === id).length === 1))
  assert.ok(tintIds.every((id) => homepageClipIds.filter((homepageId) => homepageId === id).length === 1))
})

test('the Tint detail-page CTA books Tint instead of looping back to the services catalog', () => {
  const tint = WHY_SECTIONS.find((section) => section.id === 'tint')
  assert.deepEqual(tint.cta, { label: 'Book nano ceramic tint', to: '/book' })
})

test('the Hakum story uses the supplied storefront photograph and complete approved story', () => {
  assert.equal(new URL(ORIGIN.image).pathname.split('/').at(-1), 'hakum-story-clean-cars.webp')
  assert.equal(new URL(ORIGIN.imageWide).pathname.split('/').at(-1), 'hakum-story-storefront-crop.webp')
  assert.equal(ORIGIN.imageAlt, 'Hakum storefront with its PPF, coating, tint and wash sign as a car speeds past')
  /* The story reads as a lede and then one block: the second and third
     paragraphs were combined, so no sentence of the owner's story may be lost
     in the join. */
  assert.deepEqual(ORIGIN.paragraphs, [
    'Founded in 2024, Hakum Auto Care was established on the principle that exceptional service begins with genuine care and pride in every job we undertake.',
    'We specialize in fast, high-quality auto detailing, treating every vehicle with the same attention and respect we give our own. The name “Hakum” originates from a heartfelt expression my son used as a child to say “I love you.” It serves as a constant reminder that our work should always come from a place of sincerity and dedication. Whether it’s a quick wash or comprehensive detailing, our customers can expect expert craftsmanship, premium products, and a team that truly treats every car as if it were their own.',
  ])
  /* The founding date lives in the lede now that the Est. badge is gone. */
  assert.equal(ORIGIN.tagTitle, undefined)
  assert.equal(ORIGIN.tagLine, undefined)
  assert.match(ORIGIN.paragraphs[0], /Founded in 2024/)
})

test('wash and detailing has two unique photo mosaics for its looping gallery', () => {
  assert.equal(WASH_GALLERY_PAGES.length, 2)
  assert.ok(WASH_GALLERY_PAGES.every((page) => page.tiles.length === 4))
  const photos = WASH_GALLERY_PAGES.flatMap((page) => page.tiles.map((tile) => tile.photo.src))
  assert.equal(new Set(photos).size, photos.length)
  assert.deepEqual(photos.map((src) => src.split('?')[0].split('/').at(-1)), [
    'wash-gallery-01.jpg',
    'wash-gallery-02.jpg',
    'wash-gallery-03.jpg',
    'wash-gallery-04.jpg',
    'wash-gallery-05.jpg',
    'wash-gallery-06.jpg',
    'wash-gallery-07.jpg',
    'wash-gallery-08.jpg',
  ])
})

test('Premium Wash & Detailing opens a page whose only subservice surface is a looping rail', () => {
  const wash = SERVICES.find((service) => service.title === 'Premium Wash & Detailing')
  assert.equal(wash.to, '/services/wash-detailing')
  assert.equal(wash.popup, undefined)
  assert.deepEqual(WASH_SERVICES.map((service) => service.title), [
    'Premium Car Wash',
    'Glass Coating',
    'Glass Detailing',
    'Interior Detailing',
    'Interior Deep Cleaning',
    'Bactozero',
    'Black Trims Restoration',
    'Headlight Restoration',
    'Engine Wash',
    'Mobile Detailing',
  ])
  const washImages = WASH_SERVICES.map((service) => service.image).filter(Boolean)
  assert.equal(new Set(washImages).size, washImages.length, 'wash services must not reuse photos')
  assert.deepEqual(washImages.map((src) => src.split('?')[0].split('/').at(-1)), [
    'carwash.webp',
    'glass-coating.webp',
    'glass-detailing.webp',
    'interior-detailing.webp',
    'interior-deep-cleaning.webp',
    'bactozero.webp',
    'black-trims-restoration.webp',
    'detailing.webp',
    'engine-wash.webp',
    'mobile-detailing.webp',
  ])
  assert.equal(WASH_SERVICES.find((service) => service.id === 'interior-detailing').image, IMAGES.interior)
  assert.equal(SERVICE_DETAIL_CONTENT['wash-detailing'].serviceName, 'Premium Wash & Detailing')
})

test('PPF and Ceramic benefit cards keep the approved claims and use claim-specific photography', () => {
  assert.deepEqual(SERVICE_POINT_CARDS.ppf.map((card) => card.title), [
    'Self-healing top coat',
    'Impact-ready barrier',
    'Hydrophobic performance',
    'Anti-yellowing TPU',
  ])
  assert.equal(SERVICE_POINT_CARDS.ppf.some((card) => /optical clarity/i.test(card.title)), false)

  assert.deepEqual(SERVICE_POINT_CARDS.ceramic.map((card) => card.title), [
    'Permanent molecular bond',
    'Extreme gloss & depth',
    'Hydrophobic self-cleaning',
    'UV & chemical resistance',
  ])
  /* Bundled assets arrive as absolute URLs and files under public/ as root
     paths, so compare on the filename either way. */
  const fileName = (src) => src.split('?')[0].split('/').at(-1)

  /* Every benefit photograph is real Hakum work, and no two benefits share a
     frame: a tile that repeats its neighbour is a tile that is illustrating the
     heading rather than the claim. */
  assert.deepEqual(SERVICE_POINT_CARDS.ceramic.map((card) => fileName(card.image)), [
    'ceramic-tesla-application.jpg',
    'ceramic-tesla-gloss.jpg',
    'ceramic-tesla-finish.jpg',
    'mg-poster.webp',
  ])
  assert.deepEqual(SERVICE_POINT_CARDS.ppf.map((card) => fileName(card.image)), [
    'mini-cooper-poster.webp',
    'ppf-clearpro-install.webp',
    'ppf-information-grey-truck-clean.jpg',
    'toyota-cross-poster.webp',
  ])

  for (const service of ['ppf', 'ceramic']) {
    const shots = SERVICE_POINT_CARDS[service].map((card) => fileName(card.image))
    assert.equal(new Set(shots).size, shots.length, `${service} benefit photos repeat`)
    /* The ceramic application crop is deliberately anchored low so its
       technician, applicator, and paint—not the social-post header—carry the
       claim. The remaining rejected assets mismatch their card claims. */
    for (const shot of shots) {
      assert.doesNotMatch(shot, /ceramic-tesla-hydrophobic|clearpro-(?:hydrophobic|self-healing|anti-yellowing)/)
    }
  }
  assert.equal(SERVICE_DETAIL_CONTENT.ceramic.proof.title, 'A finish that stays showroom ready.')
  assert.deepEqual(SERVICE_POINT_CARDS.tint.map((card) => card.title), [
    'Heat rejection',
    'Clear outward visibility',
    'Signal-safe performance',
    'UV interior protection',
  ])
})
