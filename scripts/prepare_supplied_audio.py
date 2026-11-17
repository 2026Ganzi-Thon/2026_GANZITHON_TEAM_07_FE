"""Prepare supplied slime/squishy MP3s without replacing the accepted wax samples. Usage: python this_file.py SOURCE_DIR FFMPEG_EXE.
Requires numpy/soundfile. Sources stay outside Git; recipes are recorded per output.
"""
import hashlib, json, shutil, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
import soundfile as sf
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/audio'
RATE = 32000
specs = {
    '스퀴시': [('touch-foam-1', .72, .72), ('touch-foam-2', 1.80, .72), ('touch-foam-3', 4.80, .72),
              ('touch-release-1', 10.2, .62), ('touch-release-2', 12.4, .68), ('touch-release-3', 14.0, .44)],
}
manifest_path = OUT / 'supplied-material-manifest.json'
# The accepted wax samples come from extract_wax_reference.py; preserve them.
manifest = [item for item in json.loads(manifest_path.read_text(encoding='utf-8')) if item['file'].startswith('touch-wax-')] if manifest_path.exists() else []

with tempfile.TemporaryDirectory() as temp:
    for original, cuts in specs.items():
        source = Path(sys.argv[1]) / (original + '.mp3')
        decoded = Path(temp) / 'decoded.wav'
        subprocess.run([sys.argv[2], '-y', '-v', 'error', '-i', str(source), '-ac', '1', '-ar', str(RATE), str(decoded)], check=True)
        data, _ = sf.read(decoded)
        for name, start, duration in cuts:
            samples = data[round(start * RATE):round((start + duration) * RATE)].copy()
            source_duration = duration
            trimmed_release = name == 'touch-release-3'
            samples -= samples.mean()
            # Preserve dry high-frequency detail; avoid the former wet-foam lowpass/reversal.
            target = .065 if 'release' in name else .10
            samples *= min(.72 / max(1e-6, abs(samples).max()), target / max(1e-6, np.sqrt(np.mean(samples ** 2))))
            fade_in = round((.025 if 'release' in name else .003) * RATE)
            fade_out = round((.10 if trimmed_release else .035) * RATE)
            samples[:fade_in] *= np.linspace(0, 1, fade_in)
            samples[-fade_out:] *= np.linspace(1, 0, fade_out)
            file = OUT / (name + '.wav')
            sf.write(file, samples, RATE, subtype='PCM_16')
            manifest.append({'file': file.name, 'original': source.name, 'source': 'user-provided MP3, 2026-11-18',
                'license': 'not supplied; local evaluation authorized, distribution not verified',
                'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'start_seconds': start, 'source_duration_seconds': source_duration, 'duration_seconds': len(samples) / RATE,
                'recipe': ('original first 440ms only; excludes 500ms tonal tail near 1.9kHz; 25ms/100ms fades; natural playback rate' if trimmed_release else
                           'mono 32kHz PCM16; DC removal; bounded gain; endpoint fades; no reversal or added water/bubbles'),
                'role': 'designed recovery cue from quieter texture, not verified physical release' if 'release' in name else 'contact',
                'peak': round(float(abs(samples).max()), 5), 'rms': round(float(np.sqrt(np.mean(samples ** 2))), 5),
                'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
source = Path(sys.argv[1]) / '슬랑이.mp3'
file = OUT / 'slime-original.mp3'
shutil.copyfile(source, file)
with tempfile.TemporaryDirectory() as temp:
    decoded = Path(temp) / 'slime.wav'
    subprocess.run([sys.argv[2], '-y', '-v', 'error', '-i', str(source), str(decoded)], check=True)
    samples, rate = sf.read(decoded)
    manifest.append({'file': file.name, 'original': source.name, 'source': 'user-provided MP3, 2026-11-18',
        'license': 'not supplied; local evaluation authorized, distribution not verified',
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
        'start_seconds': 0, 'duration_seconds': len(samples) / rate,
        'recipe': 'byte-identical original MP3; full duration, rate1, no EQ/envelope/reconstruction; application volume only',
        'role': 'contact', 'peak': round(float(abs(samples).max()), 5), 'rms': round(float(np.sqrt(np.mean(samples ** 2))), 5)})
(OUT / 'supplied-material-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Prepared', len(manifest), 'material samples')
