"""Reproduce bundled wax hits from the supplied 2026-11-18 recording.

Usage: python extract_wax_reference.py VIDEO FFMPEG
Writes the three accepted clips and updates their entries in the bundled manifest.
The original video is not required to run or build the app.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import numpy as np
import soundfile as sf

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'public/assets/audio'
out.mkdir(parents=True, exist_ok=True)
segments = [(1.44, 2.10), (2.48, 3.18), (3.52, 4.14)]
manifest = {'source': source.name, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'processing': 'original sample rate/channels/amplitude; 3ms boundary fades only', 'clips': []}
with tempfile.TemporaryDirectory() as temp:
    decoded = Path(temp) / 'source.wav'
    subprocess.run([sys.argv[2], '-y', '-v', 'error', '-i', str(source), '-vn', '-c:a', 'pcm_s16le', str(decoded)], check=True)
    data, rate = sf.read(decoded, always_2d=True)
    for index, (start, end) in enumerate(segments, 1):
        clip = data[round(start * rate):round(end * rate)].copy()
        fade = round(.003 * rate)
        clip[:fade] *= np.linspace(0, 1, fade)[:, None]
        clip[-fade:] *= np.linspace(1, 0, fade)[:, None]
        path = out / f'touch-wax-{index}.wav'
        sf.write(path, clip, rate, subtype='PCM_16')
        manifest['clips'].append({'file': path.name, 'start': start, 'end': end, 'duration': len(clip)/rate,
                                  'sample_rate': rate, 'channels': clip.shape[1],
                                  'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
manifest_path = out / 'supplied-material-manifest.json'
entries = [item for item in json.loads(manifest_path.read_text(encoding='utf-8')) if not item['file'].startswith('touch-wax-')] if manifest_path.exists() else []
for clip in manifest['clips']:
    entries.append({'file': clip['file'], 'original': manifest['source'],
        'source': 'user-provided recording; underlying audio reported as Pixabay',
        'source_sha256': manifest['source_sha256'], 'start_seconds': clip['start'],
        'source_duration_seconds': clip['duration'], 'duration_seconds': clip['duration'],
        'sample_rate': clip['sample_rate'], 'channels': clip['channels'],
        'recipe': manifest['processing'], 'role': 'fracture', 'sha256': clip['sha256']})
manifest_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Prepared three bundled wax hits:', segments)
