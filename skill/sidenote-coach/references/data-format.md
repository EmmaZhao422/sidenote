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

Backups made before these three fields existed lack `app`, `exportedAt` and `tzOffsetMinutes`; the script then uses the current time and UTC. The time-zone offset is the one in force when the file was saved, so in a window that crosses a daylight-saving change, blocks close to midnight can land on the neighbouring day.

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

`score = 0.40 × feel + 0.25 × done + 0.35 × steady`

- `feel` = 20 × rating.
- `done` = 100 / 60 / 25 for yes / partly / no; when steps were written, averaged half-and-half with the share of steps ticked off.
- `steady` starts at 100 and loses 15 per pause (per 25 minutes of a longer block), up to 40 for time away from the tab in `paper` mode, and up to 40 for stopping well before the planned time. Parking a thought costs nothing: writing it down instead of chasing it is the point.

Blocks saved before the scoring change of 21 November 2026 used slightly different weights (45 / 20 / 35) and a small penalty per parked thought.

It is a yardstick for comparing one student's blocks with each other. It is not a measurement of attention.

## Scene ranking

Scenes are ranked by average focus score, with small samples pulled toward the student's overall average (as if every scene started with two average blocks). A recommendation is made only after three rated blocks in total, and the top two count as tied when their adjusted averages are within three points. "Similar" scenes are the untried ones closest in character, compared on five traits: steady, natural, low-pitched, rhythmic, bright.

## What the script prints that needs a word of explanation

- `strayThoughts` counts every thought parked in the period, including ones parked from the home page; `strayThoughtsDuringBlocksPer25Minutes` only counts those parked during a block, and is `null` when there were fewer than ten minutes of focus.
- `parkedInPeriodStillWaiting` is about thoughts parked in the period; `waitingNow` is everything still waiting, whenever it was parked.
- `thoughtRange` is `narrow` when one or two kinds dominate and `wide` when thoughts are spread across many kinds.
- An unrated block is scored as if rated 3 (`feel` = 60).
- `scenes` and `sceneRecommendation` are worked out over every rated block in the file, whatever `--days` says, because that is what the website shows.
- `strayThoughtsDuringBlocksPer25Minutes` counts only thoughts parked while the clock was running.
- Each session and thought in a newer backup has its own `tzOffsetMinutes`; the script uses it to find the record's local day.
- `usualBlockLengthMinutes` is the middle planned length (the lower of the two middle ones when the count is even).
- A block that runs past midnight counts on the day it started.
- A scene recommendation needs three rated blocks and at least two different scenes; with one scene only, the status stays `not enough data`.
- `--thoughts --all` lists every thought in the `--days` window with a `status` of `waiting` or `dealt with`.
- Values the website never writes (negative durations, scores outside 0 to 100) are treated as missing.
