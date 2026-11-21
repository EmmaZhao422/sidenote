#!/usr/bin/env python3
"""Reads a Sidenote backup file and prints the numbers as JSON.

Usage:
    python3 sidenote_stats.py sidenote-backup-2026-11-21.json            # last 7 days
    python3 sidenote_stats.py backup.json --days 30                      # last 30 days
    python3 sidenote_stats.py backup.json --days 0                       # everything
    python3 sidenote_stats.py backup.json --thoughts                     # only the thoughts still waiting

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
ZH_NAMES = {"rain": "窗边的雨", "ocean": "慢慢的海浪", "fire": "壁炉", "forest": "林间的风", "night": "夏夜", "train": "夜行列车", "library": "安静的图书馆", "brown": "棕噪音", "pink": "粉噪音", "white": "白噪音", "silence": "不放声音"}
TRAITS = ["steady", "nature", "low", "rhythm", "bright"]
LANG = "en"  # set from the backup's settings.lang
MIN_BLOCKS_FOR_RECOMMENDATION = 3


def js_round(x):
    """Round half up, the way JavaScript's Math.round does."""
    return math.floor(x + 0.5)


def scene_name(scene_id):
    """The scene's name as the website shows it, in the student's language."""
    if LANG == "zh" and scene_id in ZH_NAMES:
        return ZH_NAMES[scene_id]
    return SCENES.get(scene_id, {}).get("name", scene_id)


def num(x):
    """True for a real number (JSON true/false are not numbers here)."""
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def similarity(a, b):
    dot = sum(a[k] * b[k] for k in TRAITS)
    na = math.sqrt(sum(a[k] ** 2 for k in TRAITS))
    nb = math.sqrt(sum(b[k] ** 2 for k in TRAITS))
    return dot / (na * nb) if na and nb else 0.0


def scene_report(sessions):
    scored = [s for s in sessions if num(s.get("score")) and s.get("scene")]
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
        rec = {"status": "not enough data", "ratedBlocksNeeded": MIN_BLOCKS_FOR_RECOMMENDATION - total, "scenesTried": len(rows)}
    elif len(rows) < 2:
        # every rated block used the same sound, so there is nothing to compare it with
        rec = {"status": "not enough data", "ratedBlocksNeeded": 0, "scenesTried": 1,
               "note": "Only one scene has been used. Try a second one for a couple of blocks before naming a favourite."}
    else:
        best = rows[0]
        base = SCENES.get(best["id"])
        similar = []
        if base:
            others = [(sid, similarity(base, t)) for sid, t in SCENES.items()
                      if sid not in tried and sid != "silence" and sid != best["id"]]
            others.sort(key=lambda x: -x[1])
            similar = [scene_name(sid) for sid, _ in others[:2]]
        runner_up = rows[1] if len(rows) > 1 else None
        rec = {
            "status": "ready", "best": best["name"], "bestAverageScore": best["averageScore"],
            "bestBlocks": best["blocks"],
            "confidence": "solid" if best["blocks"] >= 3 else "early (fewer than 3 blocks with this scene)",
            # a tie: the runner-up is within 3 points once small samples are evened out
            "tie": bool(runner_up and best["adjusted"] - runner_up["adjusted"] < 3),
            "runnerUp": runner_up["name"] if runner_up else None,
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
    ap.add_argument("--all", action="store_true", help="with --thoughts: every thought in the --days window, dealt with or not")
    ap.add_argument("--include-samples", action="store_true", help="count the website's example data too")
    args = ap.parse_args()
    args.days = min(args.days, 36500)
    # Chinese text and emoji must print whatever code page the terminal uses
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

    try:
        with open(args.file, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as err:
        sys.exit(f"Could not read {args.file}: {err}")
    if not isinstance(data, dict) or not isinstance(data.get("thoughts"), list) or not isinstance(data.get("sessions"), list):
        sys.exit("This does not look like a Sidenote backup (it needs 'thoughts' and 'sessions' lists).")

    # getTimezoneOffset() convention: minutes to ADD to local time to get UTC
    tz = data.get("tzOffsetMinutes")
    tz = tz if num(tz) else 0
    now = data.get("exportedAt") if num(data.get("exportedAt")) else time.time() * 1000

    # Newer backups give every record its own offset (the clocks may have changed since)
    def tz_of(record):
        own = record.get("tzOffsetMinutes")
        return own if num(own) and abs(own) <= 900 else tz

    global LANG
    settings = data.get("settings") if isinstance(data.get("settings"), dict) else {}
    all_thoughts = [t for t in data["thoughts"] if isinstance(t, dict)]
    all_sessions = [s for s in data["sessions"] if isinstance(s, dict) and num(s.get("startedAt"))]
    # The language to answer in when the student sent no message: the site's setting,
    # or failing that, whichever script most of the thoughts are written in.
    if settings.get("lang") in ("en", "zh"):
        LANG = settings["lang"]
    else:
        text = "".join(str(t.get("text", "")) for t in all_thoughts)
        cjk = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
        LANG = "zh" if text and cjk > len(text) * 0.3 else "en"

    for s in all_sessions:
        s["focusSec"] = max(0, s["focusSec"]) if num(s.get("focusSec")) else 0
        s["pauses"] = max(0, s["pauses"]) if num(s.get("pauses")) else 0
        if not (num(s.get("score")) and 0 <= s["score"] <= 100):
            s["score"] = None
        for key in ("id", "scene", "goal", "finished"):
            if not isinstance(s.get(key), str):
                s[key] = None
    sessions = [s for s in all_sessions if args.include_samples or not s.get("sample")]
    thoughts = [t for t in all_thoughts if args.include_samples or not t.get("sample")]
    sample_blocks = len(all_sessions) - len(sessions)
    sample_thoughts = len(all_thoughts) - len(thoughts)
    goal_of = {s.get("id"): s.get("goal") or "" for s in all_sessions}

    def describe(t):
        kind = t.get("category") if t.get("category") in CATEGORIES else "other"
        out = {"text": str(t.get("text", ""))[:500], "kind": kind}
        if num(t.get("createdAt")):
            out["parkedOn"] = local_day(t["createdAt"], tz_of(t))
        if goal_of.get(t.get("sessionId")):
            out["whileStudying"] = goal_of[t["sessionId"]]
        if num(t.get("offsetSec")):
            out["minuteIntoBlock"] = max(1, js_round(t["offsetSec"] / 60))
        if isinstance(t.get("reply"), dict) and t["reply"].get("text"):
            # the website already gave an answer; "ai" answers are real, "offline" ones are canned tips
            out["alreadyAnswered"] = t["reply"].get("source") == "ai"
        return out

    waiting = [describe(t) for t in thoughts if t.get("status") != "done"]
    demo_note = None
    if sample_thoughts or sample_blocks:
        demo_note = (f"{sample_blocks} example blocks and {sample_thoughts} example thoughts from the website's "
                     "demo data were left out. The website's own pages include them until the student removes them.")
        if not sessions and not thoughts:
            demo_note = "This file holds only the website's demo data, nothing the student did. " + demo_note

    # "Last 7 days" means today plus the six calendar days before it, in the student's
    # own time zone: the same window the website's summary page uses.
    if args.days <= 0:
        since = 0
    else:
        today_start = ((now - tz * 60000) // 86400000) * 86400000 + tz * 60000
        since = today_start - (args.days - 1) * 86400000

    if args.thoughts and args.all:
        start = since
        listed = []
        for t in thoughts:
            if num(t.get("createdAt")) and start <= t["createdAt"] <= now:
                d = describe(t)
                d["status"] = "dealt with" if t.get("status") == "done" else "waiting"
                listed.append(d)
        out = {"language": LANG, "thoughtsInPeriod": listed, "count": len(listed)}
        if demo_note:
            out["note"] = demo_note
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return

    if args.thoughts:
        out = {"language": LANG, "waitingThoughts": waiting, "count": len(waiting)}
        if demo_note:
            out["note"] = demo_note
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return

    waiting_now = len(waiting)
    all_real_sessions = sessions
    sessions = [s for s in sessions if since <= s["startedAt"] <= now]
    thoughts = [t for t in thoughts if num(t.get("createdAt")) and since <= t["createdAt"] <= now]

    focus_sec = sum(s.get("focusSec") or 0 for s in sessions)
    scored = [s for s in sessions if num(s.get("score"))]
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
        if num(t.get("offsetSec")):
            timing[min(9, max(0, int(t["offsetSec"] // 300)))] += 1
    timing_labels = [f"{i * 5}-{i * 5 + 5} min" for i in range(9)] + ["45+ min"]

    # only thoughts parked while the clock was running (not before the block or during a pause)
    in_block = sum(1 for t in thoughts if t.get("sessionId") and num(t.get("offsetSec")))
    planned = [s.get("plannedMin") for s in sessions if num(s.get("plannedMin"))]
    # the middle planned length (the lower of the two middle ones when the count is even)
    usual_block = sorted(planned)[(len(planned) - 1) // 2] if planned else None
    trend = None
    if len(scored) >= 4:
        ordered = sorted(scored, key=lambda s: s["startedAt"])
        half = len(ordered) // 2
        diff = (sum(s["score"] for s in ordered[-half:]) / half) - (sum(s["score"] for s in ordered[:half]) / half)
        trend = "rising" if diff >= 5 else "falling" if diff <= -5 else "steady"

    per_day = OrderedDict()
    for s in sorted(sessions, key=lambda s: s["startedAt"]):
        d = per_day.setdefault(local_day(s["startedAt"], tz_of(s)), {"minutes": 0.0, "blocks": 0})
        d["minutes"] += (s.get("focusSec") or 0) / 60
        d["blocks"] += 1
    for d in per_day.values():
        d["minutes"] = js_round(d["minutes"])

    goals = []
    for s in sorted(sessions, key=lambda s: -s["startedAt"]):
        if s.get("goal") and s["goal"] not in goals and len(goals) < 6:
            goals.append(s["goal"])

    # scenes are ranked over every rated block, not only this period: the same as the website
    scene_rows, rec = scene_report(all_real_sessions)
    finished = {"yes": 0, "partly": 0, "no": 0}
    for s in sessions:
        if s.get("finished") in finished:
            finished[s["finished"]] += 1

    out = OrderedDict([
        ("language", LANG),
        ("period", "everything" if args.days <= 0 else f"last {args.days} days"),
        ("from", local_day(since, tz) if since else (local_day(min(s["startedAt"] for s in sessions), tz) if sessions else None)),
        ("to", local_day(now, tz)),
        ("exportedOn", local_day(now, tz) if num(data.get("exportedAt")) else None),
        ("blocks", len(sessions)),
        ("focusMinutes", js_round(focus_sec / 60)),
        ("longestBlockMinutes", js_round(max([s.get("focusSec") or 0 for s in sessions] or [0]) / 60)),
        ("usualBlockLengthMinutes", usual_block),
        ("averageFocusScore", avg),
        ("focusScoreTrend", trend),
        ("plannedWorkFinished", finished),
        ("pauses", sum(s.get("pauses") or 0 for s in sessions)),
        ("goals", goals),
        ("strayThoughts", len(thoughts)),
        # only thoughts parked during a block count toward the rate; too little focus time gives no rate
        ("strayThoughtsDuringBlocksPer25Minutes", round(in_block * 1500 / focus_sec, 1) if focus_sec >= 600 else None),
        ("thoughtKinds", kinds),
        ("thoughtRange", breadth),
        ("thoughtsByMinuteOfBlock", OrderedDict(zip(timing_labels, timing))),
        ("parkedInPeriodDealtWith", sum(1 for t in thoughts if t.get("status") == "done")),
        ("parkedInPeriodStillWaiting", sum(1 for t in thoughts if t.get("status") != "done")),
        ("waitingNow", waiting_now),
        ("focusMinutesPerDay", per_day),
        ("scenes", scene_rows),
        ("scenesCover", "every rated block, not only this period"),
        ("sceneRecommendation", rec),
        ("notes", []),
    ])
    if demo_note:
        out["notes"].append(demo_note)
    if num(data.get("exportedAt")):
        age_days = int((time.time() * 1000 - data["exportedAt"]) // 86400000)
        if age_days >= 2:
            out["notes"].append(f"This backup was saved {age_days} days ago, so the period ends on {local_day(now, tz)}, not today.")
    if not sessions:
        out["notes"].append("No study blocks in this period." + ("" if args.days <= 0 else " Try --days 0 for everything."))
    elif len(scored) < 3:
        out["notes"].append("Fewer than 3 rated blocks: treat every average here as a first impression.")
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as err:  # a hand-edited or damaged file: say so in one line, no traceback
        sys.exit(f"Could not read this backup ({type(err).__name__}: {err}). "
                 "It may have been edited by hand. Ask for a fresh backup from the website's Settings page.")
