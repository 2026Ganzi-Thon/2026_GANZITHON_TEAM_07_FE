# Audio sources

All nine WAV files are derived from sources published as CC0, checked 2026-11-14.
CC0: https://creativecommons.org/publicdomain/zero/1.0/

- slime-1.wav, slime-2.wav, slime-3.wav: rubberduck, “40 CC0 water splash/slime SFX”, slime_01.ogg / slime_05.ogg / slime_09.ogg. https://opengameart.org/content/40-cc0-water-splash-slime-sfx
- foam-1.wav, foam-2.wav, foam-3.wav: Joseph SARDIN, “Sponge and foam”, recording 0778, three excerpts. https://bigsoundbank.com/sponge-and-foam-s0778.html
- crack-1.wav, crack-2.wav, crack-3.wav: rubberduck, “75 CC0 breaking/falling/hit SFX”, bfh1_wood_breaking_01.ogg through 03.ogg. https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx

Changes: mono mix, trim/excerpts, DC removal, 32 kHz PCM16 conversion, peak/RMS limiting, endpoint fades. See manifest.json for hashes, timing and signal metrics, and scripts/prepare_audio.py for the reproducible transformation. The crack samples are adapted wood breaking sounds, not recordings of wax. Foam excerpts contain wet sponge/foam squeezing.
