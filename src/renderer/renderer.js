const version = document.querySelector('#version')
const statusTitle = document.querySelector('#status-title')
const statusDetail = document.querySelector('#status-detail')
const update = document.querySelector('#update')
const play = document.querySelector('#play')
const folder = document.querySelector('#folder')

function setBusy(busy) {
  update.disabled = busy
  play.disabled = busy
  folder.disabled = busy
}

async function refresh() {
  try {
    const info = await window.launcher.check()
    version.textContent = info.updateAvailable
      ? `새 모드팩 ${info.version} — ${info.changedFiles}개 파일 업데이트 필요`
      : `모드팩 ${info.version} — 최신 상태`
    statusTitle.textContent = info.updateAvailable ? '업데이트 가능' : '플레이할 준비가 되었습니다'
    statusDetail.textContent = info.serverAddress ? `접속 서버: ${info.serverAddress}` : '서버 주소는 배포 설정에서 지정합니다.'
  } catch (error) {
    version.textContent = '업데이트 정보를 가져오지 못했습니다.'
    statusTitle.textContent = '설정 확인 필요'
    statusDetail.textContent = error.message
  }
}

async function run(action) {
  setBusy(true)
  try {
    const result = await action()
    statusTitle.textContent = '완료'
    statusDetail.textContent = result.message
    await refresh()
  } catch (error) {
    statusTitle.textContent = '오류 발생'
    statusDetail.textContent = error.message
    await window.launcher.showError(error.stack || error.message)
  } finally {
    setBusy(false)
  }
}

window.launcher.onStatus(({ message, detail }) => {
  statusTitle.textContent = message
  statusDetail.textContent = detail
})
update.addEventListener('click', () => run(window.launcher.update))
play.addEventListener('click', () => run(window.launcher.play))
folder.addEventListener('click', () => window.launcher.openData())
refresh()
