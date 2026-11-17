# 기능별 PR 검토 안내

2026-11-16 리뷰 수정 및 D40~D42 보완. 기존 PR을 업데이트하며 새 PR을 만들거나 PR을 머지하지 않는다.

## 검토 순서와 최신 코드

기존 #1~#5 이후 #6 → #7 → #8 → #9 순서다. 최종 전체 코드는 `feat/dialogue-voice-followup`에 있다. 각 PR은 바로 앞 기능 브랜치를 기준으로 하므로 main과 직접 비교하면 이전 기능까지 포함된다.

| PR | 작업 브랜치 | 기준 브랜치 | 이번 수정 |
|---|---|---|---|
| [#6](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/6) | feat/design-assets-followup | feat/results-archive | 폰트 파일·적용 유지. 라이선스 확인 및 교체 예정 답글 |
| [#7](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/7) | feat/home-interaction-followup | feat/design-assets-followup | 메인/말랑이 진입 시트 공유, 음소거 위치 통일, 왁뿌볼 윤곽 판정 |
| [#8](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/8) | feat/records-followup | feat/home-interaction-followup | 기록 로딩 개수, 도움·설정 복귀 상태, 전화 링크, 결과 첫 화면 여백 |
| [#9](https://github.com/2026Ganzi-Thon/2026_GANZITHON_TEAM_07_FE/pull/9) | feat/dialogue-voice-followup | feat/records-followup | 실패 시 정상 완료 차단·중간 보관 구분, 한 글자 단어 문장, 수동 계속 버튼 제거, 줄바꿈·통합 QA·인수인계 |

원래 #2~#5의 지적은 대응하는 #7~#9 수정으로 연결한다. 동일 구현을 과거 브랜치에 중복 추가하지 않는다. 기존 커밋은 재작성하지 않고 선행 수정 이력을 후속 브랜치에 포함한다. main 변경과 PR 병합은 별도다.

## 범위와 검증

- 폰트·로그인 전체 흐름·수면은 구현을 변경하지 않는다. 꾹꾹체의 웹 임베딩/재배포 제한은 확인했으며 대체 서체와 파일·기존 이력 정리는 후속 협의 대상이다. 배포 허가가 확보된 상태가 아니다.
- 실제 AI·인증·영속 저장·STT 연동 완료를 의미하지 않는다. 중간 보관/가리기는 현재 프론트 예시 계약이다.
- 각 브랜치의 타입·빌드·단위 검사와 최종 브라우저 검증은 [QA](qa.md)에 기록한다. 원문 코멘트별 변경은 [리뷰 대응표](review-fixes-2026-11-16.md)를 따른다.
- 사적 대화·memory.md·환경변수·이전 실험·참고 체크아웃·캐시·빌드·스크린샷은 제외한다. 팀 필수 정보는 [인수인계](handoff.md)에 남긴다.
- 리뷰 답글은 코멘트 12개에 개별로 작성하며 자동 resolve나 PR 머지를 하지 않는다.
