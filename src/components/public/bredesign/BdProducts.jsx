/* "What goes on your car" — mock B's product wall, between the tint section and
   the closing CTA.
 *
 * The marks are the supplier artwork, normalised onto one tile size by
 * design-mocks/logos/normalize.js. Eight brands hand over eight different
 * sizes, paddings and grounds; without that pass the row reads as a sticker
 * sheet rather than a wall.
 *
 * Display rights still need confirming with each distributor before launch,
 * which the note under the wall says on the page rather than only here.
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

        <div className="bd-brand-wall bd-reveal">
          {BRANDS.map((brand) => (
            <div className="bd-brand" key={brand.name}>
              <img src={brand.src} alt={brand.name} width="720" height="400" />
              <span>{brand.use}</span>
            </div>
          ))}
        </div>

        <p className="bd-brand-note">
          <em>Supplier marks</em>
          Logo artwork as supplied by each distributor. Confirm display rights with each brand before
          launch.
        </p>
      </div>
    </section>
  )
}
