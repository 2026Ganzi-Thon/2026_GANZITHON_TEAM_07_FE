# 기능별 PR 검토안

2026-11-16 · 기능별 PR 분리와 검토 순서. 개인 대화와 개인 작업 일지는 업로드에서 제외한다. 이 문서는 각 PR의 범위와 통합 의존 관계를 설명한다.

## 분리와 기준 브랜치

| 순서 | PR 제목 | 작업 브랜치 | 기준 브랜치 | 핵심 파일 |
|---|---|---|---|---|
| 1 | chore: 프론트엔드 실행 기반과 공통 UI·예시 API 구성 | `feat/frontend-foundation` | `main` | 실행 설정, 공통 components/styles, lib, mocks, chat/model |
| 2 | feat: 체험 계정 진입과 MY·도움 화면 구현 | `feat/account-settings` | `feat/frontend-foundation` | features/account |
| 3 | feat: 메인 대화 시트와 말랑이 조작·효과음 구현 | `feat/home-toy` | `feat/account-settings` | features/home, features/toy, audio 자산 |
| 4 | feat: 감정 선택과 단계별 텍스트 대화 화면 구현 | `feat/chat-flow` | `feat/home-toy` | features/chat의 Chat·InputCards·스타일 |
| 5 | feat: 상담 결과와 마음 보관함·기록 관리 구현 | `feat/results-archive` | `feat/chat-flow` | features/records, 통합 tests, 최신 문서 |

모든 PR에서 `App.tsx`에는 해당 단계까지 존재하는 경로만 연결한다. 임시 실행 셸은 메인 PR에서 교체한다. 메인→대화는 4번, 대화→결과·보관함은 5번까지 적용해야 이어진다. 각 PR은 독립 제품이 아니라 순서대로 누적하는 변경이다. 모든 PR을 main 기준으로 만들면 이전 기능이 중복 표시되므로 앞 브랜치를 기준으로 올린다.

## 커밋과 문서

각 PR의 제목과 같은 범위로 커밋한다. 공통 기반에는 대화 모델·mock fixture가 포함되지만 대화 UI는 4번 PR이다. 결과/보관함은 같은 파일과 데이터 흐름을 공유하므로 5번에 함께 둔다. 5번은 결과·보관함, 전체 여정 검사, 문서 인수인계 커밋으로 구분한다. 실제 개발 날짜를 소급하거나 개발 이력을 꾸미지 않는다.

PR 본문에는 변경 동작, 기준 브랜치, 검증 범위, 미연동 기능을 기재한다. 팀원이 바로 작업할 수 있도록 [인수인계](handoff.md)에 실행 방법·코드 규칙·API 교체 위치·남은 화면을 정리했다.

## 업로드 제외

- 개인 대화 원문, 개인 일정, `memory.md`
- PRD 작성 전 실험 폴더 `teslang/`, `prototype/` 및 백엔드 참고 체크아웃
- `.env`, 자격증명, node_modules, dist, 캐시·로그·스크린샷·추적 파일
- 검토용 로컬 복사본과 PR 준비 산출물인 `artifacts/`

기존 Git에 올라간 디자인 전달 원문은 제품 동작 요약으로 수정한다. 과거 커밋은 이 작업에서 삭제하거나 재작성하지 않는다. 노션 보관 원문은 기존 추적 자료이며 이번에 재수집하거나 수정하지 않는다.

## 검증 상태

다섯 단계 각각 별도 로컬 복사본에서 빌드와 단위 검사를 통과했다. 1·2단계 단위 40개, 3·4·5단계 53개다. 최종 통합 브라우저 결과와 한계는 [QA 기록](qa.md)을 따른다. 중간 단계에서 전체 대화→결과 여정까지 검증했다고 의미하지 않는다.

다섯 PR의 업로드 승인을 받은 범위로 진행한다. main에 직접 푸시하거나 머지하지 않는다.
