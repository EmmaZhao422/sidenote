# The Sidenote backup file

A backup is one JSON object, saved from the website's Settings page ("Save a backup file"). It never contains an API key.

```
{
  "version": 1,
  "app": "sidenote",
  "exportedAt": 1795316400000,        // when the file was saved, milliseconds since 1970
  "tzOffsetMinutes": 300,             // minutes to add to the student's local time to get UTC (US Eastern = 300)
  "settings": { "lang": "en" | "zh" | "", ... },
  "thoughts": [ ... ],
  "sessions": [ ... ]
}
```

Older backups may lack `app`, `exportedAt` and `tzOffsetMinutes`; the script then uses the current time and UTC.

## A thought

| Field | Meaning |
|---|---|
| `text` | What the student typed, up to 500 characters |
| `createdAt` | When it was parked (ms since 1970) |
| `category` | `question`, `todo`, `worry`, `idea`, `urge` or `other`. Guessed by keyword on the website; the student can correct it |
| `status` | `open` (still waiting) or `done` (dealt with) |
| `sessionId` | The study block it was parked in, or `null` if it was parked from the home page |
| `offsetSec` | Seconds into the focus block when it was parked. `null` for thoughts parked during the get-ready step or outside a block |
| `reply` | The answer the website already gave, if any: `{ text, source: "ai" | "offline", at }` |
| `sample` | `true` for the website's demo data. The script leaves these out unless `--include-samples` is given |

## A session (one study block)

| Field | Meaning |
|---|---|
| `startedAt`, `endedAt` | Start and end of the focus part (ms since 1970) |
| `plannedMin` | The length the student chose |
| `focusSec` | Seconds of focus actually counted (pauses excluded) |
| `pauses`, `pausedSec` | How often and how long they paused |
| `awaySec`, `awayCount` | Time spent away from the tab. Only meaningful when `mode` is `paper` |
| `mode` | `paper` (studying on paper, tab stays open) or `screen` (studying on the same computer) |
| `scene` | Background scene id: `rain`, `ocean`, `fire`, `forest`, `night`, `train`, `library`, `brown`, `pink`, `white`, `silence` |
| `goal`, `steps` | What the block was for, and up to three steps `{ text, done }` |
| `rating` | The student's own 1–5 answer to "How focused did it feel?" |
| `finished` | `yes`, `partly` or `no`: did they finish what they planned |
| `parkedCount` | Stray thoughts parked during the focus part |
| `score`, `parts` | The focus score and its three parts `{ feel, done, steady }`, each 0–100 |

## The focus score

`score = 0.45 × feel + 0.20 × done + 0.35 × steady`

- `feel` = 20 × rating.
- `done` = 100 / 60 / 25 for yes / partly / no; when steps were written, averaged half-and-half with the share of steps ticked off.
- `steady` starts at 100 and loses 7 per parked thought and 12 per pause (both scaled to a 25-minute block), up to 40 for time away from the tab in `paper` mode, and up to 30 for stopping well before the planned time.

It is a yardstick for comparing one student's blocks with each other. It is not a measurement of attention.

## Scene ranking

Scenes are ranked by average focus score, with small samples pulled toward the student's overall average (as if every scene started with two average blocks). A recommendation is made only after three rated blocks in total. "Similar" scenes are the untried ones closest in character, compared on five traits: steady, natural, low-pitched, rhythmic, bright.
