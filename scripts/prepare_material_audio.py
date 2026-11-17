"""Build D48 material candidates from licensed recordings; no runtime dependency.
Usage: python scripts/prepare_material_audio.py <directory containing 0775.wav, 1261.wav, 0778.wav>
Requires numpy and soundfile. Original recordings are retained outside the repository.
"""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/audio'
SOURCE = Path(sys.argv[1])
RATE = 32000
SOURCES = {
    '0775': 'https://bigsoundbank.com/plastic-bottle-crushed-1-s0775.html',
    '1261': 'https://bigsoundbank.com/suction-cup-on-plastic-s1261.html',
    '0778': 'https://bigsoundbank.com/sponge-and-foam-s0778.html',
}

def segment(id, start, duration):
    samples, rate = sf.read(SOURCE / (id + '.wav'))
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    samples = samples[int(start * rate):int((start + duration) * rate)]
    return np.interp(np.arange(int(duration * RATE)) * rate / RATE, np.arange(len(samples)), samples)

def lowpass(samples, hz):
    spectrum = np.fft.rfft(samples)
    spectrum /= np.sqrt(1 + (np.fft.rfftfreq(len(samples), 1 / RATE) / hz) ** 4)
    return np.fft.irfft(spectrum, n=len(samples))

manifest = []
def save(name, samples, source, start, recipe):
    samples -= samples.mean()
    samples *= min(.65 / max(.0001, np.max(np.abs(samples))), .10 / max(.0001, np.sqrt(np.mean(samples ** 2))))
    fade = min(int(.018 * RATE), len(samples) // 4)
    samples[:fade] *= np.linspace(0, 1, fade)
    samples[-fade:] *= np.linspace(1, 0, fade)
    path = OUT / (name + '.wav')
    sf.write(path, samples, RATE, subtype='PCM_16')
    manifest.append({'file': path.name, 'source': SOURCES[source], 'author': 'Joseph SARDIN', 'license': 'CC0',
                     'source_sha256': hashlib.sha256((SOURCE / (source + '.wav')).read_bytes()).hexdigest(),
                     'start_seconds': start, 'duration_seconds': len(samples) / RATE, 'recipe': recipe,
                     'peak': round(float(np.max(np.abs(samples))), 5), 'rms': round(float(np.sqrt(np.mean(samples ** 2))), 5),
                     'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

for i, start in enumerate([.08, .38, .95], 1):
    # Thin crinkles, rather than the previous wood impact. This is foley, not recorded wax.
    a = segment('0775', start, .34)
    a = lowpass(a, 6500) - lowpass(a, 500)
    save(f'shell-{i}', a, '0775', start, '500–6500 Hz emphasis, 18 ms fades; plastic foley for a thin shell')
for i, start in enumerate([.08, 1.57, 3.23], 1):
    save(f'bubble-{i}', lowpass(segment('1261', start, .26), 2400), '1261', start, 'lowpass suction-cup transient for occasional slime bubbles')
for i, start in enumerate([.3, 4.25, 8.15], 1):
    a = lowpass(segment('0778', start, .65)[::-1], 1600)
    a *= np.sin(np.linspace(0, np.pi, len(a))) ** .7
    save(f'foam-release-{i}', a, '0778', start, 'reversed and softened foam texture; designed recovery cue, not a separate physical release recording')

(OUT / 'material-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Prepared {len(manifest)} candidates; peak <= 0.65, RMS <= 0.10.')
