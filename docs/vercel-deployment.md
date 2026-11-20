# Vercel 배포 준비 — 2026-11-20

현재는 로컬 준비 단계다. Vercel 프로젝트·GitHub 자동 배포 연결·원격 배포는 아직 없다. 기존 UI/음성/기록 수정은 보존했고 백엔드는 변경하지 않았다.

## 저장소 설정

- Node: `package.json`과 잠금 파일의 루트 `engines.node`를 `24.x`로 고정했다. `.nvmrc`도 24다. 로컬 검증 버전은 v24.15.0이다. 의존성 버전은 바꾸지 않았다.
- 빌드: Vite / `npm ci` / `npm run build` / 출력 `dist`. `vercel.json`에 지정했다.
- `/api` 및 `/api/...`: Railway의 같은 경로로 프록시한다. 요청의 Origin만 제거하고 Authorization·메서드·본문·쿼리는 유지한다. 기존 Vite 로컬 프록시와 같은 계약이다.
- API 응답: 브라우저/CDN 저장 금지와 외부 rewrite 캐시 비활성화. API 오류는 SPA HTML로 바꾸지 않는다.
- 실제 정적 파일을 먼저 제공한다. 이미지·음원·폰트·`mockServiceWorker.js`가 HTML로 대체되지 않으며, assets/fonts의 없는 파일은 404로 끝낸다.
- 그 외 GET/HEAD 경로는 `index.html`로 연결한다. `/login`, `/chat`, `/archive`, `/records/:id` 등의 직접 접속·새로고침 뒤 React Router와 기존 인증 가드가 처리한다. POST를 SPA로 보내지 않는다.
- `.vercel/`은 Git에서 제외한다.

Origin 변환과 API → 정적 파일 → SPA 순서를 한 곳에서 명시하기 위해 `routes`를 사용했다. `handle: filesystem`은 현재 공식 스키마에 남아 있는 deprecated 속성이다. 향후 상위 `rewrites`로 전환할 때 Origin 제거·API 우선순위·정적 파일 처리를 함께 검증해야 한다.

## 프로젝트를 만들 때

1. 이 프론트엔드 GitHub 저장소를 Import하고 저장소 루트를 Root Directory로 선택한다.
2. Production Branch는 `main`, Node는 24.x로 확인한다. 아직 로컬에만 있는 변경은 먼저 검토·반영해야 배포 코드에 포함된다.
3. `VITE_API_MODE=real`(기본값이므로 생략 가능). `VITE_API_BASE_URL`은 **비우거나 생략**한다. Railway URL을 넣으면 프록시를 우회해 CORS 오류가 다시 발생한다.
4. `VITE_API_PROXY_TARGET`은 Vite 로컬 dev/preview 전용이며 Vercel 목적지는 `vercel.json`에서 관리한다. 백엔드 토큰·Claude 키 등 비밀값을 `VITE_*`에 넣지 않는다.
5. Git 연결 후 main 변경은 Production 자동 배포 대상이다. 이번 작업에서는 연결/커밋/PR/배포를 하지 않았다.

## 검증과 남은 확인

- TypeScript/Vite real 빌드, 단위 테스트 158개/19파일 통과. 별도 복사본에서 변경한 잠금 파일로 Node 24 `npm ci`(102패키지) → `npm run build`도 통과. 기존 CSS/JS 번들 해시 일치, 앱 의존성 버전 변경 없음.
- Vercel 공식 JSON 스키마와 공식 `@vercel/routing-utils`의 route 정규화 검증. 공개 스키마가 draft-04 선언과 최신 키워드를 혼용해 검증 도구에서는 선언만 제외하고 현대 Ajv로 확인했다. 앱 설정을 완화하거나 검증 항목을 제거하지 않았다.
- 빌드 산출물 + 설정 파일을 읽는 **로컬 라우팅 검증 서버**에서 32항목 통과: 주요 직접 경로 11개, JS/CSS/서비스워커/이미지/폰트/음원, 없는 정적 파일, GET/POST/PATCH/DELETE/OPTIONS의 메서드·본문·쿼리·Authorization 보존, Origin 제거, 캐시 금지, API 404 JSON, bare `/api`, HEAD.
- 운영 백엔드는 인증정보 없는 읽기 요청만 사용했다. 프록시를 통한 `/api/v1/auth/me`는 401 JSON이었다. 실계정 생성·상담·기록 변경은 하지 않았다.
- Chromium/WebKit 인증 회귀 8/8 통과. 가입·새로고침 유지·토큰 갱신/만료·스플래시·뒤로가기·Origin 제거를 확인했다. 가짜 계약 서버와 실제 빌드 프론트를 사용하며 Vercel 클라우드 실행 결과와 구분한다.
- 로컬 QA 도구는 Git 제외 `artifacts/vercel-{local-server,http-qa,routing.config}.cjs`에 있다. 검증용 패키지는 별도 tooling 디렉터리에 설치했고 앱 의존성에는 추가하지 않았다.

첫 배포 후 실제 HTTPS 주소에서 API 응답/캐시 헤더, 로그인 유지·새로고침·뒤로가기, 상담 완료·기록 조회, 모바일 Safari/갤럭시의 마이크 권한·음원 재생을 확인해야 한다. 로컬 검증만으로 실제 Vercel 프록시나 모바일 음성 성공을 확정하지 않는다.

## 공식 근거

- [Vercel 정적 설정·route transforms](https://vercel.com/docs/project-configuration/vercel-json)
- [외부 rewrite와 캐시 비활성화](https://vercel.com/docs/routing/rewrites)
- [Vite SPA 직접 경로](https://vercel.com/docs/frameworks/frontend/vite)
- [Node 버전 지정](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [GitHub 자동 배포](https://vercel.com/docs/git/vercel-for-github)
