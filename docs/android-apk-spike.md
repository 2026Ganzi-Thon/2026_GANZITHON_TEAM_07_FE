# Android APK 빌드 실험

## 소스 보관 범위

사용자 승인에 따라 `spike/android-apk` 브랜치만 원격에 보관한다. main 병합·PR 생성·웹 재배포는 하지 않는다. 설치 파일 APK/AAB, 서명키, 환경변수, local.properties, 빌드 캐시와 QA 산출물은 업로드하지 않는다. 소스·앱 이름/아이콘·Gradle Wrapper·재빌드 스크립트를 포함한다. 아래 로컬 작업/원격 미변경 설명은 각 빌드 당시의 기록이다.

APK에 포함된 웹 수정은 별도로 PR #17에서 웹 main에 반영됐다. 이 브랜치는 `56c9396` 기반의 독립 APK 실험이며 웹 main으로 병합하기 위한 브랜치가 아니다.

## 1.0.1 후속 구성

**최신 전달 파일:** `artifacts/테슬랑.apk` — 45,839,830 bytes (약 43.72 MiB). SHA256 `2ec83a42c942518e2f62165e4b9d19891af2c7ce622e5d0e63d3fe40b492b2d6`.

`:app:assembleDebug` 성공. APK v2 서명 검증, 기존 APK와 서명 인증서 SHA256 일치, aapt 앱 이름 `테슬랑`/버전 `1.0.1` 확인. 포함 웹 자산 87개와 staging dist 일치, 아이콘 PNG 15개를 소스 이미지와 픽셀 비교 통과. ZIP 무결성과 진단 로그 비활성화 확인. 실제 기기 설치/업데이트/로그인 검증은 아직 하지 않았다.

- 앱 표시 이름을 `테슬랑`으로 변경하고 사용자 제공 「소크라테스와 포근한 양의 꿈결 포옹 로고.png」를 런처 아이콘으로 적용했다. 원본은 `android/branding/icon.png`, 재생성은 `python scripts/prepare_android_icon.py` (Pillow 필요). PNG 15개는 빌드에 포함되므로 일반 APK 빌드에 Python은 필요 없다.
- 구형 런처 및 원형 아이콘, adaptive foreground 5개 밀도를 준비했다. adaptive 배경은 `#FFF9F5`, 108dp 레이어 중앙에 로고를 64dp로 배치해 얼굴 주변 여백을 둔다. 원형/둥근 사각형 마스크 미리보기로 확인했다.
- 버전은 `1.0.1` / versionCode `2`. 앱 식별자는 `com.teslang.preview` 그대로 유지한다. 앱 이름은 바뀌지만 설치 테스트용 debug 빌드라는 구분은 유지한다.
- 감정 아이콘 공통 연결/선택 UI, 하트 상단 조각 분할과 파편 종료 시점, 구름 외부 껍질 색 조정(내부 원복)을 함께 포함한다.
- 기존 E 드라이브 생성 폴더에 ENOTEMPTY/EPERM 접근 오류가 있어 재사용을 중단했다. 생성 폴더 정리 명령은 자동 승인에서 차단됐고, 백업 이동도 일부 경로 접근 거부로 끝났다. 원본 소스는 보존했다. 이후 새 로컬 빌드 폴더 `E:/Ganzithon/tooling/android-apk-20261120/release-1.0.1`에 소스·정적 자산·Android 설정을 복사하고 npm ci/동일 빌드 스크립트를 실행했다. 새 폴더에서 Capacitor sync 성공, 핵심 소스 해시 일치 확인. 기존 `.gradle`/build/node_modules 및 생성 웹 복사본은 복사하지 않았다.
- main/운영 배포는 변경하지 않는다. 이 문서 아래의 1.0 빌드 결과는 이전 산출물 이력이다.

## 분리 범위

- 브랜치: `spike/android-apk`
- 시작 커밋: `56c9396` (README 반영 후 main)
- 작업 폴더: `E:/Ganzithon/teslang-android-apk`
- 빌드 캐시: `E:/Ganzithon/tooling/android-apk-20261120`
- 기존 main 작업 폴더의 미커밋 문서, main 브랜치, 원격, Vercel 배포는 변경하지 않는다.
- Android Studio·에뮬레이터 없이 기존 SDK/JDK와 Gradle Wrapper로 설치용 debug APK를 만든다. Play Store 배포용 서명/등록은 이번 범위가 아니다.

## 구성

- Capacitor core/android/CLI `8.6.2`, Node `24.15.0`, JDK `21.0.10`, 기존 Android SDK Platform 36.
- 앱 식별자 `com.teslang.preview`, 표시 이름 `테슬랑`. 웹 이미지·음원을 APK에 포함한다.
- Android 전용 Vite 모드만 API 주소를 `https://teslang-xi.vercel.app`으로 지정한다. 일반 `npm run build`의 동일 출처 API 설정은 유지한다.
- CapacitorHttp로 외부 API 요청을 native HTTP 경로로 전달한다. 기존 Vercel `/api` 프록시를 이용하며 백엔드 CORS/서버/운영 설정은 변경하지 않는다.
- 로컬 WebView 자산·`/__preview__` 기능은 웹 경로를 유지한다. 설치된 Capacitor의 동일 출처 fetch 우회 및 ServiceWorkerClient 연결 코드를 확인했다. 기기 동작 확인과는 구분한다.
- 플랫폼 권한은 INTERNET만 포함하며 AndroidX가 앱 내부 수신기용 signature 권한을 추가한다. 자동 백업·평문 HTTP·혼합 콘텐츠를 끈다. 별도 native 음성 플러그인은 추가하지 않았다.
- native 플러그인의 요청 진단 로그는 `loggingBehavior: none`으로 꺼서 로그인 본문/인증 헤더가 출력되지 않도록 한다.
- Gradle Wrapper는 문서/소스가 없는 `8.14.3-bin` 배포본과 공식 SHA256을 지정한다. 초기 템플릿의 `all` 배포본은 준비 중 문서 압축 해제 시간이 길어 실행 전용으로 조정했다.
- Gradle는 worker 1개, 비병렬, heap 상한 1536MB, 지속 daemon 비활성화다. JVM 설정 적용을 위한 일회성 프로세스는 생길 수 있다. SDK 자동 다운로드는 비활성화한다.
- APK/keystore/캐시/생성된 웹 복사본/local.properties는 Git에서 제외한다.

## 재빌드 (Windows PowerShell)

별도 작업 폴더에서 `npm ci` 후 실행한다. JDK·SDK 경로는 자신의 PC에 맞춘다.

```powershell
./scripts/build-android.ps1 `
  -JdkRoot 'C:/Program Files/Java/jdk-21.0.10' `
  -SdkRoot 'C:/Users/chose/AppData/Local/Android/Sdk' `
  -CacheRoot 'E:/Ganzithon/tooling/android-apk-20261120'
```

스크립트는 타입 검사/웹 빌드 → Capacitor sync → Gradle assembleDebug → 파일/SHA256 확인 순서로 동작한다. 지정한 프로세스 환경변수는 종료 시 복구한다. 처음에는 npm·Gradle·Maven 의존성 다운로드를 위한 인터넷 연결이 필요하다.

출력: `android/app/build/outputs/apk/debug/app-debug.apk`

## 빌드 결과 — 2026-11-20

- 최종 `:app:assembleDebug` 성공. APK 45,476,061 bytes (43.37 MiB), 앱 이름 `테슬랑 테스트`, Android API 24 이상, target API 36.
- `apksigner verify --verbose` 통과: debug 서명, APK Signature Scheme v2. 스토어 출시용 서명이 아니다.
- SHA256: `c936387156f87a7f0c282bfff08353d106e46e32e79958bcc6762a2697b2dc71`.
- ZIP 무결성, 포함 웹 자산 87개와 dist 원본 일치, 로컬 UI 포함, API 주소, native 로그 비활성화 확인. 환경변수 파일·keystore·QA 계정 파일 미포함 확인.
- TypeScript/Vite Android 빌드 및 단위 테스트 158개/19파일 통과. Android Studio·에뮬레이터·실기기 실행은 하지 않았다.
- 전달용 복사본: `artifacts/teslang-test.apk` (Git 제외). 원본 APK와 SHA256 동일.
- main과 origin/main은 `56c9396` 그대로이며 기존 main의 미커밋 문서도 보존했다. 커밋·푸시·PR·배포 미실행.

## 검증 구분

APK 생성·서명·패키지 내용 검사와 휴대폰 실행 검사는 다르다. 이 실험에서는 에뮬레이터를 사용하지 않는다. 실제 기기에 설치하기 전에는 다음을 완료로 표시하지 않는다.

- 로그인/갱신/로그아웃, 대화 완료와 기록 재조회
- 말랑이 WebGL 성능·소리, 수면 중단/복귀
- 상태바/키보드/뒤로가기, 앱 종료 후 세션 처리
- 음성 전사. WebView에서는 Chrome과 지원이 다를 수 있으므로 우선 텍스트 입력으로 확인한다.
- native HTTP의 취소/타임아웃. 웹의 AbortSignal과 같은 동작인지 별도 확인하며 불명확한 POST를 자동 반복하지 않는다.

## 작업 되돌리기

main에 병합하지 않은 독립 실험이다. 불필요해지면 필요한 APK/문서를 따로 보관한 뒤 이 worktree와 브랜치를 제거할 수 있다. SDK/JDK 원본은 이 실험이 만든 파일이 아니므로 삭제하지 않는다. 작업용 캐시만 별도로 정리한다.

E 드라이브 소유권을 기록하지 않는 파일시스템 때문에 기존 Git 2.37.3이 worktree를 경고하는 환경이다. 이번 작업에서는 전역 Git 설정을 변경하지 않고, 필요 시 명시적인 worktree git-dir/work-tree로 조회했다.
