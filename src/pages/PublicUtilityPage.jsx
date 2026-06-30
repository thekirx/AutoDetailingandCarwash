import { ArrowLeft, Clock3, MapPin, Radio } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

const branchDetails = {
  bacoor: { name: 'Bacoor Branch', location: 'RFC Mall, Bacoor' },
  batangas: { name: 'Hakum Batangas', location: 'Batangas' },
}

export function QueuePage() {
  const { branch } = useParams()
  const details = branchDetails[branch]
  if (!details) return <PublicMessage eyebrow="Live queue" title="Branch not found" message="Choose a valid Hakum branch from the home page." />

  return <PublicMessage eyebrow="Live queue" title={details.name} message={`Live queue information for ${details.location} will appear here.`} icon={Radio} />
}

export function BookingPage() {
  return <PublicMessage eyebrow="Online booking" title="Give your car the Hakum treatment." message="The complete service selection and booking request flow is coming in the next module." icon={Clock3} />
}

function PublicMessage({ eyebrow, title, message, icon: Icon = MapPin }) {
  return (
    <section className="grid min-h-[620px] place-items-center px-5 py-20 text-center">
      <div className="max-w-xl"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-lime-400/10 text-lime-300"><Icon /></span><p className="mt-7 text-xs font-semibold tracking-[0.2em] text-lime-400 uppercase">{eyebrow}</p><h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1><p className="mt-5 leading-7 text-slate-400">{message}</p><Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-lime-400/40 hover:text-lime-300"><ArrowLeft size={17} />Back to home</Link></div>
    </section>
  )
}
