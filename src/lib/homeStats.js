import { supabase } from './supabase'

/**
 * The homepage counters.
 *
 * Each figure is a base plus whatever the database can count on top of it. The
 * base is the work done before this system existed — roughly a decade of it,
 * none of which is in the bookings table — so a purely live count would read as
 * a few dozen and quietly downgrade the business by three orders of magnitude.
 *
 * Only the two countable figures grow. Years of experience is not derivable
 * from any table, and team size is a headcount nobody is keeping current here,
 * so both stay content.
 */
export const STAT_BASE = {
  services: 15000,
  clients: 3000,
}

export const STATIC_STATS = {
  years: 10,
  team: 26,
}

/**
 * Reads the public aggregate view. Returns nulls rather than throwing: the
 * counters are decoration on a marketing page, and a homepage that fails to
 * render because a count could not be fetched is a far worse outcome than one
 * showing its base figures.
 */
export async function fetchHomeStats(client = supabase) {
  try {
    const { data, error } = await client
      .from('public_home_stats')
      .select('services_done, returning_clients')
      .maybeSingle()

    if (error || !data) return { servicesDone: null, returningClients: null }
    return {
      servicesDone: Number(data.services_done) || 0,
      returningClients: Number(data.returning_clients) || 0,
    }
  } catch {
    return { servicesDone: null, returningClients: null }
  }
}

/** Base plus live, falling back to the base alone when the count is missing. */
export function withBase(base, live) {
  return base + (Number.isFinite(live) ? live : 0)
}
