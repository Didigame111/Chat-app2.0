#!/usr/bin/env python3
"""Generate the PNG app icons without any image libraries.

Keeps the repo dependency-free: `python3 scripts/make-icons.py` redraws
public/*.png from the same gradient + speech-bubble mark used by icon.svg.
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public"

BG_A = (0x63, 0x66, 0xF1)   # indigo  #6366f1
BG_B = (0x8B, 0x5C, 0xF6)   # violet  #8b5cf6
FG = (0xFF, 0xFF, 0xFF)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def rounded_rect(px, py, x0, y0, x1, y1, r):
    """Signed coverage test for a rounded rectangle (1 inside, 0 outside)."""
    if px < x0 or px > x1 or py < y0 or py > y1:
        return False
    cx = min(max(px, x0 + r), x1 - r)
    cy = min(max(py, y0 + r), y1 - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def bubble(px, py, size):
    """The chat bubble mark, in 0..size coordinates."""
    s = size
    body = rounded_rect(px, py, 0.20 * s, 0.22 * s, 0.80 * s, 0.63 * s, 0.13 * s)
    # Tail: a wedge hanging off the lower-left of the body.
    tx, ty = px - 0.32 * s, py - 0.60 * s
    tail = 0 <= ty <= 0.18 * s and 0 <= tx <= 0.20 * s and ty <= (0.18 * s) - 0.9 * tx
    return body or tail


def render(size, full_bleed=False, pad=0.0):
    rows = []
    corner = 0.0 if full_bleed else 0.225 * size
    inner = pad * size
    art = size - 2 * inner
    for y in range(size):
        row = bytearray([0])  # PNG filter byte: none
        for x in range(size):
            if not full_bleed and not rounded_rect(x, y, 0, 0, size - 1, size - 1, corner):
                row += bytes((0, 0, 0, 0))
                continue
            # 135deg gradient
            t = (x / (size - 1) + y / (size - 1)) / 2
            r, g, b = lerp(BG_A, BG_B, t)
            if bubble(x - inner, y - inner, art):
                r, g, b = FG
            row += bytes((r, g, b, 255))
        rows.append(bytes(row))
    return b"".join(rows)


def write_png(path, size, **kw):
    raw = render(size, **kw)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    path.write_bytes(png)
    print(f"{path.name}: {size}x{size}, {len(png) / 1024:.1f} KB")


if __name__ == "__main__":
    # iOS masks the home-screen icon itself, so this one is square and opaque.
    write_png(OUT / "apple-touch-icon.png", 180, full_bleed=True)
    write_png(OUT / "icon-192.png", 192)
    write_png(OUT / "icon-512.png", 512)
    # Maskable: extra padding so Android/Chrome safe-zone cropping keeps the mark.
    write_png(OUT / "icon-maskable-512.png", 512, full_bleed=True, pad=0.16)
