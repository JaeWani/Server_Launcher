const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const { pipeline } = require('node:stream/promises')
const { Readable } = require('node:stream')

function safeRelativePath(value) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value)) throw new Error('배포 파일 경로가 올바르지 않습니다.')
  const normalized = path.normalize(value)
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) throw new Error('배포 파일 경로에 상위 폴더를 사용할 수 없습니다.')
  return normalized
}

async function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fsSync.createReadStream(file)
    stream.on('error', reject)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function loadConfig(file) {
  const config = await readJson(file)
  if (!config.manifestUrl || !/^https?:\/\//.test(config.manifestUrl)) {
    throw new Error('launcher-config.json의 manifestUrl을 설정해야 합니다.')
  }
  return config
}

function getDataRoot(config, userData) {
  return path.join(path.dirname(userData), config.dataFolderName || 'CobblemonTestLauncher')
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`업데이트 목록을 받을 수 없습니다. (${response.status})`)
  return response.json()
}

async function getManifest(config) {
  const manifest = await fetchJson(config.manifestUrl)
  if (!manifest.version || !manifest.minecraftVersion || !manifest.neoForgeVersion || !Array.isArray(manifest.files)) {
    throw new Error('배포 manifest 형식이 올바르지 않습니다.')
  }
  for (const file of manifest.files) {
    safeRelativePath(file.path)
    if (!file.url || !file.sha256) throw new Error(`배포 파일 정보가 누락되었습니다: ${file.path}`)
  }
  return manifest
}

async function isCurrent(base, file) {
  const target = path.join(base, safeRelativePath(file.path))
  try { return (await sha256(target)).toLowerCase() === file.sha256.toLowerCase() } catch { return false }
}

async function checkRelease(config, dataRoot) {
  const manifest = await getManifest(config)
  const gameRoot = path.join(dataRoot, 'prism', 'instances', config.instanceId, '.minecraft')
  let changedFiles = 0
  for (const file of manifest.files) if (!await isCurrent(gameRoot, file)) changedFiles += 1
  return { manifest, gameRoot, changedFiles, updateAvailable: changedFiles > 0 }
}

async function download(url, destination) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`파일을 받을 수 없습니다. (${response.status}) ${url}`)
  await fs.mkdir(path.dirname(destination), { recursive: true })
  const temporary = `${destination}.part`
  await pipeline(Readable.fromWeb(response.body), fsSync.createWriteStream(temporary))
  await fs.rename(temporary, destination)
}

async function syncRelease(config, dataRoot, manifest, progress) {
  const gameRoot = path.join(dataRoot, 'prism', 'instances', config.instanceId, '.minecraft')
  const managedFile = path.join(dataRoot, 'managed-files.json')
  const currentPaths = new Set(manifest.files.map(file => safeRelativePath(file.path)))
  let previous = []
  try { previous = (await readJson(managedFile)).files || [] } catch { /* first install */ }

  for (const oldPath of previous) {
    const relative = safeRelativePath(oldPath)
    if (!currentPaths.has(relative)) await fs.rm(path.join(gameRoot, relative), { force: true })
  }

  let index = 0
  for (const file of manifest.files) {
    index += 1
    const target = path.join(gameRoot, safeRelativePath(file.path))
    if (!await isCurrent(gameRoot, file)) {
      progress(index, manifest.files.length, file.path)
      await download(new URL(file.url, config.manifestUrl).toString(), target)
      if ((await sha256(target)).toLowerCase() !== file.sha256.toLowerCase()) throw new Error(`해시 검증 실패: ${file.path}`)
    }
  }
  await fs.mkdir(dataRoot, { recursive: true })
  await fs.writeFile(managedFile, JSON.stringify({ version: manifest.version, files: [...currentPaths] }, null, 2))
  return manifest
}

module.exports = { loadConfig, getDataRoot, checkRelease, syncRelease }
