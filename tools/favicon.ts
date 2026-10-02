/** Generate the vector favicon from the supplied site artwork.
 * Raster fallbacks: render this SVG at 16, 32 and 48 px for favicon.ico.
 * Apple touch: render at 180 px on #f4f4f4.
 */
import { writeFileSync } from 'node:fs'
import { characterArtwork } from './site-artwork'
writeFileSync('public/favicon.svg', characterArtwork)
console.log('Updated public/favicon.svg from public/site-character.svg')
