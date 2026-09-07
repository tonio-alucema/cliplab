import { build } from 'vite'
import { fileURLToPath } from 'node:url'
const entry = fileURLToPath(new URL('../src/studio/runtime.ts', import.meta.url))
await build({ configFile: false, publicDir: false, logLevel: 'warn', build: { outDir: 'public/runtime', emptyOutDir: true, lib: { entry, formats: ['es'], fileName: () => 'cliplab.js' }, minify: true } })
