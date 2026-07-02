const pageContent = {
  services: ['Services Management', 'Configure packages, pricing, and availability.'],
  queue: ['Queue Management', 'Move accepted bookings into the active service queue and update customer-safe status.'],
}

export function AdminPage({ page }) {
  const [title, description] = pageContent[page]
  return (
    <section>
      <p className="mb-2 text-xs tracking-[0.22em] text-lime-400 uppercase">Operations</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 text-slate-400">{description}</p>
      <div className="mt-8 min-h-72 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-500">Module content will appear here.</div>
    </section>
  )
}
