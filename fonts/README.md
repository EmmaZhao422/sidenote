# Fonts

Both fonts are served from this folder, so the site makes no request to a font
service and looks the same where such services are blocked.

| File | Font | Licence |
|---|---|---|
| `bricolage-grotesque-latin.woff2` | Bricolage Grotesque (variable: weight 200–800, optical size 12–96), Latin subset. Copyright 2022 The Bricolage Grotesque Project Authors (https://github.com/ateliertriay/bricolage) | SIL Open Font License 1.1 |
| `caveat-latin.woff2` | Caveat (variable: weight 400–700), Latin subset. Copyright 2014 The Caveat Project Authors (https://github.com/googlefonts/caveat) | SIL Open Font License 1.1 |

The files come from the Fontsource packages `@fontsource-variable/bricolage-grotesque`
and `@fontsource-variable/caveat` (version 5.3.0). The licence text is at
https://openfontlicense.org.

| `wenkai/*.woff2` (97 files) | LXGW WenKai GB Screen, regular weight, by LXGW (https://github.com/lxgw/LxgwWenKai-Screen), derived from Klee One by Fontworks. Used for parked thoughts written in Chinese | SIL Open Font License 1.1 |

The WenKai files come from the npm package `lxgw-wenkai-screen-webfont` 1.7.0 (packaging by Chawye Hsu, MIT).
They are cut by character range, and `css/hand-zh.css` tells the browser which file holds which characters,
so a visitor downloads only the few files their text needs. That stylesheet is loaded only when Chinese text is shown.

All other Chinese text uses the fonts already on the visitor's device.
