#!/usr/bin/env python3
"""The timelapse: play a whole telling under Playwright's fake clock and
film it. Virtual time drives the real playback loop - rAF, performance.now
and every setTimeout are faked - so the camera's eases, the peg's crossings
and the trail growth all advance deterministically, one captured frame per
second of story time, identical on every run, immune to throttling. The
frames become an MP4 (a 6-minute telling compresses to ~35 seconds) and a
flight recording: per-frame clock, camera and focus-marker positions, with
assertions run over the whole recording afterwards.

This is the closest thing to "watching the film" that exists without a
human: the contact sheet (tools/screening.py) judges composed stills; this
judges the playing experience.

Usage:
  python3 tools/timelapse.py <slug>                  film + recording
  python3 tools/timelapse.py <slug> --base blank     no tile host
  python3 tools/timelapse.py <slug> --slice 2        one frame per 2s

Output: screenings/<slug>-timelapse/  (git-ignored): frames/, film.mp4
(if ffmpeg is present), recorder.json, and a printed findings summary.
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from screening import serve, ROOT  # noqa: E402  (same repo, same server)

MAX_FRAMES = 1200  # ~20 minutes of story at 1s a frame; a runaway backstop


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--base", choices=["real", "blank"], default="real")
    ap.add_argument("--slice", type=float, default=2.0,
                    help="story-seconds per captured frame")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    out = Path(args.out) if args.out else ROOT / "screenings" / f"{args.slug}-timelapse"
    frames = out / "frames"
    frames.mkdir(parents=True, exist_ok=True)

    httpd, port = serve(ROOT)
    url = f"http://127.0.0.1:{port}/index.html?novel={args.slug}&screening=1"
    if args.base == "blank":
        url += "&base=blank"

    errors = []
    rec = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-angle=swiftshader"])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url)
        page.wait_for_function(
            "() => window.plotlines && window.plotlines.story", timeout=30000)
        try:
            page.wait_for_function(
                "() => window.plotlinesMap.areTilesLoaded()", timeout=20000)
        except Exception:
            pass

        # From here, time is ours. Everything the player runs on - rAF,
        # performance.now, timers - advances only when we say so. But the
        # environment also pumps frames of its own (headless screenshots
        # generate animation frames), so wall arithmetic on run_for() drifts.
        # The fix: pace on the story's OWN progress clock — advance in small
        # steps until the telling has moved exactly one slice of content
        # time, then capture. Sampling is exact by construction.
        page.clock.install()
        total = page.evaluate("() => window.plotlines.story.totalSeconds")
        page.evaluate("() => window.plotlines.story.play()")

        n = 0
        while n < MAX_FRAMES:
            target = min((n + 1) * args.slice, total - 0.05)
            for _ in range(80):  # safety: never spin forever on one frame
                done = page.evaluate(
                    "(t) => !window.plotlines.story.isPlaying() ||"
                    " window.plotlines.story.progressFraction() * "
                    f"{total} >= t", target)
                if done:
                    break
                page.clock.run_for(150)
            # Tile fetches ride the real network under fake time: give them
            # a real-time chance, then one faked frame to paint the arrivals.
            try:
                page.wait_for_function(
                    "() => window.plotlinesMap.areTilesLoaded()", timeout=2500)
            except Exception:
                pass
            page.clock.run_for(32)
            page.screenshot(path=str(frames / f"{n:05d}.png"))
            state = page.evaluate("""(total) => {
              const { map, timeline, story } = window.plotlines;
              const c = map.getCenter();
              const beat = story.currentBeat && story.currentBeat();
              const focus = beat &&
                (Array.isArray(beat.character) ? beat.character[0] : beat.character);
              let fx = null, fy = null;
              if (focus) {
                const pos = timeline.positionsAt(timeline.state.t)[focus];
                if (pos && !pos.retired) {
                  const pt = map.project(pos.lngLat);
                  fx = pt.x; fy = pt.y;
                }
              }
              return { t: timeline.state.t, lng: c.lng, lat: c.lat,
                       zoom: map.getZoom(), playing: story.isPlaying(),
                       kind: beat ? beat.kind : null, focus: focus || null,
                       beat: story.beatIndex ? story.beatIndex() : null,
                       sec: story.progressFraction() * total,
                       fx, fy };
            }""", total)
            rec.append({"i": n, **state})
            n += 1
            if not state["playing"]:
                break
        browser.close()
    httpd.shutdown()

    (out / "recorder.json").write_text(json.dumps(rec, indent=0))

    # ---- the flight recording, interrogated ----
    findings = []
    finished = rec and not rec[-1]["playing"]
    if not finished:
        findings.append(f"FIX: the telling never finished within {MAX_FRAMES} frames")

    # Camera velocity: degrees moved per story-second (real deltas from the
    # recorder, not assumed slices), flagged when fast while zoomed in — a
    # whip-pan at close zoom; wide zooms may sweep.
    whips = 0
    for a, b in zip(rec, rec[1:]):
        dt = max(b["sec"] - a["sec"], 0.25)
        d = ((b["lng"] - a["lng"]) ** 2 + (b["lat"] - a["lat"]) ** 2) ** 0.5
        if d / dt > 1.2 and b["zoom"] > 9:
            whips += 1
    if whips:
        findings.append(f"QUESTION: {whips} frame(s) of fast camera movement at close zoom")

    # Subject visibility: while a journey/scene beat has a focus character,
    # their marker should be inside the viewport (small margin allowed).
    tracked = [r for r in rec if r["fx"] is not None]
    off = [r for r in tracked
           if not (-40 <= r["fx"] <= 1320 and -40 <= r["fy"] <= 840)]
    if tracked:
        pct = round(100 * len(off) / len(tracked))
        if pct > 2:
            worst = off[0]
            findings.append(
                f"FIX: focus marker off-screen in {len(off)}/{len(tracked)} "
                f"tracked frames ({pct}%), first at frame {worst['i']} "
                f"(story day {round(worst['t'], 1)})")

    # The clock: only meanwhiles may rewind it.
    rewinds = sum(1 for a, b in zip(rec, rec[1:])
                  if b["t"] < a["t"] - 0.5 and b["kind"] not in ("meanwhile", "handoff"))
    if rewinds:
        findings.append(f"QUESTION: the clock rewound {rewinds} time(s) outside a meanwhile/handoff")

    zooms = [r["zoom"] for r in rec]
    print(f"timelapse {args.slug}: {n} frames · story finished: {finished} · "
          f"zoom {min(zooms):.1f}-{max(zooms):.1f}" if rec else "no frames")

    # ---- the film ----
    ffmpeg = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
    if Path(ffmpeg).exists() or shutil.which("ffmpeg"):
        film = out / "film.mp4"
        r = subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-framerate", "10",
             "-i", str(frames / "%05d.png"),
             "-pix_fmt", "yuv420p", "-vf", "scale=1280:-2", str(film)],
            capture_output=True, text=True)
        if r.returncode == 0:
            secs = round(n / 10)
            print(f"film: {film} ({secs}s at 10fps)")
        else:
            findings.append(f"QUESTION: ffmpeg failed: {r.stderr.strip()[:200]}")
    else:
        print("ffmpeg not found - frames kept, no film assembled")

    if errors:
        findings.insert(0, f"FIX: page errors during the run: {errors}")
    if findings:
        print("findings:")
        for f in findings:
            print(f"  {f}")
    else:
        print("findings: none - the recording is clean")
    sys.exit(1 if any(f.startswith("FIX") for f in findings) else 0)


if __name__ == "__main__":
    main()
