#!/usr/bin/env python3
"""web/src/assets/hero.png 를 정사각형으로 자른 뒤 public/ 파비콘 PNG를 만듭니다. Pillow 필요: pip install pillow"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src/assets/hero.png"
OUT = [
    (32, ROOT / "public/favicon-32.png"),
    (16, ROOT / "public/favicon-16.png"),
    (180, ROOT / "public/apple-touch-icon.png"),
]


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    s = min(w, h)
    l = (w - s) // 2
    t = (h - s) // 2
    sq = im.crop((l, t, l + s, t + s))
    for size, path in OUT:
        sq.resize((size, size), Image.Resampling.LANCZOS).save(path, optimize=True)
        print("wrote", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
