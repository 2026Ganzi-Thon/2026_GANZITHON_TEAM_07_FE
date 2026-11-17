"""Prepare licensed source recordings. Requires numpy and soundfile, outside app runtime.

Usage: python scripts/prepare_audio.py <directory containing slime.zip, breaking.zip, sponge.mp3>
Source URLs and license evidence are recorded in docs/assets.md. No network access.
"""
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile

import numpy as np
import soundfile as sf

SOURCE = Path(sys.argv[1]).resolve()
OUTPUT = Path(__file__).resolve().parents[1] / "public/assets/audio"
OUTPUT.mkdir(parents=True, exist_ok=True)
manifest = []


def prepare(name, source, member=None, bucket=None):
    raw = (SOURCE / source).read_bytes()
    encoded = zipfile.ZipFile(io.BytesIO(raw)).read(member) if member else raw
    samples, rate = sf.read(io.BytesIO(encoded) if member else SOURCE / source, always_2d=True)
    samples = samples.mean(axis=1)
    start = 0
    if bucket is not None:
        lo, hi = bucket
        # Pick an energetic 0.7 s squeeze within each separate source interval.
        width = round(rate * .7)
        starts = range(round(lo * rate), min(round(hi * rate), len(samples)) - width, round(rate * .05))
        start = max(starts, key=lambda i: np.mean(samples[i:i + width] ** 2))
        samples = samples[start:start + width]
    else:
        nonzero = np.flatnonzero(np.abs(samples) > .008)
        start = max(0, int(nonzero[0]) - round(.012 * rate)) if len(nonzero) else 0
        samples = samples[start:start + round(.75 * rate)]
    samples -= samples.mean()
    samples = np.interp(np.arange(round(len(samples) / rate * 32000)) / 32000, np.arange(len(samples)) / rate, samples)
    rms = float(np.sqrt(np.mean(samples ** 2)))
    samples *= min(.72 / max(float(np.max(np.abs(samples))), 1e-9), .14 / max(rms, 1e-9))
    fade = min(round(.012 * 32000), len(samples) // 4)
    samples[:fade] *= np.linspace(0, 1, fade)
    samples[-fade:] *= np.linspace(1, 0, fade)
    target = OUTPUT / name
    sf.write(target, samples, 32000, subtype="PCM_16")
    manifest.append({"file": name, "source": source, "member": member, "start_seconds": round(start / rate, 3), "duration_seconds": round(len(samples) / 32000, 3), "peak": round(float(np.max(np.abs(samples))), 4), "rms": round(float(np.sqrt(np.mean(samples ** 2))), 4), "source_sha256": hashlib.sha256(raw).hexdigest(), "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})


for i, member in enumerate(["slime_01.ogg", "slime_05.ogg", "slime_09.ogg"], 1):
    prepare(f"slime-{i}.wav", "slime.zip", member)
for i, bucket in enumerate([(0, 3), (3, 6), (6, 9)], 1):
    prepare(f"foam-{i}.wav", "sponge.mp3", bucket=bucket)
for i in range(1, 4):
    prepare(f"crack-{i}.wav", "breaking.zip", f"bfh1_wood_breaking_0{i}.ogg")
(OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"files": len(manifest), "wav_bytes": sum((OUTPUT / entry['file']).stat().st_size for entry in manifest)}, indent=2))
