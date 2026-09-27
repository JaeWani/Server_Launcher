# Cobblemon Test Launcher (Beta)

테스트 서버 유저가 NeoForge 1.21.1 환경과 클라이언트 모드팩을 설치·업데이트한 뒤 자동 접속하도록 돕는 Windows용 베타 런처입니다.

## 현재 범위

- `../mods`의 **클라이언트 모드 14개만** 배포합니다.
- `test-server/mods`에만 있는 `timcore`, `spawnnotification`은 서버 전용이므로 배포하지 않습니다.
- Minecraft `1.21.1`, NeoForge `21.1.250`으로 고정돼 있습니다.
- 모든 파일은 SHA-256 검증 뒤에만 적용합니다.

## 최초 설정

1. `launcher-config.example.json`을 `launcher-config.json`에 반영합니다.
2. `manifestUrl`에 공개 저장소의 `release/manifest.json` 주소를 넣습니다.
3. `prismDownloadUrl`에 공식 Prism Launcher Windows portable ZIP URL을 넣습니다.
4. `serverAddress`에 테스트 서버의 `호스트:포트`를 넣습니다.

`launcher-config.json`은 앱에 포함되므로, 배포 전에 실제 주소로 교체해야 합니다.

## 모드팩 릴리스 만들기

```powershell
node scripts/build-release.mjs --version 0.1.0 --asset-base-url https://github.com/OWNER/REPOSITORY/releases/download/modpack-0.1.0 --server example.org:25565
```

명령은 루트의 `mods`만 읽고 `release/files/mods`와 `release/manifest.json`을 생성합니다. `release/manifest.json`만 공개 GitHub 저장소에 커밋·푸시하고, `release/files/mods`의 JAR들은 `modpack-버전` GitHub Release 자산으로 업로드합니다. 큰 Cobblemon JAR은 Git 커밋 한도를 넘기므로 일반 커밋에 넣지 않습니다.

## 개발·Windows 설치 파일 빌드

```powershell
npm.cmd install
npm.cmd start
npm.cmd run dist:win
```

빌드 전에는 `launcher-config.json`을 실제 배포 주소로 설정하세요.
