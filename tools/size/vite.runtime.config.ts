import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Build de mesure de la cible « runtime JS ». Une entree a la fois, choisie par
 * ENTREE : deux entrees dans un meme build partageraient des morceaux, or on
 * veut le poids que TELECHARGE un consommateur, donc chaque entree seule.
 */
const entree = process.env.ENTREE ?? 'runtime-repos'
const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: { alias: { '@': abs('../../src') } },
  build: {
    outDir: abs(`../../dist-size/${entree}`),
    emptyOutDir: true,
    copyPublicDir: false,
    lib: { entry: abs(`./${entree}.ts`), formats: ['es'], fileName: 'r' },
    target: 'es2022'
  }
})
