# 기능별 PR 구성과 검토 순서

## 제출된 PR

- [#6 디자인 자산·서체](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/6) — 기준: feat/results-archive
- [#7 메인 시트·메뉴·모션](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/7) — 기준: feat/design-assets-followup
- [#8 결과·보관함·MY 관리](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/8) — 기준: feat/home-interaction-followup
- [#9 대화·음성·인수인계](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/9) — 기준: feat/records-followup

2026-11-16 생성. 적용 순서는 기존 #1~#5 이후 #6 → #7 → #8 → #9다. 이번 작업에서는 머지하지 않았다. 제공 꾹꾹체 TTF 원본은 #6에 포함했다.


2026-11-16. 기존 제출분 이후 자산·메인·기록·대화 보완을 검토하기 위한 문서다. 네 개의 추가 PR로 전달하며 기존 PR과 main은 변경하지 않는다. 머지는 별도 진행한다.

## 기존 제출분과 기준

GitHub 읽기 조회에서 기존 PR [#1](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/1)~[#5](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/5)가 모두 open/미병합임을 확인했다. 로컬 HEAD와 원격 feat/results-archive는 221bbd5로 동일하다. main은 147fc32이며 기존 구현이 아직 합쳐지지 않았다.

기존 다섯 PR은 실행 기반 → 계정 → 메인/말랑이 → 대화 → 결과/보관함 순서다. 이번 추가분을 main 기준으로 올리면 기존 구현까지 다시 포함되므로, #5 위에 네 개를 순서대로 쌓는 방식으로 준비한다. 기존 PR 이력을 재작성하지 않는다. 업로드 직전에 원격 상태를 다시 확인하고 팀원이 병합했다면 실제 병합 결과를 기준으로 비교한다. squash 병합은 커밋 ID만으로 중복 여부를 판단하지 않는다.

## 추가 PR 구성

| 순서 | 제목 | 작업 브랜치 | 기준 브랜치 |
|---|---|---|---|
| 1 | feat: 디자인 원본 자산과 공통 서체 적용 | feat/design-assets-followup | feat/results-archive |
| 2 | feat: 메인 대화 시트와 메뉴·말랑이 모션 개선 | feat/home-interaction-followup | feat/design-assets-followup |
| 3 | feat: 마음 보관함 가리기와 추천 선택 흐름 개선 | feat/records-followup | feat/home-interaction-followup |
| 4 | fix: 대화 입력 반복과 종료·음성 복구 흐름 개선 | feat/dialogue-voice-followup | feat/records-followup |

1번은 제공 PNG/SVG·favicon·자산 경로·공통 Avatar/Malangi·서체/토큰이다. 2번은 우상단 4개 메뉴·하단 시트·말풍선/호흡/등장 모션·양 Canvas 연결이다. 3번은 partial/hidden 저장 계약·월간/주간/목록·MY 관리·숨기기/복원·전문 보기·추천 후보 선택 후 CTA다. 4번은 첫 질문 반복·입력 경로 통일·중간 보관·종료창·실시간 전사 UI/오류 복구·통합 QA와 최종 인수인계다.

기록 PR이 대화 PR보다 먼저다. 대화 중간 보관이 partial/nullable 추천 저장과 상세 표시를 필요로 한다. 3번만 적용하면 중간 기록을 받을 구조만 있고 대화에서 생성하는 버튼은 아직 없다. 추천/기록은 기존 Chat의 EmotionSummary를 재사용한다. 이 순서는 파일 의존성 기준이며 제품 사용 순서가 아니다.

공통 domain/contracts/api/store/handlers는 3번, chat/model과 mocks/dialogue는 4번에 둔다. 여러 화면을 통과하는 여정 검사는 마지막 PR에서 최종 동선으로 맞춘다. 중간 단계의 이전 브라우저 검사 전체가 최신 UI를 검증한다는 의미는 아니다.

## 커밋 구성

| PR | 커밋 |
|---|---|
| 1 | feat: 제공 디자인 자산과 공통 서체 연결 |
| 2 | feat: 메인 진입 시트와 말랑이·메뉴 모션 개선 |
| 3 | feat: 기록 가리기와 추천 선택·보관함 관리 구현 |
| 4 | fix: 대화 반복·중간 보관과 음성 전사 복구 개선 / docs: 구현 경계와 인수인계 갱신 |

실제 커밋 단계에서는 공유 import를 고려해 stage하고 빌드를 확인한다. 개발 날짜를 소급하거나 이력을 꾸미지 않는다.

## 포함·제외와 업로드 전 확인

- 제품 코드·검사·요구사항·연동 경계·팀 제공 자산 출처만 포함한다.
- 개인 대화 원문·일정·memory.md, PRD 이전 teslang/prototype, 백엔드 참고 체크아웃은 제외한다.
- 환경변수·인증정보·node_modules·dist·캐시·로그·스크린샷·추적 결과와 artifacts 준비 묶음은 제외한다.
- 노션 보관 원문은 이번 변경 대상이 아니다. 과거 커밋을 지우거나 문서를 재수집하지 않는다.
- 제공 꾹꾹체 TTF 원본도 이번 전달분에 포함한다. 서체 적용 영역과 fallback은 검증본 그대로 유지한다. 외부 라이선스 증빙 상태는 자산 기록을 따른다.
- 로그인 전체 흐름·수면은 확장하지 않았다. 이전 제출 이후 로그인 그림 교체와 공통 메뉴 스타일 변경은 포함되므로 “해당 파일에 diff가 전혀 없다”는 뜻이 아니다.

## 검증과 로컬 산출물

기능 검증은 [QA 기록](qa.md)의 D39를 따른다. 빌드·타입/단위 77개 통과, 통합 브라우저 135/136 이후 WebKit 초점 문제 수정과 관련 20/20 재검사다. 전체 136개를 수정 후 다시 실행했다고 쓰지 않는다. 실제 음성 서비스 network 실패는 미해결이다.

로컬 artifacts/pr-followup-2026-11-16에 네 PR 제목·본문, 파일별 배정/해시·기준 SHA·누락/중복 점검, 누적 단계 빌드/단위 결과를 준비한다. 이 폴더는 Git 제외다. 단계별 결과와 최종 통합 결과를 구분해 PR 본문에 표시한다. 원격 기준·실제 커밋 diff·사적 파일 제외·서체 포함 정책은 업로드 직전 다시 점검한다.

팀 전달 요약은 [delivery-2026-11-16.md](delivery-2026-11-16.md), 연결 위치는 [handoff.md](handoff.md)를 따른다.

## 분리 적용 검증 결과

| PR | 배정 파일 수 | 타입·빌드 | 단위 검사 |
|---|---|---|---|
| 1 | 21 | 통과 | 53개 통과 |
| 2 | 12 | 통과 | 53개 통과 |
| 3 | 18 | 통과 | 65개 통과 |
| 4 | 33 | 통과 | 77개 통과 |

네 개의 별도 누적 복사본에서 각각 검증했다. 꾹꾹체는 로컬 파일을 포함한 결과이므로 공개 업로드 허가를 증명하지 않는다. 최초 외장 드라이브 복사본은 의존성 junction을 지원하지 않아 환경 구성에 실패했다. 프로젝트 아래 Git 제외 복사본으로 옮겨 설치 의존성을 참조한 뒤 통과했다. 제품 코드를 바꿔 통과시킨 것은 아니다.

위 표는 PR 묶음 단위 검증 결과다. 실제 커밋의 코드·자산이 해당 검증 복사본과 일치하는지 제출 전에 비교한다.
