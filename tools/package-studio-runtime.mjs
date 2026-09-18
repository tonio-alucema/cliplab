import { build } from 'vite'
import ts from 'typescript'
import { zipSync } from 'fflate'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = resolve(root, 'dist-runtime/package')
const metadata = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const entry = resolve(root, 'src/studio/runtime.ts')
// Always package the core player, independently of any optional studio routes.
await build({ configFile: false, publicDir: false, logLevel: 'warn', build: { outDir: out, emptyOutDir: true, lib: { entry, formats: ['es'], fileName: () => 'cliplab.js' }, minify: true } })

const declarations = new Map()
const program = ts.createProgram([entry], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  declaration: true, emitDeclarationOnly: true, skipLibCheck: true, strict: true, resolveJsonModule: true,
  outDir: resolve(out, 'types'),
})
const diagnostics = ts.getPreEmitDiagnostics(program)
if (diagnostics.some(d => d.category === ts.DiagnosticCategory.Error)) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: f => f, getNewLine: () => '\n' }))
program.emit(undefined, (path, text) => { declarations.set(basename(path), text) })
const files = { 'cliplab.js': new Uint8Array(await readFile(resolve(out, 'cliplab.js'))) }
const addText = (name, text) => { files[name] = new TextEncoder().encode(text) }
const addType = (source, target = source) => {
  if (files[target]) return
  const text = declarations.get(source)
  if (!text) throw new Error(`Missing generated type: ${source}`)
  addText(target, text)
  for (const match of text.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)) addType(`${match[1]}.d.ts`)
}
addType('runtime.d.ts', 'cliplab.d.ts')
addText('README.md', await readFile(resolve(root, 'docs/agent-integration.md'), 'utf8'))
addText('LICENSE', await readFile(resolve(root, 'LICENSE'), 'utf8'))
addText('THIRD-PARTY-LICENSES.txt', await readFile(resolve(root, 'node_modules/three/LICENSE'), 'utf8'))
addText('package.json', JSON.stringify({ name: '@cliplab/runtime', version: metadata.version, private: true, type: 'module', main: './cliplab.js', types: './cliplab.d.ts', exports: { '.': { types: './cliplab.d.ts', import: './cliplab.js' } }, license: 'MIT' }, null, 2) + '\n')
const git = args => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null } }
const commitArg = process.argv.find(a => a.startsWith('--source-commit='))?.slice('--source-commit='.length)
if (commitArg && !/^[0-9a-f]{40}$/.test(commitArg)) throw new Error('Expected the full source commit SHA.')
const status = git(['status', '--porcelain', '--untracked-files=no'])
addText('runtime-manifest.json', JSON.stringify({ version: metadata.version, definitionSchemaVersion: 1, sourceCommit: commitArg ?? git(['rev-parse', 'HEAD']), workingTreeDirty: status === null ? null : status.length > 0, sha256: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])) }, null, 2) + '\n')
for (const [name, bytes] of Object.entries(files)) { await mkdir(dirname(resolve(out, name)), { recursive: true }); await writeFile(resolve(out, name), bytes) }
const archive = resolve(root, `dist-runtime/cliplab-runtime-${metadata.version}.zip`)
await writeFile(archive, zipSync(files, { level: 6 }))
console.log(archive)
