# Audio sources

## Current runtime assets · 2026-11-18

- `slime-original.mp3`: byte-identical user-supplied 슬랑이.mp3. Press playback uses full duration/rate1 with application volume only. The drag layer derives an overlapping texture in runtime memory; it is processed sound, not a separate recording.
- `touch-foam-1..3.wav`, `touch-release-1..3.wav`: user-supplied 스퀴시.mp3 excerpts. Release3 omits a tonal ending. See supplied-material-manifest.json for source hashes and processing.
- `touch-wax-1..3.wav`: final excerpts from the supplied recording, byte-identical to the accepted local samples (0.66/0.70/0.62 seconds, stereo 44.1 kHz, 3 ms boundary fades). Included in the app assets for all environments; no local override is required. See supplied-material-manifest.json and scripts/extract_wax_reference.py.

## Sleep music / ambience update · 2026-11-20

User-supplied files copied byte-for-byte. External licensing has not been independently verified. No source MP3 edits; playback uses fades and gain adjustment.
- `sleep/music-1.mp3` ← 수면유도음악1.mp3, SHA256 `85954bec669227c6178a07961bc751fad08f5970bc7dd401ac1f05f6462772a4`
- `sleep/music-2.mp3` ← 수면유도음악2.mp3, SHA256 `7ed213fe264e437bebd2c36e7fee1062fab3e8684e73f42a66c3eb825e50aa66`
- Music playlist repeats 1 → 2; playback gain .8 / 2.25 compensates approximately 9dB source-level difference, before the shared .35 master gain. No pitch changes.
- The newly supplied waves/rain/nature files match the hashes below. WHITE remains the internal key, but the displayed label is now 파도소리.

## Sleep ambience · 2026-11-19

Team-supplied recordings, copied byte-for-byte into `sleep/` (no processing; looped at runtime). External licensing not separately confirmed.
- `sleep/waves.mp3` ← 파도 소리.mp3, sha256 a9214a707344d15af2734444f495ca0ab5be54adc57aa754530497a853e1a1ec (plays in the 백색소음 slot)
- `sleep/rain.mp3` ← 빗소리.mp3, sha256 ca25c3c85f4fd56abf29ec7a59fc75d243bfbe12160f4f0870fc4f18c5e2c63e
- `sleep/nature.mp3` ← 자연소리.mp3, sha256 9f8a7fedfb9faaf1cee8dcc80d9cdc3e00a2e7a59459fe9e494c62f315f08b95

Older sources below record earlier iterations; the current runtime selection is described above.

## D52 로컬 녹화 음원 비교

버터·하트 비교용 추출 WAV3개는 Git 제외 `artifacts/wax-reference/`에만 있다. `public`·`dist`에 포함하지 않으며 Vite loopback 미들웨어로만 제공한다. 원본 녹화의0.97~1.72초/2.42~3.29초/3.85~4.81초,44.1kHz 스테레오,3ms 끝단 페이드다. 공개 재사용 조건은 미확인이며 CC0 목록에 포함하지 않는다. 독립 합성음은 구름 및 표본 미준비/비교 기능 비활성 시 사용한다.

## D51 합성 균열음 (2026-11-17)

D51은 음높이 성분 없이 거친 노이즈 입자를 겹친다. 왁뿌볼 파열음은 프로젝트의 `src/features/toy/waxSound.ts`에서 독립적으로 생성한다. 외부 사이트의 녹음/인코딩된 음원/합성 코드를 가져오지 않았다. 아래 shell-1~3 CC0 표본의 기존 출처 기록은 보존하지만 현재 런타임은 해당3개를 로딩/재생하지 않는다. 나머지12개 표본과 사용 조건은 그대로다.

The original nine WAV files are derived from sources published as CC0, checked 2026-11-14.
CC0: https://creativecommons.org/publicdomain/zero/1.0/

- slime-1.wav, slime-2.wav, slime-3.wav: rubberduck, “40 CC0 water splash/slime SFX”, slime_01.ogg / slime_05.ogg / slime_09.ogg. https://opengameart.org/content/40-cc0-water-splash-slime-sfx
- foam-1.wav, foam-2.wav, foam-3.wav: Joseph SARDIN, “Sponge and foam”, recording 0778, three excerpts. https://bigsoundbank.com/sponge-and-foam-s0778.html
- crack-1.wav, crack-2.wav, crack-3.wav: rubberduck, “75 CC0 breaking/falling/hit SFX”, bfh1_wood_breaking_01.ogg through 03.ogg. https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx

Changes: mono mix, trim/excerpts, DC removal, 32 kHz PCM16 conversion, peak/RMS limiting, endpoint fades. See manifest.json for hashes, timing and signal metrics, and scripts/prepare_audio.py for the reproducible transformation. The crack samples are adapted wood breaking sounds, not recordings of wax. Foam excerpts contain wet sponge/foam squeezing.


## D48 material candidates — verified 2026-11-17

- shell-1..3.wav: Joseph SARDIN, Plastic bottle crushed #1 (0775), CC0. https://bigsoundbank.com/plastic-bottle-crushed-1-s0775.html
- bubble-1..3.wav: Joseph SARDIN, Suction cup on plastic (1261), CC0. https://bigsoundbank.com/suction-cup-on-plastic-s1261.html
- foam-release-1..3.wav: Joseph SARDIN, Sponge and foam (0778), CC0. https://bigsoundbank.com/sponge-and-foam-s0778.html

These are adapted foley candidates. Shell sounds are plastic, not actual wax; release sounds are reversed/filtered foam textures, not a separate recording of a squishy recovering. See material-manifest.json for source hashes, excerpts, output hashes and signal metrics. Reproduce with scripts/prepare_material_audio.py using the three original WAVs. The original crack-1..3 files remain on disk but are no longer selected by the runtime. No audio from wakbbuball.com was copied.
