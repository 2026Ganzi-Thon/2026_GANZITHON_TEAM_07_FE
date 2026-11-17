# 시안 자산 기록

## 색상과 화면 근거

- [피그마 전체 이미지](design/figma-overview-2026-11-14.png)와 [담당자 설명](design/담당자전달사항-2026-11-14.md)을 참고했다.
- 2026-11-15 Design 속성 패널에서 주요 레이어를 확인했다. 직접 확인한 값은 [원본 확인표](design/figma-inspection-2026-11-15.md)에 한정하며 전체 자산 추출·전수 검증은 미완료다.
- `tokens.css`는 최신 Figma 확인값을 반영한다. 이미지 표본값과 직접 확인값의 범위는 design.md에서 구분한다.

## 소크라테스 프로필 — 임시 생성 자산

- 파일: `public/assets/socrates-preview.png`
- 제작: 내장 image_gen 도구, 2026-11-14. 생성 결과를 수정하지 않고 프로젝트로 복사했다.
- 용도: 대화 화면 프로필과 초기 안내 아바타.
- 원본 Figma의 석상을 복제한 것이 아니라 흰 대리석·따뜻한 회색 분위기에 맞춘 임시 해석이다. 팀의 정식 자산을 받으면 교체한다.
## 말랑이·아이콘

- `src/components/Malangi.tsx`와 CSS: 결과 화면·기본 대체 표시용 말랑이. 조작 화면은 아래의 Canvas 렌더러를 사용한다.
- 아이콘: Lucide React 패키지의 아이콘. 배포 라이선스는 패키지의 ISC 라이선스를 따른다.
- 로고 파비콘: 프로젝트에서 작성한 단순 SVG 시안.
- 글꼴: 아래 Pretendard 로컬 웹폰트를 사용한다. 메뉴 꾹꾹체는 웹 임베딩 제한으로 미적용.

## 조작용 형태 9개 — 2026-11-14

`src/features/toy/designs.ts`, `paintToy.ts`, `physics.ts`에서 작성한 절차적 윤곽·명암·얼굴·껍질이다. 물방울/푸딩/구름, 모찌/식빵/별, 진주/하트/조약돌을 세 종류 안의 선택으로 제공한다. 외부 모델·참고 사이트 소스·캐릭터 텍스처를 가져오지 않았다. 팀 최종 캐릭터 승인과는 구분한다.

## 조작 효과음 — CC0 가공 자산

| 저장 파일 | 원본 파일 | 제작자 / 원본 페이지 / 라이선스 |
|---|---|---|
| `public/assets/audio/slime-1..3.wav` | `slime_01.ogg`, `slime_05.ogg`, `slime_09.ogg` | rubberduck · [40 CC0 water splash/slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) · CC0 |
| `public/assets/audio/foam-1..3.wav` | `0778.mp3`의 서로 다른 구간 | Joseph SARDIN · [Sponge and foam](https://bigsoundbank.com/sponge-and-foam-s0778.html) · CC0 |
| `public/assets/audio/crack-1..3.wav` | `bfh1_wood_breaking_01..03.ogg` | rubberduck · [75 CC0 breaking/falling/hit SFX](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx) · CC0 |

2026-11-14 각 원본 페이지의 CC0 표기를 확인하고 공개 다운로드 링크에서 파일을 받았다. CC0 정보: <https://creativecommons.org/publicdomain/zero/1.0/>. 출처는 배포 폴더의 `public/assets/audio/LICENSES.md`에도 포함한다. 다른 팩/웹사이트 전체에 이 라이선스를 일반화하지 않는다.

- 슬라임 팩은 일부 실제 슬라임 녹음이라는 제작자 설명이 있다. 개별 선택 파일의 녹음/합성 여부를 단정하지 않는다.
- 스펀지는 거품을 포함한 손 압축 녹음이다. 건조한 스퀴시 재료의 정확한 원음은 아니다.
- 파손은 나무 파손 원본이다. 실제 왁스 파열음을 직접 녹음한 것으로 표시하지 않는다.
- 모노 혼합, 앞뒤 무음 정리/구간 선택, DC 제거, 32kHz 재표본화, 피크 최대 0.72 및 RMS 상한 0.14, 12ms 시작/끝 페이드를 적용했다. 총 WAV 299,732바이트. 앱 재생 시 필터·음량·속도 변화를 더한다.
- `manifest.json`에 원본 SHA-256, 사용 구간, 결과 SHA-256, 길이·peak·RMS를 저장한다. 변경되면 재생성한다.
- 재현: 별도 Python 환경에 `numpy`, `soundfile`을 설치한 뒤 `python scripts/prepare_audio.py <원본 보관 폴더>` 실행. 앱 실행·npm 빌드에는 Python이 필요 없다. 원본 다운로드 파일과 Python 환경은 저장소에 포함하지 않는다.
- 입력 ZIP은 지정한 멤버를 메모리로 읽고 결과 폴더에 새 WAV만 쓴다. ZIP 경로를 그대로 풀지 않는다.

다운로드 실패 시 Web Audio로 짧은 잡음 기반 효과를 생성한다. 이 대체 효과는 실제 녹음이 아니며, 음원 로딩 실패 상태를 설정창에 표시한다. 실제 스피커/이어폰 청취 검수는 별도다.


## 원본 조회와 Pretendard — 2026-11-15

사이드패널 Design 패널에서 원본 본문 Pretendard/메뉴 MemomentKkukkukk를 확인했다. 기존 연결 실패 기록은 과거 상태다. [원본 수치 기록](design/figma-inspection-2026-11-15.md)의 확인 범위만 원본 기반으로 취급한다. 원본 로고/캐릭터 다운로드는 브라우저 정책에 막혀 기존 임시 이미지를 유지한다.

- 공식 배포처: https://github.com/orioncactus/pretendard
- 파일: `public/fonts/PretendardVariable.woff2` (2,057,688 bytes)
- SHA256: `9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4`
- 획득: 공식 저장소 `main/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2`, 2026-11-15. Figma에 설치된 정확한 빌드 버전은 미확인.
- 라이선스: SIL OFL1.1. `public/fonts/Pretendard-LICENSE.txt`를 원문 그대로 동봉. 폰트 수정 없음.
- 본문400, 제목600. `@font-face` 가변 굵기45~920 명시, 로컬 제공/선로딩. 시스템 폰트는 실패 시 대체용.
- 메뉴 꾹꾹체: https://www.memoment.kr/font 의 웹 임베딩/재배포 제한 확인. 폰트 파일 복사·변환 없음. 별도 웹 사용 허락 또는 정적 글자 자산 제공을 확인할 대상.

## 후속 자산 인계 — 2026-11-15

2026-11-16 기준 로고·수면 UI PNG를 전달받았으며 미적용 상태다. [인계표](design/asset-handoff.md)의 나머지 캐릭터·아바타·아이콘·고정 글자 SVG는 전달 대기다. 원본 파일은 아직 앱에 연결하지 않았다. 추가 조회에서 추천 제목20px, 동적 요약15px, MY 메뉴16px도 MemomentKkukkukk임을 확인했다. 고정 글자는 SVG로 교체 가능하지만 동적 요약은 웹 사용 허락 전 Pretendard를 유지한다. 폰트 파일을 복사하거나 변환하지 않았다.

## 인계 상태 갱신 — 2026-11-16

로고 PNG와 수면 설정 화면·버튼·타이머·토글 PNG가 전달됐다. 아직 앱에 연결하지 않았으며 현재 빌드의 favicon은 기존 SVG다. 버튼 PNG는 여러 상태를 합친 참고 자료이므로 클릭 영역 전체를 이미지로 대체하지 않는다. 정식 말랑이 2D 자산은 디자인 담당자 전달 대기다. 상세 수령/적용 상태는 [인계표](design/asset-handoff.md)를 따른다.
