# API 점검과 대화·기록·체험 후속 수정 — 2026-11-20

## 확인 범위

배포 OpenAPI `https://malangi.up.railway.app/v3/api-docs`의 26개 HTTP 작업과 프론트 호출을 대조했다. 백엔드 원격 main은 `637664c3fceeac99401887d12bf4a31631e569fa`이며 `git show origin/main:...`으로 읽었다. 로컬 reference-backend 체크아웃은 더 오래된 커밋이므로 체크아웃 파일을 최신 소스로 간주하지 않았다. 백엔드 파일·배포 설정은 수정하지 않았다.

## API 사용 현황

경로는 `/api/v1` 기준이다. 이번에 미사용 API를 새로 연결하지 않았다.

| API | 현재 사용 | 비고 |
| --- | --- | --- |
| POST auth/signup | 사용 | 이메일 가입 |
| POST auth/login | 사용 | 이메일 로그인 |
| GET auth/me | 사용 | 현재 계정 |
| POST auth/refresh | 사용 | 토큰 갱신 |
| POST auth/logout | 사용 | 로그아웃 |
| POST auth/oauth/{provider} | 미사용 | 현재 로그인 UI는 이메일 전용 |
| POST counseling/sessions | 사용 | 첫 입력으로 세션 생성 |
| POST counseling/sessions/{id}/messages | 사용 | 서버 MESSAGE 단계에서 전송 |
| POST counseling/sessions/{id}/emotion | 사용 | 서버 감정 카드 제출 |
| POST counseling/sessions/{id}/complete | 사용 | POST_INTENSITY와 필수 점수 확인 후 저장 |
| POST counseling/sessions/{id}/abort | 사용 | 저장 없이 종료 |
| DELETE counseling/sessions/{id} | 미사용 | 세션 삭제와 완료 기록 삭제는 별개 |
| GET records | 사용 | 페이지 조회 후 월간·주간·목록 구성 |
| GET records/{id} | 사용 | 결과/상세 |
| GET records/{id}/messages | 사용 | 원문 다시 보기 |
| PATCH records/{id}/hidden | 사용 | 가리기·복원 |
| DELETE records/{id} | 사용 | 완료 기록 삭제 |
| GET records/calendar | 미사용 | 현재 프론트에서 기록을 KST 날짜로 묶음 |
| GET records/report | 미사용 | 월간 AI 분석 보고서 UI 연결 안 됨 |
| GET malangis | 미사용 | 현재 말랑이 선택은 계정별 로컬 preview inventory |
| PATCH malangis/{type}/select | 미사용 | 서버 선택 동기화 안 됨 |
| PATCH malangis/{type}/state | 미사용 | 서버 말랑이 상태 동기화 안 됨 |
| POST malangi/sessions/start | 미사용 | 체험 시간 서버 기록 안 됨 |
| POST malangi/sessions/{id}/end | 미사용 | 위와 동일 |
| GET malangi/sessions | 미사용 | 서버 체험 이력 UI 없음 |
| GET health | 앱 미사용 | 운영/연결 확인용 |

15개 사용, 11개 앱 미사용이다. 서버의 보유/해금 정책을 그대로 연결하면 ‘모든 종류 바로 선택’ 요구와 달라질 수 있으므로 말랑이 서버 연동은 별도 계약 확인이 필요하다. API가 있다는 사실만으로 해당 기능을 연결 완료로 표시하지 않는다. 회원정보 수정·비밀번호 찾기/변경·중간 보관/진행 세션 재개 API는 이 명세에 없다.

## Claude와 종료 조건

`SpringAiCounselingAi`는 Spring AI의 `AnthropicChatModel`로 Claude를 호출한다. 소스 기본 모델 문자열은 `claude-haiku-5-5`, 배포 환경의 `LLM_MODEL`로 재정의 가능하다. 키는 `LLM_API_KEY` 또는 `ANTHROPIC_API_KEY`다. 프론트는 Claude에 직접 접속하지 않는다.

키가 없거나 호출·응답 검증이 실패하면 백엔드 기본 문장이 나올 수 있다. 안전 분류 최종 실패도 진행 없이 기본 응답을 돌려준다. API 응답에는 실제 제공자/모델/대체 응답 여부가 없어, 배포 환경 변수와 내부 로그를 보지 않고 매 응답이 Claude 성공 호출이라고 확정할 수 없다. 실제 서버의 단계 이동·완료 저장은 별도 검증했다.

정해진 대화 횟수 상한은 없다. STEP_01 상황 → 감정 카드 → STEP_02 처음 생각 → STEP_03 다른 관점/욕구 → STEP_04 대처 → STEP_05 작은 실천 → 사후 점수 → STEP_06 정리 순서다. 필수 슬롯이 채워지고 AI `transitionReady` 또는 서버의 답 없음 처리가 충족돼야 진행한다. 듣기 요청·이전 단계 복귀·실패 시 같은 단계에 머물 수 있다. AI `endRequested=true`는 사후 점수로 조기 이동시킨다. 프론트에서 횟수로 강제 저장하거나 완료 상태를 만들지 않는다.

후속 UI 정리에서 대화 상단의 단계·응답 대기·마지막 점수 문구를 모두 제거했다. MESSAGE 단계에는 ‘지금까지 이야기 정리하기’를 둔다. 확인 창의 ‘이야기 정리하기’를 누르면 기존 종료 의도 문장 ‘이제 대화를 마무리하고 싶어요.’를 서버에 보내며 사용자가 작성하던 미전송 글은 요청으로 바꾸거나 기록에 포함하지 않는다. 서버가 종료 의도를 받아들이지 않으면 완료로 가장하지 않는다. 임시 이탈은 탭 메모리 유지, 정상 저장은 서버 완료로 계속 구분한다.

## 날짜 원인과 수정

서버 `CounselingService.now()`는 UTC `LocalDateTime`을 저장한다. `RecordService`는 createdAt을 시간대 없는 문자열로 반환하고 별도 date/time을 KST로 만든다. 기존 프론트는 시간대 없는 createdAt을 브라우저 현지 시간으로 읽어 9시간 차이 및 전날 그룹을 만들었다.

`decodeServerRecord`에서 이 계약의 시간대 없는 값만 UTC Z를 붙여 정규화한다. 이미 Z나 오프셋이 있는 값은 추가 이동하지 않는다. 이후 기존 KST 포맷/그룹 함수를 사용한다. 원본 DB 날짜를 수정하지 않고 과거 기록에도 적용된다. 실제 응답 `2026-11-19T19:09:10.415305` / date `2026-11-20` / time `04:09`를 상세 화면과 비교했다.

## 말랑이 경로·선택

- 추천과 기록 링크는 `/?play=SLANGI|SQUISHY|WAKPPU`로 실제 Home 체험 상태에 들어간다. 기존 `/malangi?type=...`는 호환 리다이렉트만 남는다.
- 체험 마치기는 검증된 toyReturn의 추천/기록으로 복귀하며 일반 메인 체험은 메인 대기 상태로 돌아간다. 설정 왕복도 play 쿼리와 출발 상태를 유지한다.
- 종류 선택 시 응답을 기다리며 버튼을 잠그던 방식을 제거했다. URL/캐시는 즉시 바꾸고 로컬 선택 저장은 순서대로 처리한다. 늦은 응답이 마지막 선택을 덮어쓰거나 이탈 후 화면을 이동시키지 않는다. 대기 중 계정이 바뀌면 이전 계정의 저장 요청을 중단한다.
- 9개 원화를 순차 선로딩하고 디코딩/히트 마스크를 재사용한다. 캐시가 있으면 새 모양을 동기 참조해 불필요한 대체 이미지 전환을 줄인다. 실제 휴대폰 성능은 별도 확인이 필요하다.
- 하단 모양 이름은 화면에서 제거했다. 버튼 접근성 이름과 선택 상태, 상단 종류 이름은 유지한다.

수면·로그인 동작과 백엔드는 변경하지 않았다. PR·병합·배포 전 로컬 검토 상태다. 검사 결과는 qa.md의 최신 항목을 따른다.
