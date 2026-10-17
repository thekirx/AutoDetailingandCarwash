import c70 from '../assets/tint-finder/films/C70.webp'
import c30 from '../assets/tint-finder/films/C30.webp'
import c20 from '../assets/tint-finder/films/C20.webp'
import c08 from '../assets/tint-finder/films/C08.webp'
import hc35 from '../assets/tint-finder/films/HC35.webp'
import hc25 from '../assets/tint-finder/films/HC25.webp'
import hc15 from '../assets/tint-finder/films/HC15.webp'
import hc05 from '../assets/tint-finder/films/HC05.webp'
import black35 from '../assets/tint-finder/films/Black35.webp'
import black25 from '../assets/tint-finder/films/Black25.webp'
import black15 from '../assets/tint-finder/films/Black15.webp'
import black05 from '../assets/tint-finder/films/Black05.webp'

/* Supplier sample photos, one per film, keyed like tintFinderConfig.films.
   They live in code rather than the saved settings row, so a settings save
   can never point a shade at the wrong photo. */
const PHOTOS = {
  'Clear Bluish': c70,
  C30: c30,
  C20: c20,
  C08: c08,
  HC35: hc35,
  HC25: hc25,
  HC15: hc15,
  HC05: hc05,
  Black35: black35,
  Black25: black25,
  Black15: black15,
  Black05: black05,
}

export function tintFilmPhoto(filmKey) {
  return PHOTOS[filmKey] || null
}
