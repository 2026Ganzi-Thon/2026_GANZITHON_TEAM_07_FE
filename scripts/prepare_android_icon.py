"""Resize the supplied logo into Android launcher resources (requires Pillow)."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path, nargs='?', default=root / 'android/branding/icon.png')
args = parser.parse_args()
logo = Image.open(args.source).convert('RGBA')
background = '#fff9f5'
for density, scale in [('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)]:
    folder = root / 'android/app/src/main/res' / f'mipmap-{density}'
    folder.mkdir(parents=True, exist_ok=True)
    size = round(48 * scale)
    legacy = logo.resize((size, size), Image.Resampling.LANCZOS)
    legacy.save(folder / 'ic_launcher.png')
    rounded = Image.new('RGBA', (size, size), background)
    content = logo.resize((round(size * .86), round(size * .86)), Image.Resampling.LANCZOS)
    rounded.alpha_composite(content, ((size-content.width)//2, (size-content.height)//2))
    mask = Image.new('L', (size, size)); ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1), fill=255)
    rounded.putalpha(mask); rounded.save(folder / 'ic_launcher_round.png')
    # Android masks the 108dp layer; keep faces inside the central safe area.
    size, content_size = round(108 * scale), round(64 * scale)
    foreground = Image.new('RGBA', (size, size))
    content = logo.resize((content_size, content_size), Image.Resampling.LANCZOS)
    foreground.alpha_composite(content, ((size-content_size)//2, (size-content_size)//2))
    foreground.save(folder / 'ic_launcher_foreground.png')
print('Generated 15 launcher PNGs from supplied logo')
