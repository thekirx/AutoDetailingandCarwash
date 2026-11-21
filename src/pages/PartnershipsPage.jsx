import BdPageHero from '../components/public/bredesign/BdPageHero'
import PartnershipSection from '../components/public/home/PartnershipSection'

export default function PartnershipsPage() {
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
