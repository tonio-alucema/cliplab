/**
 * Pese la cible « runtime JS ». Deux entrees, deux builds SEPARES : un build
 * commun partagerait des morceaux, or ce qu'on veut est le poids telecharge par
 * un consommateur qui n'en prend qu'une.
 */
import { execFileSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const config = fileURLToPath(new URL('./vite.runtime.config.ts', import.meta.url))
const racine = fileURLToPath(new URL('../..', import.meta.url))
const ko = (n) => `${(n / 1024).toFixed(1)} ko`

console.log('\n### runtime JS (min + gzip)')
console.log('entree              min       gzip')
for (const entree of ['runtime-repos', 'runtime-cycle']) {
  execFileSync('npx', ['vite', 'build', '--config', config, '--logLevel', 'warn'], {
    cwd: racine,
    env: { ...process.env, ENTREE: entree },
    stdio: 'inherit'
  })
  const js = readFileSync(new URL(`../../dist-size/${entree}/r.js`, import.meta.url))
  console.log(`${entree.padEnd(18)} ${ko(js.length).padStart(9)} ${ko(gzipSync(js, { level: 9 }).length).padStart(10)}`)
}
