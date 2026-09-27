const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const { execFile, spawn } = require('node:child_process')
const { promisify } = require('node:util')
const { pipeline } = require('node:stream/promises')
const { Readable } = require('node:stream')
const execFileAsync = promisify(execFile)

async function findFile(root, name) {
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const candidate = path.join(root, entry.name)
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) return candidate
    if (entry.isDirectory()) {
      const found = await findFile(candidate, name)
      if (found) return found
    }
  }
  return null
}

async function ensurePrism(config, dataRoot, status) {
  const root = path.join(dataRoot, 'prism')
  const existing = fsSync.existsSync(root) ? await findFile(root, 'prismlauncher.exe') : null
  if (existing) return { root, executable: existing }
  if (!config.prismDownloadUrl) throw new Error('launcher-config.json에 prismDownloadUrl을 설정해야 합니다.')

  await fs.mkdir(root, { recursive: true })
  const archive = path.join(root, 'prism-portable.zip')
  status('Prism Launcher 다운로드 중')
  const response = await fetch(config.prismDownloadUrl)
  if (!response.ok) throw new Error(`Prism Launcher를 받을 수 없습니다. (${response.status})`)
  await pipeline(Readable.fromWeb(response.body), fsSync.createWriteStream(archive))
  status('Prism Launcher 압축 해제 중')
  await execFileAsync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${root.replace(/'/g, "''")}' -Force`
  ])
  await fs.rm(archive, { force: true })
  const executable = await findFile(root, 'prismlauncher.exe')
  if (!executable) throw new Error('압축 파일에서 PrismLauncher.exe를 찾지 못했습니다.')
  return { root, executable }
}

async function ensureInstance(prismRoot, config, manifest) {
  const instanceRoot = path.join(prismRoot, 'instances', config.instanceId)
  await fs.mkdir(path.join(instanceRoot, '.minecraft'), { recursive: true })
  await fs.writeFile(path.join(instanceRoot, 'instance.cfg'), [
    `name=${config.instanceName || config.instanceId}`,
    'InstanceType=OneSix',
    'iconKey=default'
  ].join('\n'))
  await fs.writeFile(path.join(instanceRoot, 'mmc-pack.json'), JSON.stringify({
    formatVersion: 1,
    components: [
      { cachedName: 'Minecraft', cachedVersion: manifest.minecraftVersion, important: true, uid: 'net.minecraft', version: manifest.minecraftVersion },
      { cachedName: 'NeoForge', cachedVersion: manifest.neoForgeVersion, uid: 'net.neoforged', version: manifest.neoForgeVersion }
    ]
  }, null, 2))
}

async function launchInstance(executable, prismRoot, config, manifest) {
  const serverAddress = manifest.serverAddress || config.serverAddress
  const args = ['--dir', prismRoot, '--launch', config.instanceId]
  if (serverAddress) args.push('--server', serverAddress)
  const child = spawn(executable, args, { detached: true, stdio: 'ignore', windowsHide: false })
  child.unref()
}

module.exports = { ensurePrism, ensureInstance, launchInstance }
