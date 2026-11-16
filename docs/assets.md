# 자산·서체 기록

2026-11-16 현재 상태. 시각 근거는 [11/15 Figma 직접 확인표](design/figma-inspection-2026-11-15.md)와 팀이 전달한 개별 파일이다. D38에서 사이드패널 조회로 원본 조언 SVG 3개를 확보했고 아래에 기록했다. MCP 세션 인증 오류와 사이드패널 조회 성공은 별개다.

## 팀 제공 PNG

`public/assets/design/manifest.json`에 각 파일의 SHA-256을 기록했다. 전달 파일의 해상도·투명도·여백과 바이트를 그대로 유지하며 재생성·배경 제거·이미지 편집을 하지 않았다.

| 파일 | 크기 | 용도 |
|---|---|---|
| `lamb.png` | 402×268 | 메인 기본 양, 모양 선택 썸네일, 결과·기록 상세 |
| `socrates.png` | 471×707 | 로그인 안내, CSS 얼굴 크롭으로 대화 프로필 |
| `socrates-with-toy.png` | 471×707 | D37 음성 화면 VoiceView에 적용 |
| `lamb-sleep.png` | 419×295 | 수면 화면용 보관. 해당 화면 미구현 |
| `teslang-logo.png` | 200×200 | 브라우저 favicon. 앱/PWA 도입 아님 |

제공된 PNG의 출처는 팀 디자인 자료다. 외부 배포 라이선스를 별도로 발급받았다고 표시하지 않는다. 별도 아바타 원본은 아직 없어 전신 얼굴을 CSS로 잘라 사용한다. 기존 생성 아바타 `socrates-preview.png`와 시안 `favicon.svg`는 더 이상 코드에서 참조하지 않는다.

## 서체

- 기본 글꼴: Pretendard. 본문·채팅·입력·버튼·달력·헤더 등은 기존 가변 WOFF2를 사용한다.
- 공식 배포처: https://github.com/orioncactus/pretendard
- 파일: `public/fonts/PretendardVariable.woff2`, 2,057,688 bytes. SHA-256: `9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4`.
- 공식 저장소에서 11/15 수령, 수정 없음. SIL OFL1.1 원문 `Pretendard-LICENSE.txt` 동봉. Figma 설치본의 정확한 버전은 미확인.
- 제공 꾹꾹체: `public/fonts/MemomentKkukkukk.ttf`, 5,384,836 bytes. 메뉴18px·MY 항목16px·추천 제목20px·동적 요약15px/24.4px, Regular400에만 적용한다. 인위적인 굵기 합성을 끄고 실패 시 Pretendard로 대체한다.
- TTF SHA-256: `632244da34f4c8ac752ae0aa9b7d649721fb7dd1361dfb0cc6a6e7fa1d9309b9`. 사용자 제공 파일을 그대로 복사했으며 OTF 중복 포함·WOFF 변환·서브셋 처리는 하지 않았다.
- 2026-11-16 [제작사 공식 안내](https://www.memoment.kr/font)와 [다운로드 출처인 눈누](https://noonnu.cc/font_page/1663)를 재확인했다. 콘텐츠 사용은 허용하지만 웹 임베딩 및 폰트 파일 수정·재배포는 제한한다. 현재 TTF를 @font-face로 제공하는 구조와 Git 파일 포함이 이 제한에 해당한다고 판단하며, 비영리 대회 예외나 별도 허락은 확인하지 못했다. 현재 화면 작업의 서체는 유지하되 기획·디자인과 대체 서체를 논의해 최종 배포 전 교체한다. 저장소의 파일과 기존 커밋 이력 정리 범위도 협의한다. 현재 포함 사실을 배포 허가로 해석하지 않는다.

## 말랑이 렌더링과 아이콘

기본 ‘양’은 전달 PNG를 Canvas에서 그리며 누름·드래그·복원 시 전체 크기와 기울기로 반응한다. 국소 메시 변형은 아니다. 내부 `drop` ID는 호환을 위해 유지한다. 푸딩/구름, 모찌/식빵/별, 진주/하트/조약돌의8개 모양은 기존 절차적 Canvas 시안이다. 공통 양을 종류별 최종 캐릭터로 확정한 것은 아니다.

아이콘은 Lucide React(ISC)이며 정식 아이콘 SVG는 미수령이다. 수면 UI 참고 PNG는 실제 조작 UI 대신 이미지로 붙이지 않는다. 수령 상태는 [인계표](design/asset-handoff.md)를 따른다.

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

## D37 음성 화면 적용

제공 `socrates-with-toy.png`를 `VoiceView.tsx`에서 사용한다. 원본 파일을 다시 생성하거나 크롭하지 않았다. 원본 레이어의 배치439×658/X−28/Y167을 확인했고 웹 반응형 차이는 [D37 기록](design/dialogue-voice-2026-11-16.md)에 남겼다. 수면 PNG는 계속 보관 상태다. 발자국·마이크·음소거·채팅·중단은 Lucide 아이콘으로 구현하며 원본 SVG와의 완전 일치를 뜻하지 않는다.

## D38 원본 조언 SVG

| 파일 | 원본 노드 | 원본 크기/색 |
|---|---|---|
| `advice-walk.svg` | `190:12577` | frame14×11.2, SVG14×12 / #868079 |
| `advice-rest.svg` | `276:1145` | 15×10 / #868079 |
| `advice-write.svg` | `276:1147` | 15×10 / #868079 |

팀 Figma에서 SVG로 복사했다. path·fill·viewBox는 유지하고 코드 정리 시 공백만 바뀌었다. 출처와 SHA-256은 동일 manifest에 기록했다. 원본 라이브러리의 별도 배포 허락을 새로 확인했다는 의미는 아니다. 결과 화면의 실제 실천/보조 조언에 연결하며 수면 자산은 변경하지 않았다.
