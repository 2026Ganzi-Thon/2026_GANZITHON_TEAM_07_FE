# 상담·기록 API 연동 현황 — 2026-11-20

## 후속 점검

[API 전체 사용 현황·종료 조건·날짜 수정](api-audit-and-play-2026-11-20.md)을 추가했다. 시간대 없는 createdAt의 UTC 정규화와 Home 체험 경로가 현재 동작이다.

## 현재 적용

백엔드 코드를 변경하지 않고 배포 API와 프론트를 연결했다. 기본 real 모드는 인증·상담·기록을 실제 서버로 요청한다. mock 모드의 기존 예시 대화는 별도로 유지한다. 이 변경은 로컬 검토 상태이며 PR·병합·배포하지 않았다.

근거는 배포 OpenAPI와 백엔드 main `637664c`다. 엔드포인트 존재 확인뿐 아니라 별도 검증 계정으로 실제 대화 응답, 감정 제출, 완료 저장, 새로고침 조회, 대화 원문, 가리기·복원·삭제까지 확인했다. AI 제공자 설정/호출 로그와 답변 품질 전체를 검증한 것은 아니다.

## 연결한 경로

| 동작 | API | 프론트 처리 |
| --- | --- | --- |
| 첫 이야기 | POST /api/v1/counseling/sessions | 첫 실제 입력으로 생성; 반환 sessionId 유지 |
| 다음 이야기 | POST /api/v1/counseling/sessions/{id}/messages | 최대 2000자; nextInput=MESSAGE에서만 전송 |
| 감정·사전 점수 | POST /api/v1/counseling/sessions/{id}/emotion | 응답의 감정 선택지 사용; aiMessage=null이면 임의 AI 질문 추가 안 함 |
| 완료 | POST /api/v1/counseling/sessions/{id}/complete | POST_INTENSITY일 때 사후 점수 필수; 반환 resultId로 조회 |
| 목록·상세·대화 | GET /api/v1/records, /{id}, /{id}/messages | 페이지 size50으로 last까지 조회; SYSTEM/감정 내부 메시지 제외 |
| 가리기·복원 | PATCH /api/v1/records/{id}/hidden | 서버 반영 뒤 상세 재조회, 목록 캐시 갱신 |
| 삭제 | DELETE /api/v1/records/{id} | 204 빈 응답 처리, 상세·대화·목록 캐시 정리 |
| 저장 없이 나가기 | POST /api/v1/counseling/sessions/{id}/abort | 기록 생성으로 처리하지 않음 |

월간·주간·목록은 조회한 기록으로 구성한다. 별도 calendar API는 이번에 사용하지 않는다. 한국 시간 기준 날짜와 숨김 제외 규칙을 적용하며, 점수 누락을 0으로 계산하지 않는다. 서버 recommendedMalangi·summary·keySentence·슬롯만 실제 기록에 연결한다.

## 백엔드 제약에 맞춘 종료 동작

- **잠시 나갔다 이어하기:** 진행 중 대화를 현재 탭의 메모리에 유지한다. 서버 보관함에는 넣지 않는다. 새로고침·탭 종료 뒤 재개는 지원하지 않으며 종료 창에 이 차이를 표시한다. 브라우저 저장소에 상담 원문을 새로 저장하지 않는다.
- **정상 완료:** 서버가 POST_INTENSITY를 반환하면 점수를 받아 저장한다. 사후 점수 생략이나 임의 0점 대입은 하지 않는다.
- **일찍 마무리:** MESSAGE 단계에서 사용자가 화면에 표시된 ‘이제 대화를 마무리하고 싶어요.’ 버튼을 누르면 그 문장을 그대로 전송한다. 다음 단계는 서버가 결정한다. 감정 입력 전 종료됐다면 서버가 요구하는 감정·사전 점수도 받아 complete에 포함한다.
- **요청 결과 불명:** 타임아웃/서버 오류/잘못된 응답은 POST 자동 반복을 막는다. 완료 요청이었다면 보관함에서 결과를 확인할 수 있다. 완료 후 상세 조회 실패는 GET만 재시도한다. 기존 인증 401 갱신 후 1회 재전송 규칙은 유지한다.
- 과거 mock의 ‘여기까지 보관’과 점수 생략은 mock 전용이다. real 서버 기록과 섞지 않는다.

## 코드 위치

- `src/features/chat/LiveChat.tsx`: real 대화, 서버 nextInput 기반 입력, 탭 메모리 재개.
- `src/lib/counselingApi.ts`, `counselingContracts.ts`: 상담 요청/응답 검증과 기록 DTO 변환.
- `src/lib/recordsApi.ts`: real/mock 분기, 페이지 조회·상세·숨김·삭제.
- `src/features/records/`: 결과·보관함·상세·관리 화면.
- `tests/live-counseling.spec.ts`: 별도 테스트 서버에서 정상/실패/조기 완료/위험 종료 회귀. 실제 배포 서버 QA와 구분한다.

## 남은 백엔드 의존 항목

회원정보 수정·비밀번호 찾기/변경, 중간 보관 기록, 진행 중 세션 재조회/재개, 모호한 POST 결과의 안전한 재전송을 위한 멱등성 계약은 이번 범위에서 제외한다. 말랑이 선택/모양은 로컬 상태이며 계정 간 서버 동기화가 아니다. 음성 인식의 브라우저별 지원 문제는 이 API 연결로 해결되지 않는다.

배포 전 프론트 도메인의 API 접근(CORS 또는 동일 출처 프록시), 모바일 실제 기기 전사/레이아웃을 별도 확인해야 한다. 수면 기능·인증 토큰 로직·백엔드 저장소는 이번에 변경하지 않았다.

근거: [배포 OpenAPI](https://malangi.up.railway.app/v3/api-docs), [백엔드 소스](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_BE/tree/637664c/src/main/java/com/ganzithon/backend/counseling).
