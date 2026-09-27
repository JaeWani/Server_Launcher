import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

function option(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const version = option('version')
const assetBaseUrl = option('asset-base-url')
const serverAddress = option('server') || ''
if (!version || !assetBaseUrl) {
  throw new Error('사용법: node scripts/build-release.mjs --version 0.1.0 --asset-base-url https://github.com/OWNER/REPOSITORY/releases/download/modpack-0.1.0 [--server host:25565]')
}

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceMods = path.resolve(here, '..', 'mods')
const output = path.join(here, 'release')
const outputMods = path.join(output, 'files', 'mods')
await rm(output, { recursive: true, force: true })
await mkdir(outputMods, { recursive: true })
await cp(sourceMods, outputMods, { recursive: true })

const entries = await (await import('node:fs/promises')).readdir(outputMods)
const files = await Promise.all(entries.filter(name => name.endsWith('.jar')).sort().map(async name => {
  const content = await readFile(path.join(outputMods, name))
  return {
    path: `mods/${name}`,
    url: `${assetBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(name)}`,
    size: (await stat(path.join(outputMods, name))).size,
    sha256: createHash('sha256').update(content).digest('hex')
  }
}))

const manifest = {
  formatVersion: 1,
  version,
  minecraftVersion: '1.21.1',
  neoForgeVersion: '21.1.250',
  serverAddress,
  files
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`release/ 생성 완료: ${files.length}개 클라이언트 모드, 버전 ${version}`)
console.log(`GitHub Release asset base URL: ${assetBaseUrl.replace(/\/$/, '')}`)
