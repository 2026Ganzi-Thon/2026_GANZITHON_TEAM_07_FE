# 프론트엔드 QA 기록

2026-11-16 · 기능별 PR 검토 준비. 실제 서버 대신 MSW 예시 데이터로 검증한다.

## 이번 검사

- TypeScript 검사 통과.
- Vitest 단위 테스트 53개 통과(6개 파일).
- Vite 프로덕션 빌드 통과.
- Playwright 전체 **110/110 통과**, Chromium 55·WebKit 55, 프로덕션 preview(5183), 1 worker, 9.3분, 종료 코드 0. 재시도 실행 없이 한 번의 전체 실행에서 통과했다.
- 기능별 분리 복사본 5개 각각 타입 검사·빌드 통과. 1·2단계는 단위 40개, 3·4·5단계는 단위 53개 통과. 중간 단계의 전체 여정 검증은 아니며 최종 통합 상태에서 위 110개를 실행했다.
- 결과·보관함 390px 캡처를 직접 확인했다. 자동 검사는 360/390/430px·가로·데스크톱을 포함한다.
- 업로드 후보의 로컬 Markdown 링크 누락과 음원 manifest 해시 불일치 없음. 주요 비밀키·개인 경로·사적 대화 패턴 검사와 문서 검토에서 추가 노출 항목을 발견하지 못했다. 이 검사는 외부 보안 감사가 아니다.

## 재현

```sh
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

기본 검사는 개발 서버 5173을 사용한다. 빌드 결과를 확인하려면 빌드 후 `QA_SERVER_MODE=preview` 환경변수로 실행한다. 이 경우 별도 5183 포트의 Vite preview를 사용하므로 기존 개발 서버와 섞이지 않는다.

```powershell
$env:QA_SERVER_MODE = 'preview'
npm run test:e2e
```

별도 디스크에 브라우저를 설치했다면 `scripts/qa.ps1 -RuntimeRoot <로컬 도구 폴더>`를 사용한다. 이 폴더 아래 playwright에 현재 패키지 버전의 브라우저가 있어야 한다. 특정 드라이브는 프로젝트 필수 조건이 아니다.

1 worker로 실행하며 Windows WebKit의 전체 여정 제한은 90초, Chromium은 기본 30초다. 파일별 긴 시나리오는 명시적인 제한을 사용한다. assertion 제한은 8초로 유지한다. 시간 예산은 테스트 실행 환경을 위한 설정이며 제품 성능 기준이 아니다.

## 검증 범위와 한계

메인/시트/대화 진입, 한글 입력·중복 전송, 감정·점수·종료, 저장·조회·삭제 오류 복구, 계정별 예시 기록, 세 종류 개방·선택·추천 보존, 포인터·키보드·모양·오디오, 잘못된 응답 방어, 모바일·가로·데스크톱 화면을 검사한다.

실제 AI·로그인·API·DB·운영 위기 탐지·실제 휴대폰·공개 배포는 미검증이다. Windows Playwright WebKit에는 Web Audio가 없어 미지원 안내 경로만 검증한다. 실제 음원 디코딩은 Chromium 범위다. 전체 Figma 픽셀 일치 검증도 완료되지 않았다.

테스트 결과·추적·스크린샷은 test-results/artifacts 또는 지정한 로컬 경로에 저장하며 Git에 포함하지 않는다. 기존 세부 작업 일지는 로컬 전용으로 유지한다.
