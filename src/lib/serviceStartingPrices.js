/* "Starts at ₱…" on the public site, read live from the catalog.
   get_public_service_starting_prices returns each active service's lowest
   non-zero price (null when a service is unpriced), so a price changed in the
   admin shows here without a deploy, and nothing ever reads "Starts at ₱0". */

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/* The wash & detailing cards are marketing copy, not catalog rows, so each
   card names the catalog service it is priced from. A card with no entry has
   no service in the catalog yet and shows no price. */
export const WASH_CARD_SERVICE_SLUG = {
  'car-wash': 'premium-car-wash',
  'glass-detailing': 'glass-detailing',
  'interior-detailing': 'interior-detailing',
  'engine-wash': 'engine-wash',
}

let pending = null

/* One request per page load, shared by every card that asks. */
export function fetchStartingPrices() {
  if (!pending) {
    pending = supabase
      .rpc('get_public_service_starting_prices')
      .then(({ data, error }) => {
        if (error) throw error
        const bySlug = {}
        for (const row of data || []) {
          if (row.starting_price_minor > 0) bySlug[row.slug] = row.starting_price_minor
        }
        return bySlug
      })
      .catch(() => {
        // A failed fetch hides the prices rather than showing a wrong one, and
        // lets the next page load try again.
        pending = null
        return {}
      })
  }
  return pending
}

export function useStartingPrices() {
  const [prices, setPrices] = useState({})
  useEffect(() => {
    let active = true
    fetchStartingPrices().then((next) => {
      if (active) setPrices(next)
    })
    return () => {
      active = false
    }
  }, [])
  return prices
}

/* Exact, never rounded: whole pesos when there are no centavos
   (1275000 -> "₱12,750"), centavos when there are (29750 -> "₱297.50"). */
export function formatStartingPrice(minor) {
  const cents = Math.round(Number(minor))
  const whole = cents % 100 === 0
  return `₱${(cents / 100).toLocaleString('en-PH', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`
}
