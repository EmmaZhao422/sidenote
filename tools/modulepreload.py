#!/usr/bin/env python3
"""Keeps the <link rel="modulepreload"> list in index.html in step with the code.

    python3 tools/modulepreload.py          # rewrite the list
    python3 tools/modulepreload.py --check  # fail if the list is out of date (used by the tests)

The app is plain ES modules with no build step, so the browser only learns
about a module when the one that imports it has arrived: three round trips
before everything is there. Listing them in the page lets the browser fetch
them all at once.
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
START, END = '  <!-- modulepreload:start -->', '  <!-- modulepreload:end -->'
IMPORT = re.compile(r"""^\s*(?:import|export)\b[^'"]*?\bfrom\s*['"](\.[^'"]+)['"]|^\s*import\s*['"](\.[^'"]+)['"]""", re.M)


def graph(entry='js/main.js'):
    seen, queue = [], [entry]
    while queue:
        path = queue.pop(0)
        if path in seen:
            continue
        seen.append(path)
        src = open(os.path.join(ROOT, path), encoding='utf8').read()
        for a, b in IMPORT.findall(src):
            queue.append(os.path.normpath(os.path.join(os.path.dirname(path), a or b)).replace(os.sep, '/'))
    return seen[1:]  # the entry itself is the <script type="module"> tag


def block():
    return '\n'.join([START] + [f'  <link rel="modulepreload" href="{p}">' for p in graph()] + [END])


def main():
    page = os.path.join(ROOT, 'index.html')
    html = open(page, encoding='utf8').read()
    current = re.search(re.escape(START) + r'.*?' + re.escape(END), html, re.S)
    if '--check' in sys.argv:
        if not current or current.group(0) != block():
            sys.exit('The modulepreload list in index.html is out of date. Run: python3 tools/modulepreload.py')
        print('modulepreload list is up to date')
        return
    if current:
        html = html[:current.start()] + block() + html[current.end():]
    else:
        anchor = '  <link rel="stylesheet" href="css/app.css">\n'
        assert anchor in html
        html = html.replace(anchor, anchor + block() + '\n', 1)
    open(page, 'w', encoding='utf8').write(html)
    print(f'{len(graph())} modules listed')


if __name__ == '__main__':
    main()
