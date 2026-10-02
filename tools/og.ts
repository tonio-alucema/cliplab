/** Generate the 1200 × 630 social card. Rasterize og.svg to og.png after changes. */
import { writeFileSync } from 'node:fs'
import { characterArtwork } from './site-artwork'

const character = characterArtwork.replace('<svg ', '<svg x="90" y="80" ')
  .replace('width="528" height="528"', 'width="470" height="470"')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<title>ClipLab — Character Studio</title>
<rect width="1200" height="630" fill="#f4f4f4"/>
${character}
<g font-family="Helvetica,Arial,sans-serif">
<text x="620" y="300" font-size="80" font-weight="700" letter-spacing="-3" fill="#292929">CLIPLAB</text>
<text x="624" y="355" font-size="30" fill="#727679">Character Studio</text>
</g>
</svg>`
writeFileSync('public/og.svg', svg)
console.log('Updated public/og.svg from public/site-character.svg')
