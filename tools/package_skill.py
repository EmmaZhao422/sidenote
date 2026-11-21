#!/usr/bin/env python3
"""Packs skill/sidenote-coach/ into skill/sidenote-coach.zip, the file people upload to Claude.

    python3 tools/package_skill.py          # rebuild the zip
    python3 tools/package_skill.py --check  # fail if the zip is out of date (used by the tests)

Claude expects the zip to contain the skill folder itself at the top level
(sidenote-coach/SKILL.md), and the folder name to match the name in SKILL.md.
File dates inside the zip are fixed so that rebuilding without changes gives
the same bytes.
"""
import hashlib
import io
import os
import sys
import zipfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'skill')
NAME = 'sidenote-coach'
SKIP_DIRS = {'__pycache__', 'evals'}


def files():
    base = os.path.join(ROOT, NAME)
    out = []
    for folder, dirs, names in os.walk(base):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for n in sorted(names):
            if n.endswith('.pyc') or n == '.DS_Store':
                continue
            full = os.path.join(folder, n)
            out.append((os.path.relpath(full, ROOT).replace(os.sep, '/'), full))
    return sorted(out)


def build():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for arc, full in files():
            info = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(full, 'rb') as f:
                z.writestr(info, f.read())
    return buf.getvalue()


def main():
    target = os.path.join(ROOT, NAME + '.zip')
    data = build()
    if '--check' in sys.argv:
        current = open(target, 'rb').read() if os.path.exists(target) else b''
        if hashlib.sha256(current).hexdigest() != hashlib.sha256(data).hexdigest():
            sys.exit('skill/sidenote-coach.zip is out of date. Run: python3 tools/package_skill.py')
        print('skill zip is up to date')
        return
    with open(target, 'wb') as f:
        f.write(data)
    print(f'wrote {os.path.relpath(target)} ({len(data)} bytes, {len(files())} files)')


if __name__ == '__main__':
    main()
