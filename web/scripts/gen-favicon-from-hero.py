#!/usr/bin/env python3
"""web/src/assets/hero.png 를 정사각형으로 자른 뒤 탭 아이콘 PNG·ICO를 만듭니다. Pillow 필요: pip install pillow

- src/assets: Vite가 import 시 해시 URL을 붙여 캐시 무효화에 유리
- public: /favicon.ico, /apple-touch-icon.png (레거시·iOS 기본 탐색용)
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src/assets/hero.png"
ICO_PATH = ROOT / "public/favicon.ico"
APPLE_PUBLIC = ROOT / "public/apple-touch-icon.png"
OUT = [
    (16, ROOT / "src/assets/tab-icon-16.png"),
    (32, ROOT / "src/assets/tab-icon-32.png"),
    (180, ROOT / "src/assets/apple-touch-180.png"),
]


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    s = min(w, h)
    l = (w - s) // 2
    t = (h - s) // 2
    sq = im.crop((l, t, l + s, t + s))
    for size, path in OUT:
        path.parent.mkdir(parents=True, exist_ok=True)
        sq.resize((size, size), Image.Resampling.LANCZOS).save(path, optimize=True)
        print("wrote", path.relative_to(ROOT))
    img180 = sq.resize((180, 180), Image.Resampling.LANCZOS)
    img180.save(APPLE_PUBLIC, optimize=True)
    print("wrote", APPLE_PUBLIC.relative_to(ROOT))
    img32 = sq.resize((32, 32), Image.Resampling.LANCZOS)
    img32.save(ICO_PATH, format="ICO", sizes=[(32, 32)])
    print("wrote", ICO_PATH.relative_to(ROOT))


if __name__ == "__main__":
    main()
