import { readFileSync } from 'node:fs'

// Preserve the supplied Milo artwork. Crop only its empty snapshot canvas.
export const characterArtwork = readFileSync('public/site-character.svg', 'utf8')
  .replace(/<metadata>[\s\S]*?<\/metadata>/, '')
  .replace(/<title>[\s\S]*?<\/title>/, '<title>ClipLab character</title>')
  .replace(/width="1080" height="1080" viewBox="0 0 1080 1080"/, 'width="528" height="528" viewBox="276 276 528 528"')
