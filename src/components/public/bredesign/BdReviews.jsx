/* Google reviews, on the homepage directly under the photo and video gallery.
 *
 * The gallery is us showing our own work; this is the outside voice confirming
 * it, which is why it sits there rather than further down the page.
 *
 * Two reviews, both real, both supplied by the owner from their own Google
 * listings. Nothing here is written by us: the words, names and branches are
 * what Google shows. Everything links back out to Google — each card to its own
 * review, the button to the business listings — so a reader can verify any of
 * it rather than taking a quoted testimonial on trust.
 *
 * No overall rating or review count is printed. Two reviews are not an average,
 * and a figure nobody has verified is the kind of claim this section exists to
 * avoid. Dates are omitted for the same reason: Google shows them relatively
 * ("a year ago"), and hard-coding that would quietly become false.
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
   re-issue if a listing moves. */
const REVIEWS = [
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
    name: 'Paul Russel Sandoval',
    branch: 'Batangas',
    rating: 5,
    quote:
      'Hands down one of the best carwash services around Batangas City! Hakum did a fast, thorough, and flawless job. Friendly staff and great value. Highly recommended!',
    href: 'https://share.google/2YwjrE1QVXO2sYasP',
  },
]

const ALL_REVIEWS_URL = 'https://www.google.com/maps/search/?api=1&query=Hakum+Auto+Care'

function Stars({ count, name }) {
  return (
    <span className="bd-review-stars" role="img" aria-label={`${count} out of 5 stars, review by ${name}`}>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 2 3 6.6 7 .7-5.2 4.8 1.5 7-6.3-3.7L5.7 21l1.5-7L2 9.3l7-.7L12 2Z" />
        </svg>
      ))}
    </span>
  )
}

export default function BdReviews() {
  return (
    <section className="bd-reviews" id="reviews">
      <div className="bd-shell">
        <div className="bd-head bd-reviews-head bd-reveal">
          <div>
            <p className="bd-eyebrow">Reviews from actual clients</p>
            <h2 className="bd-skew">
              What owners
              <br />
              <em>actually say.</em>
            </h2>
          </div>
          <a
            className="bd-review-cta"
            href={ALL_REVIEWS_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            {GOOGLE_MARK}
            Read all reviews on Google
          </a>
        </div>

        <div className="bd-reviews-grid bd-reveal">
          {REVIEWS.map((review) => (
            <a
              className="bd-review"
              key={review.name}
              href={review.href}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className="bd-review-top">
                <span className="bd-review-avatar" aria-hidden="true">
                  {review.name.charAt(0)}
                </span>
                <span className="bd-review-who">
                  <b>{review.name}</b>
                  <s>{review.branch}</s>
                </span>
                <span className="bd-review-source" aria-hidden="true">
                  {GOOGLE_MARK}
                </span>
              </span>
              <Stars count={review.rating} name={review.name} />
              <p>{review.quote}</p>
              <span className="bd-review-go" aria-hidden="true">
                Read on Google ↗
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
