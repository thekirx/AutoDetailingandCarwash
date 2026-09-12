import { LoopArrows, LoopBar } from './LoopRail'
import { loopSlides, useLoopRail } from './useLoopRail'

/* Google reviews, on the homepage directly under the photo and video gallery.
 *
 * The gallery is us showing our own work; this is the outside voice confirming
 * it, which is why it sits there rather than further down the page.
 *
 * Ten reviews, all real, all supplied by the owner from their own Google
 * listings. Nothing here is written by us: the words, names and branches are
 * what Google shows. Two were written in Filipino, and the text is Google's own
 * English translation — each of those cards says so. Everything links back out
 * to Google — each card to its own review, and one button per branch profile —
 * so a reader can verify any of it rather than taking a testimonial on trust.
 *
 * No overall rating or review count is printed: a figure nobody has checked
 * against both profiles is the kind of claim this section exists to avoid.
 * Dates are omitted for the same reason — Google shows them relatively
 * ("a month ago"), and hard-coding that would quietly become false.
 */

const GOOGLE_MARK = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.4-.2-2H12v3.8h6a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.1-4.7 3.1-7.8Z" />
    <path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.7c-1 .7-2.2 1-3.6 1-2.8 0-5.2-1.8-6-4.3H2.3v2.8A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC04" d="M6 14.4a6.6 6.6 0 0 1 0-4.2V7.4H2.3a11 11 0 0 0 0 9.8L6 14.4Z" />
    <path fill="#EA4335" d="M12 5.5c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.4L6 10.2c.9-2.5 3.2-4.7 6-4.7Z" />
  </svg>
)

/* The owner's own share links. They resolve to each review on Google Maps, and
   are kept in their short form because that is what the owner holds and can
   re-issue if a listing moves. The order mixes branches and alternates long
   and short reviews, so no stretch of the rail reads thin. */
const REVIEWS = [
  {
    name: 'Liza Cay',
    branch: 'Batangas',
    rating: 5,
    quote:
      'Very satisfied, they explained well how they will do it, and updated me thru the whole process of ceramic coating. The whole experience was very good. 👍',
    href: 'https://share.google/UZ9wIhquSC9XX2lJK',
  },
  {
    name: 'Pauline Macasaet',
    branch: 'Bacoor',
    rating: 5,
    /* The review closes by pointing readers at a Facebook page. That line is
       left out — sending people off to Facebook from the middle of our own
       page works against the reason this section is here. Nothing else is
       altered. */
    quote:
      'The area was quite spacious, they can accommodate at least 6 car at a time. The waiting area is very clean and they have decent amount of chairs. It is fully air conditioned and they sell car products, pet products and some beverages. The price is decent and cheap for the service they provide. I highly recommend this place and we’ll probably come back next time.',
    href: 'https://share.google/sM5si2yZu7rixjyNl',
  },
  {
    name: 'Marryel Joan Macaraig',
    branch: 'Bacoor',
    rating: 5,
    quote:
      'I am a repeat customer and have my cars cleaned here. The cars always look brand new and smells nice after having them washed and waxed. I always get asked where I have them cleaned.',
    href: 'https://share.google/lpF0zmw4zeU7E7liX',
  },
  {
    name: 'Paul Russel Sandoval',
    branch: 'Batangas',
    rating: 5,
    quote:
      'Hands down one of the best carwash services around Batangas City! Hakum did a fast, thorough, and flawless job. Friendly staff and great value. Highly recommended!',
    href: 'https://share.google/2YwjrE1QVXO2sYasP',
  },
  {
    name: 'Benedict Carl',
    branch: 'Bacoor',
    rating: 5,
    quote:
      'Visited 26 of January 2025\n\nAvailed the Basic package with Machine buffing, I could say that I’m satisfied with the services. The place also has a waiting area with a/c and you can leave the keys on the counter area. Also accepting card payments and they also give out loyalty card.\n\nWill definitely visit again.',
    href: 'https://share.google/apvEs8l2d3i7Lwz3I',
  },
  {
    name: 'Krisha May Aguila',
    branch: 'Batangas',
    rating: 5,
    quote: 'Excellent Carwash is comparable to other well-known car wash companies.',
    href: 'https://share.google/t7gyi8hUV0cqYSqvj',
  },
  {
    name: 'Janu Prado',
    branch: 'Bacoor',
    rating: 5,
    quote:
      'Very convenient carwash place, close to RFC Mall so you can go for a foodtrip or shopping while waiting.\n\nThe place is also big and the lounge is nice. The service is also okay even though there are many people washing the car. They still finished our car even though it was late, it was like 6 people washing one car',
    translated: 'Filipino',
    href: 'https://share.google/pjUdkErAvoNWEsYq6',
  },
  {
    name: 'Grace Bunyi',
    branch: 'Batangas',
    rating: 5,
    quote: 'service was very fast and staff was very accommodating and friendly!',
    href: 'https://share.google/dc0sk34aWbttxg2y9',
  },
  {
    name: 'Ailyn De Leon',
    branch: 'Bacoor',
    rating: 5,
    quote: 'Clean, fast, and smells good ⭐️⭐️⭐️⭐️⭐️\nKeep it up! We’ll be back.',
    translated: 'Filipino',
    href: 'https://share.google/0rpL372H6dsN3wtia',
  },
  {
    name: 'Janry Abenis',
    branch: 'Bacoor',
    rating: 5,
    quote: 'Thank you Hakum!! also your staff are great! Thank you guys! amazing team!',
    href: 'https://share.google/zKKtscYB2DeVr4ESH',
  },
]

/* One profile per branch rather than a single "all reviews" link: the listings
   are separate on Google, so a combined link could only ever be a search. Both
   URLs are the owner's own, and each lands on that branch's reviews. */
const BRANCH_PROFILES = [
  { branch: 'Bacoor', href: 'https://share.google/5zOi4a4z1XQ16XrKk' },
  { branch: 'Batangas', href: 'https://share.google/Uq5rzxW8YgHkyfVNk' },
]

function Stars({ count, label }) {
  return (
    <span className="bd-review-stars" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 2 3 6.6 7 .7-5.2 4.8 1.5 7-6.3-3.7L5.7 21l1.5-7L2 9.3l7-.7L12 2Z" />
        </svg>
      ))}
    </span>
  )
}

export default function BdReviews() {
  const rail = useLoopRail(REVIEWS.length)

  return (
    <section className="bd-reviews" id="reviews">
      <div className="bd-shell">
        <div className="bd-reviews-head bd-reveal">
          <p className="bd-eyebrow">Google reviews</p>
          <h2 className="bd-skew">
            What owners <em>actually say.</em>
          </h2>
          <div className="bd-reviews-bar">
            <p className="bd-reviews-sub">Real experiences from Hakum Auto Care customers.</p>
            <div className="bd-reviews-side">
              <span className="bd-review-badge">
                {GOOGLE_MARK}
                <span>
                  <Stars count={5} />
                  <s>Five-star reviews on Google</s>
                </span>
              </span>
              {BRANCH_PROFILES.map((profile) => (
                <a
                  className="bd-review-cta"
                  key={profile.branch}
                  href={profile.href}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {GOOGLE_MARK}
                  {profile.branch}
                </a>
              ))}
              <LoopArrows rail={rail} label="review" />
            </div>
          </div>
        </div>

        <div className="bd-reviews-rail" ref={rail.trackRef}>
          {loopSlides(REVIEWS, rail.copies).map(({ item: review, copy, key }) => (
            <a
              className="bd-review"
              key={key}
              href={review.href}
              target="_blank"
              rel="noreferrer noopener"
              aria-hidden={copy || undefined}
              tabIndex={copy ? -1 : undefined}
            >
              <span className="bd-review-top">
                <span className="bd-review-avatar" aria-hidden="true">
                  {review.name.charAt(0)}
                </span>
                <span className="bd-review-who">
                  <b>{review.name}</b>
                  <s>{review.branch} branch</s>
                </span>
                <span className="bd-review-source">
                  {GOOGLE_MARK}
                  Google Review
                </span>
              </span>
              <Stars
                count={review.rating}
                label={copy ? undefined : `${review.rating} out of 5 stars, review by ${review.name}`}
              />
              <p>{review.quote}</p>
              {review.translated ? (
                <span className="bd-review-translated">Translated from {review.translated} by Google</span>
              ) : null}
              <span className="bd-review-go" aria-hidden="true">
                Read on Google ↗
              </span>
            </a>
          ))}
        </div>
        <LoopBar rail={rail} />
      </div>
    </section>
  )
}
