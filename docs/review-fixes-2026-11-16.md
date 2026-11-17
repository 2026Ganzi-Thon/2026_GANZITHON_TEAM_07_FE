# PR 리뷰 수정 내역 — D40

2026-11-16 기준 PR #1~#9에서 확인한 리뷰 중 서체를 제외한11개 인라인 코멘트를8개 항목으로 묶어 수정했다. 기존 PR #7(메인·말랑이), #8(결과·보관함·설정), #9(대화·통합 QA·문서)에 나누어 반영한다. 원래 리뷰 #2~#5에는 해당 후속 PR을 연결한다. PR 머지는 하지 않는다.

## 리뷰와 수정 연결

| 원문 리뷰 | 문제 | 수정 내용 | 주요 위치 |
|---|---|---|---|
| [#2 도움 복귀](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/2#discussion_r4581830916) | 설정에서 도움으로 간 뒤 상단 뒤로가기가 메인으로 이동 | 설정 진입 상태를 전달한다. 설정 메뉴/이용 안내에서 진입하면 설정으로 복귀하고 직접/안전 안내 진입이면 메인으로 이동 | `Account.tsx` Settings/Help |
| [#2 전화 URI](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/2#discussion_r4581842663) | 국내 단축번호에 국가코드·추적 쿼리 포함 | `tel:109`로 변경하고 공식 안내 링크도 추적 쿼리 제거 | `Account.tsx` Help |
| [#3 왁뿌볼 배경](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/3#discussion_r4581883031) | 캔버스 여백도 조작 대상으로 처리 | 렌더러와 같은 곡선 윤곽으로 시작점을 검사. 배경·그림자·하트의 오목한 여백에서는 파손·포인터 소유·소리 시작 안 함 | `physics.ts`, `useToyInteraction.ts` |
| [#3 효과음 위치](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/3#discussion_r4581889622), [#7 동일 지적](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/7#discussion_r4582207087) | 메인 상단과 별도 화면 하단으로 위치가 다름 | 공유 상단 컨테이너로 이동. 메인의 종료 버튼 자리까지 고려해 효과음 X/Y를 일치시킴 | `Home.tsx`, `Toy.tsx`, 두 CSS Modules |
| [#3 대화 진입](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/3#discussion_r4581895805), [#7 동일 지적](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/7#discussion_r4582198028) | 메인은 첫 입력 시트, 별도 말랑이는 바로 빈 대화로 이동 | 공통 `ChatEntrySheet`와 `useChatEntry`로 시트·초안 유지·첫 메시지 전달 통일 | `features/chat/ChatEntrySheet.tsx`/CSS |
| [#4 실패 후 결과](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/4#discussion_r4582090438), [#9 동일 지적](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/9#discussion_r4582220779) | 응답 실패 상태에서도 정상 완료로 진행 가능 | 정상 완료 버튼과 핸들러에서 실패/진행 상태 차단. 중간 보관은 유지하고 재시도 성공 후 정상 완료 허용 | `Chat.tsx` |
| [#5 기록 개수](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/5#discussion_r4582096118) | 최초 조회 전에 실제 기록을0개로 표시 | 초기 로딩·초기 오류·성공 빈 목록 구분. 캐시가 있으면 재조회 중 기존 개수 유지 | `Archive.tsx` |
| [#9 짧은 단어 입력](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/9#discussion_r4582247855) | 연속 두 글자를 요구해 ‘날 좀 봐 줘’ 거부 | 공통 `hasStoryText`로 한글 음절/영문 글자 포함 여부만 검사. 입력 UI와 mock에 같은 기준 적용 | `model.ts`, `Chat.tsx`, `mocks/dialogue.ts` |

## 중간 보관과 정상 완료

| 구분 | 중간 보관 | 정상 완료 |
|---|---|---|
| 답변 실패 중 | 전송한 사용자 메시지가 있으면 가능 | 차단. 재시도 성공 후 가능 |
| 요청 진행 중 | 요청이 끝날 때까지 차단 | 요청이 끝날 때까지 차단 |
| 기록 상태 | `partial: true`, 보관 당시 단계 유지 | `partial: false`, `stage: DONE` |
| 담는 정보 | 전송 메시지·이미 확정한 감정/점수/슬롯 | 기존 정상 정리 흐름의 결과 |
| 없는 정보 | 감정/점수/슬롯을 채우지 않음, 추천null | 사후 점수 건너뛰기는null 유지 |
| 마지막 응답 실패 메시지 | 사용자 원문은 저장. 미수신 답변/슬롯 생성 안 함 | 동일 메시지 재시도 성공 후 완료 가능 |
| 화면 | 마음 보관함의 ‘중간 보관’ 표시, 상세 ‘중간에 보관한 이야기’ | 정리·말랑이 추천 화면 |

작성 중 글·미확정 음성 전사는 중간 기록에 넣지 않는다. 기존 저장 실패 재시도, 같은 ID 중복 방지, 가린 기록/집계 정책을 유지한다. 저장 방식은 현재 탭 메모리의 프론트 예시 계약이며 실제 서버 지원을 뜻하지 않는다.

## 검증

- `tests/review-fixes.spec.ts`: 도움의 두 설정 진입 경로/직접 진입, 전화 URI, 메인·말랑이·직접 입력, 실패 후 보관/정상 완료 차단, 재시도 성공, 조회 지연/실패/빈 목록/기존 기록, 세 왁뿌볼 모양의 배경·하트 오목 영역, 효과음 정렬, 좁은 화면과 가로 시트를 검증한다.
- `model.test.ts`: 공백으로 나뉜 단음절·한 글자 답변·영문 및 자음/숫자/기호의 입력 경계를 검사한다.
- `physics.test.ts`: 세 모양의 외부 터치에서 파손·횟수·포인터가 바뀌지 않고 내부 터치에서만 반응하는지 검사한다.
- 실행 결과와 환경 오류/재검사 내역은 [QA D40](qa.md)에 기록한다. 직접 사이드패널 조작과 자동화·실기기 검증을 구분한다.

## 남은 범위

- [#6 서체 사용 조건](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/6#discussion_r4582174832)은 공식 안내에서 웹 임베딩·파일 재배포 제한을 확인했다. 서체 파일과 적용은 현재 유지하되 기획·디자인과 대체 서체를 논의하여 최종 배포 전 교체하고 저장소 파일 및 기존 이력 정리 범위를 협의한다. 외부 사용 허락을 확보한 상태는 아니다.
- 로그인·수면 기능은 현재 상태 유지. 실제 AI·인증·DB·STT 연동을 추가하지 않았다.
- 단축번호는 URI 형식만 검증했다. 실제 발신/통화 연결은 테스트하지 않았다.
- #7 → #8 → #9 의존 관계를 유지한다. 각 단계의 빌드·단위 검사와 마지막 단계의 브라우저 통합 검증을 구분한다. 리뷰 답글은 수정 설명이며 스레드를 자동 해결 처리하지 않는다.
