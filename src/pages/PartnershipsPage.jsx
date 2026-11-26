import { useMemo } from 'react'
import { buildBreadcrumbJsonLd, usePageMeta } from '../lib/pageMeta'
import { PUBLIC_ROUTE_SEO } from '../lib/publicSeoCatalog'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import PartnershipSection from '../components/public/home/PartnershipSection'

export default function PartnershipsPage() {
  const seo = PUBLIC_ROUTE_SEO['/partnerships']
  const breadcrumbJsonLd = useMemo(
    () =>
      buildBreadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Partnerships', path: '/partnerships' },
      ]),
    [],
  )

  usePageMeta({
    title: seo.title,
    description: seo.description,
    path: '/partnerships',
    jsonLd: breadcrumbJsonLd,
    jsonLdId: 'hakum-partnerships-breadcrumb',
  })

  return (
    <div className="partnership-page">
      <BdPageHero
        eyebrow="Work with Hakum"
        title={
          <>
            Brand collabs &amp;
            <br />
            <em>car meets.</em>
          </>
        }
        copy="Partner with Hakum Auto Care across Bacoor, Cavite and Batangas City for automotive events, detailing clinics, product launches, and club meets."
      />
      <PartnershipSection />
    </div>
  )
}
