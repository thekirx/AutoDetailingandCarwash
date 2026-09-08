/* Icons for the why-section feature cards.
 *
 * Drawn inline rather than pulled from lucide, because these carry meaning
 * specific to the service — a self-healing film and a molecular bond are not
 * in any general icon set — and because four small glyphs are not worth a
 * runtime import. Stroke geometry matches lucide's (24px box, 1.7 stroke,
 * round caps) so they sit correctly beside the lucide icons used elsewhere.
 */

const PATHS = {
  /* PPF */
  shield: <><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  impact: <><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M19 5l-2.5 2.5M7.5 16.5 5 19" /><circle cx="12" cy="12" r="3.4" /></>,
  clarity: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  droplet: <><path d="M12 2.7s6 6.4 6 10.4a6 6 0 0 1-12 0c0-4 6-10.4 6-10.4Z" /><path d="M9.4 14.6a2.8 2.8 0 0 0 2.6 2" /></>,
  /* Ceramic */
  bond: <><path d="M9.5 14.5 7 17a3.5 3.5 0 0 1-5-5l2.5-2.5" /><path d="M14.5 9.5 17 7a3.5 3.5 0 0 1 5 5l-2.5 2.5" /><path d="m9 15 6-6" /></>,
  gloss: <path d="m12 2.6 2.5 5.9 5.9 2.5-5.9 2.5L12 19.4l-2.5-5.9L3.6 11l5.9-2.5L12 2.6Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2.6M12 19.4V22M2 12h2.6M19.4 12H22M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9M19.1 4.9l-1.9 1.9M6.8 17.2l-1.9 1.9" /></>,
  /* Tint */
  heat: <><path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4.5 4.5 0 1 1-4 0Z" /><path d="M12 16.5h.01" /></>,
  signal: <><path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4" /><circle cx="12" cy="12" r="1.6" /></>,
  cabin: <><path d="M4 18v-3.6a3 3 0 0 1 .9-2.1l2.4-2.4A3 3 0 0 1 9.4 9h5.2a3 3 0 0 1 2.1.9l2.4 2.4a3 3 0 0 1 .9 2.1V18" /><path d="M4 18h16M8 18v2M16 18v2" /></>,
}

export default function WhyIcon({ name }) {
  const path = PATHS[name]
  if (!path) return null
  return (
    <span className="bd-why-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {path}
      </svg>
    </span>
  )
}
