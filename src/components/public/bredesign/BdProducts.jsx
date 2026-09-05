import useMarquee from './useMarquee'

/* "What goes on your car" — mock B's product wall, between the tint section and
   the closing CTA.
 *
 * The marks are the supplier artwork, normalised onto one tile size by
 * design-mocks/logos/normalize.js. Eight brands hand over eight different
 * sizes, paddings and grounds; without that pass the row reads as a sticker
 * sheet rather than a wall.
 *
 */

const BRANDS = [
  {
    name: 'ClearPro',
    use: 'Paint protection film',
    src: new URL('../../../assets/brands/clearpro.png', import.meta.url).href,
  },
  {
    name: 'F1 Auto Films',
    use: 'Window film',
    src: new URL('../../../assets/brands/f1-auto-films.png', import.meta.url).href,
  },
  {
    name: 'Kisho',
    use: 'Ceramic coating',
    src: new URL('../../../assets/brands/kisho.png', import.meta.url).href,
  },
  {
    name: 'Menzerna',
    use: 'Polishing compounds',
    src: new URL('../../../assets/brands/menzerna.png', import.meta.url).href,
  },
  {
    name: 'Rupes',
    use: 'Polishing systems',
    src: new URL('../../../assets/brands/rupes.png', import.meta.url).href,
  },
  {
    name: 'Sonax',
    use: 'Detailing chemistry',
    src: new URL('../../../assets/brands/sonax.png', import.meta.url).href,
  },
  {
    name: "Meguiar's",
    use: 'Surface care',
    src: new URL('../../../assets/brands/meguiars.png', import.meta.url).href,
  },
  {
    name: 'Microtex',
    use: 'Towels & applicators',
    src: new URL('../../../assets/brands/microtex.png', import.meta.url).href,
  },
]

export default function BdProducts() {
  const { viewportRef, trackRef } = useMarquee()

  return (
    <section className="bd-products" id="products">
      <div className="bd-shell">
        <div className="bd-head bd-reveal">
          <div>
            <p className="bd-eyebrow">Products we use</p>
            <h2 className="bd-skew">
              What goes
              <br />
              on your car.
            </h2>
          </div>
          <p>
            We name our materials because the finish is only ever as good as they are. Film, coating,
            polish, and chemistry — on the record.
          </p>
        </div>

      </div>

      {/* A marquee, not a grid. The strip is rendered twice and translated by
          exactly half its width, so the second copy is under the cursor at the
          moment the first finishes — that is what makes the loop seamless
          rather than snapping back. The whole track is aria-hidden and the
          names are listed once for a screen reader below, because a reader
          should not have to sit through eight logos twice. */}
      <div className="bd-marquee" ref={viewportRef} aria-hidden="true">
        <div className="bd-marquee-track" ref={trackRef}>
          {[0, 1].map((copy) => (
            <div className="bd-marquee-run" key={copy}>
              {BRANDS.map((brand) => (
                <div className="bd-brand" key={`${copy}-${brand.name}`}>
                  <img src={brand.src} alt="" width="720" height="400" draggable="false" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="bd-sr-only">
        Products we use: {BRANDS.map((b) => `${b.name} for ${b.use.toLowerCase()}`).join(', ')}.
      </p>

    </section>
  )
}
