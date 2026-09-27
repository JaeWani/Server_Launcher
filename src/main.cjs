const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { loadConfig, getDataRoot, checkRelease, syncRelease } = require('./core/release.cjs')
const { ensurePrism, ensureInstance, launchInstance } = require('./core/prism.cjs')

let windowRef

function sendStatus(message, detail = '') {
  windowRef?.webContents.send('launcher:status', { message, detail })
}

function configPath() {
  // electron-builder stores regular application files inside app.asar in a
  // packaged build. app.getAppPath() resolves that archive in production and
  // the project root in development, so it works in both cases.
  return path.join(app.getAppPath(), 'launcher-config.json')
}

async function getContext() {
  const config = await loadConfig(configPath())
  const dataRoot = getDataRoot(config, app.getPath('userData'))
  return { config, dataRoot }
}

async function performUpdate({ launch }) {
  const { config, dataRoot } = await getContext()
  const check = await checkRelease(config, dataRoot)
  sendStatus('모드팩 동기화 중', check.updateAvailable ? `${check.changedFiles}개 파일 적용` : '파일 검증 중')
  const manifest = await syncRelease(config, dataRoot, check.manifest, (current, total, file) => {
    sendStatus('모드팩 동기화 중', `${current}/${total}  ${file}`)
  })

  if (!launch) return { manifest, dataRoot, message: '최신 모드팩이 적용되었습니다.' }

  sendStatus('Prism 환경 확인 중')
  const prism = await ensurePrism(config, dataRoot, sendStatus)
  sendStatus('NeoForge 프로필 준비 중')
  await ensureInstance(prism.root, config, manifest)
  sendStatus('게임 실행 중')
  await launchInstance(prism.executable, prism.root, config, manifest)
  return { manifest, dataRoot, message: '게임을 시작했습니다.' }
}

async function createWindow() {
  windowRef = new BrowserWindow({
    width: 520,
    height: 420,
    resizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true }
  })
  await windowRef.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(async () => {
  await createWindow()

  ipcMain.handle('launcher:check', async () => {
    const { config, dataRoot } = await getContext()
    const result = await checkRelease(config, dataRoot)
    return {
      version: result.manifest.version,
      updateAvailable: result.updateAvailable,
      changedFiles: result.changedFiles,
      serverAddress: result.manifest.serverAddress || config.serverAddress || ''
    }
  })

  ipcMain.handle('launcher:update', async () => performUpdate({ launch: false }))
  ipcMain.handle('launcher:play', async () => performUpdate({ launch: true }))
  ipcMain.handle('launcher:open-data', async () => {
    const { dataRoot } = await getContext()
    await fs.mkdir(dataRoot, { recursive: true })
    return require('electron').shell.openPath(dataRoot)
  })

  ipcMain.handle('launcher:show-error', (_, message) => dialog.showErrorBox('실행 오류', message))
})

app.on('window-all-closed', () => app.quit())
