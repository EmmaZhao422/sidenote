#!/usr/bin/env python3
"""Reads a Sidenote backup file and prints the numbers as JSON.

Usage:
    python sidenote_stats.py sidenote-backup-2026-11-21.json            # last 7 days
    python sidenote_stats.py backup.json --days 30                      # last 30 days
    python sidenote_stats.py backup.json --days 0                       # everything
    python sidenote_stats.py backup.json --thoughts                     # only the thoughts still waiting

Why a script: the recap must quote real numbers. Counting sessions and averaging
scores by eye from raw JSON goes wrong; this does the arithmetic the same way
the Sidenote website does (js/score.js), so the two always agree.

Only the Python standard library is used.
"""
import argparse
import json
import math
import sys
import time
from collections import OrderedDict

CATEGORIES = ["question", "todo", "worry", "idea", "urge", "other"]

# How each scene "feels", 0 to 1. Same table as the website (js/scenes.js).
SCENES = OrderedDict([
    ("rain",    {"name": "Rain on the window", "steady": 0.8, "nature": 0.9, "low": 0.4, "rhythm": 0.1, "bright": 0.7}),
    ("ocean",   {"name": "Slow waves",         "steady": 0.4, "nature": 1.0, "low": 0.6, "rhythm": 0.6, "bright": 0.5}),
    ("fire",    {"name": "Fireplace",          "steady": 0.3, "nature": 0.6, "low": 0.7, "rhythm": 0.0, "bright": 0.4}),
    ("forest",  {"name": "Forest wind",        "steady": 0.5, "nature": 1.0, "low": 0.3, "rhythm": 0.0, "bright": 0.6}),
    ("night",   {"name": "Summer night",       "steady": 0.6, "nature": 0.9, "low": 0.2, "rhythm": 0.7, "bright": 0.8}),
    ("train",   {"name": "Night train",        "steady": 0.6, "nature": 0.0, "low": 0.9, "rhythm": 0.9, "bright": 0.2}),
    ("library", {"name": "Quiet library",      "steady": 0.9, "nature": 0.0, "low": 0.6, "rhythm": 0.0, "bright": 0.1}),
    ("brown",   {"name": "Brown noise",        "steady": 1.0, "nature": 0.1, "low": 1.0, "rhythm": 0.0, "bright": 0.1}),
    ("pink",    {"name": "Pink noise",         "steady": 1.0, "nature": 0.1, "low": 0.5, "rhythm": 0.0, "bright": 0.5}),
    ("white",   {"name": "White noise",        "steady": 1.0, "nature": 0.0, "low": 0.1, "rhythm": 0.0, "bright": 1.0}),
    ("silence", {"name": "Silence",            "steady": 1.0, "nature": 0.0, "low": 0.0, "rhythm": 0.0, "bright": 0.0}),
])
TRAITS = ["steady", "nature", "low", "rhythm", "bright"]
MIN_BLOCKS_FOR_RECOMMENDATION = 3


def js_round(x):
    """Round half up, the way JavaScript's Math.round does."""
    return math.floor(x + 0.5)


def scene_name(scene_id):
    return SCENES.get(scene_id, {}).get("name", scene_id)


def similarity(a, b):
    dot = sum(a[k] * b[k] for k in TRAITS)
    na = math.sqrt(sum(a[k] ** 2 for k in TRAITS))
    nb = math.sqrt(sum(b[k] ** 2 for k in TRAITS))
    return dot / (na * nb) if na and nb else 0.0


def scene_report(sessions):
    scored = [s for s in sessions if isinstance(s.get("score"), (int, float)) and s.get("scene")]
    overall = sum(s["score"] for s in scored) / len(scored) if scored else 0
    by_scene = OrderedDict()
    for s in scored:
        e = by_scene.setdefault(s["scene"], {"id": s["scene"], "blocks": 0, "sum": 0, "minutes": 0.0})
        e["blocks"] += 1
        e["sum"] += s["score"]
        e["minutes"] += (s.get("focusSec") or 0) / 60
    rows = []
    for e in by_scene.values():
        rows.append({
            "id": e["id"], "name": scene_name(e["id"]), "blocks": e["blocks"],
            "averageScore": js_round(e["sum"] / e["blocks"]), "minutes": js_round(e["minutes"]),
            # small samples are pulled toward the overall average, as if each scene
            # started with two average blocks, so one lucky block doesn't win
            "adjusted": (e["sum"] + overall * 2) / (e["blocks"] + 2),
        })
    rows.sort(key=lambda r: -r["adjusted"])
    total = sum(r["blocks"] for r in rows)
    tried = [r["id"] for r in rows]
    if total < MIN_BLOCKS_FOR_RECOMMENDATION:
        rec = {"status": "not enough data", "ratedBlocksNeeded": MIN_BLOCKS_FOR_RECOMMENDATION - total}
    else:
        best = rows[0]
        base = SCENES.get(best["id"])
        similar = []
        if base:
            others = [(sid, similarity(base, t)) for sid, t in SCENES.items()
                      if sid not in tried and sid != "silence" and sid != best["id"]]
            others.sort(key=lambda x: -x[1])
            similar = [scene_name(sid) for sid, _ in others[:2]]
        rec = {
            "status": "ready", "best": best["name"], "bestAverageScore": best["averageScore"],
            "bestBlocks": best["blocks"],
            "confidence": "solid" if best["blocks"] >= 3 else "early (fewer than 3 blocks with this scene)",
            "similarUntriedScenes": similar,
        }
    for r in rows:
        r["adjusted"] = round(r["adjusted"], 1)
    return rows, rec


def local_day(ts_ms, tz_offset_min):
    """Calendar day (YYYY-MM-DD) in the student's own time zone."""
    return time.strftime("%Y-%m-%d", time.gmtime(ts_ms / 1000 - tz_offset_min * 60))


def main():
    ap = argparse.ArgumentParser(description="Print the numbers from a Sidenote backup as JSON.")
    ap.add_argument("file")
    ap.add_argument("--days", type=int, default=7, help="look back this many days (0 = everything)")
    ap.add_argument("--thoughts", action="store_true", help="only list the thoughts still waiting")
    ap.add_argument("--include-samples", action="store_true", help="count the website's example data too")
    args = ap.parse_args()

    try:
        with open(args.file, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as err:
        sys.exit(f"Could not read {args.file}: {err}")
    if not isinstance(data, dict) or not isinstance(data.get("thoughts"), list) or not isinstance(data.get("sessions"), list):
        sys.exit("This does not look like a Sidenote backup (it needs 'thoughts' and 'sessions' lists).")

    # getTimezoneOffset() convention: minutes to ADD to local time to get UTC
    tz = data.get("tzOffsetMinutes")
    tz = tz if isinstance(tz, (int, float)) else 0
    now = data.get("exportedAt") if isinstance(data.get("exportedAt"), (int, float)) else time.time() * 1000

    sessions = [s for s in data["sessions"] if args.include_samples or not s.get("sample")]
    thoughts = [t for t in data["thoughts"] if args.include_samples or not t.get("sample")]
    sample_count = len(data["sessions"]) - len(sessions)
    goal_of = {s.get("id"): s.get("goal") or "" for s in data["sessions"]}

    def describe(t):
        out = {"text": t.get("text", ""), "kind": t.get("category", "other"), "parkedOn": local_day(t.get("createdAt", now), tz)}
        if goal_of.get(t.get("sessionId")):
            out["whileStudying"] = goal_of[t["sessionId"]]
        if isinstance(t.get("offsetSec"), (int, float)):
            out["minuteIntoBlock"] = max(1, js_round(t["offsetSec"] / 60))
        return out

    waiting = [describe(t) for t in thoughts if t.get("status") != "done"]
    if args.thoughts:
        print(json.dumps({"waitingThoughts": waiting, "count": len(waiting)}, ensure_ascii=False, indent=2))
        return

    # "Last 7 days" means today plus the six calendar days before it, in the student's
    # own time zone: the same window the website's summary page uses.
    if args.days <= 0:
        since = 0
    else:
        today_start = ((now - tz * 60000) // 86400000) * 86400000 + tz * 60000
        since = today_start - (args.days - 1) * 86400000
    sessions = [s for s in sessions if since <= s.get("startedAt", 0) <= now]
    thoughts = [t for t in thoughts if since <= t.get("createdAt", 0) <= now]

    focus_sec = sum(s.get("focusSec") or 0 for s in sessions)
    scored = [s for s in sessions if isinstance(s.get("score"), (int, float))]
    avg = js_round(sum(s["score"] for s in scored) / len(scored)) if scored else None

    kinds = OrderedDict((c, 0) for c in CATEGORIES)
    for t in thoughts:
        kinds[t.get("category") if t.get("category") in CATEGORIES else "other"] += 1

    breadth = None
    if len(thoughts) >= 3:
        h = -sum((n / len(thoughts)) * math.log(n / len(thoughts)) for n in kinds.values() if n)
        b = h / math.log(len(CATEGORIES))
        breadth = "narrow" if b < 0.35 else "medium" if b < 0.7 else "wide"

    timing = [0] * 10
    for t in thoughts:
        if isinstance(t.get("offsetSec"), (int, float)):
            timing[min(9, int(t["offsetSec"] // 300))] += 1
    timing_labels = [f"{i * 5}-{i * 5 + 5} min" for i in range(9)] + ["45+ min"]

    in_block = sum(1 for t in thoughts if t.get("sessionId"))
    trend = None
    if len(scored) >= 4:
        ordered = sorted(scored, key=lambda s: s.get("startedAt", 0))
        half = len(ordered) // 2
        diff = (sum(s["score"] for s in ordered[-half:]) / half) - (sum(s["score"] for s in ordered[:half]) / half)
        trend = "rising" if diff >= 5 else "falling" if diff <= -5 else "steady"

    per_day = OrderedDict()
    for s in sorted(sessions, key=lambda s: s.get("startedAt", 0)):
        d = per_day.setdefault(local_day(s.get("startedAt", 0), tz), {"minutes": 0.0, "blocks": 0})
        d["minutes"] += (s.get("focusSec") or 0) / 60
        d["blocks"] += 1
    for d in per_day.values():
        d["minutes"] = js_round(d["minutes"])

    goals = []
    for s in sorted(sessions, key=lambda s: -s.get("startedAt", 0)):
        if s.get("goal") and s["goal"] not in goals and len(goals) < 6:
            goals.append(s["goal"])

    scene_rows, rec = scene_report(sessions)
    finished = {"yes": 0, "partly": 0, "no": 0}
    for s in sessions:
        if s.get("finished") in finished:
            finished[s["finished"]] += 1

    out = OrderedDict([
        ("period", "everything" if args.days <= 0 else f"last {args.days} days"),
        ("blocks", len(sessions)),
        ("focusMinutes", js_round(focus_sec / 60)),
        ("longestBlockMinutes", js_round(max([s.get("focusSec") or 0 for s in sessions] or [0]) / 60)),
        ("averageFocusScore", avg),
        ("focusScoreTrend", trend),
        ("plannedWorkFinished", finished),
        ("pauses", sum(s.get("pauses") or 0 for s in sessions)),
        ("goals", goals),
        ("strayThoughts", len(thoughts)),
        ("strayThoughtsPer25Minutes", round(in_block * 1500 / focus_sec, 1) if focus_sec else None),
        ("thoughtKinds", kinds),
        ("thoughtRange", breadth),
        ("thoughtsByMinuteOfBlock", OrderedDict(zip(timing_labels, timing))),
        ("thoughtsDealtWith", sum(1 for t in thoughts if t.get("status") == "done")),
        ("thoughtsStillWaiting", sum(1 for t in thoughts if t.get("status") != "done")),
        ("focusMinutesPerDay", per_day),
        ("scenes", scene_rows),
        ("sceneRecommendation", rec),
        ("notes", []),
    ])
    if sample_count:
        out["notes"].append(f"{sample_count} example blocks from the website's demo data were left out.")
    if not sessions:
        out["notes"].append("No study blocks in this period. Try --days 0 for everything.")
    elif len(scored) < 3:
        out["notes"].append("Fewer than 3 rated blocks: treat every average here as a first impression.")
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
