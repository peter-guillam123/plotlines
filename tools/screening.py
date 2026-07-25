#!/usr/bin/env python3
"""The screening room: render every beat of a telling to a still, exactly as
the player will show it, and bind the stills into a contact sheet a reviewer
(human or agent) can read against docs/SCREENING.md.

The page runs in headless Chromium with software WebGL, so this works the
same on any machine and needs no visible browser. Stepping is done PAUSED:
a paused step applies each beat's camera instantly and seats a journey's peg
at the leg's end, so every frame is the settled composition a reader would
see. Journey beats also get a mid-crossing frame via the app's renderAt()
hook, with the peg halfway along the leg.

Usage:
  python3 tools/screening.py <slug>            desktop pass (1280x800)
  python3 tools/screening.py <slug> --phone    landscape-phone pass (844x390)
  python3 tools/screening.py <slug> --base blank   plain base (no tile host)

Output: screenings/<slug>/  (git-ignored) — beat stills, sheet.json with
every beat's metadata and card text, and index.html, the contact sheet.

Requires: playwright for Python with Chromium installed (both already on
this machine; the repo itself stays dependency-free).
"""

import argparse
import functools
import http.server
import json
import socketserver
import sys
import threading
from html import escape
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(root):
    handler = functools.partial(QuietHandler, directory=str(root))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def wait_tiles(page):
    try:
        page.wait_for_function(
            "() => window.plotlinesMap.areTilesLoaded()", timeout=20000)
    except Exception:
        pass  # a missing tile is itself worth seeing on the sheet


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", help="novel slug, e.g. dracula")
    ap.add_argument("--phone", action="store_true",
                    help="screen the landscape-phone layout (844x390, touch)")
    ap.add_argument("--base", choices=["real", "blank"], default="real",
                    help="blank skips the tile host (CI-friendly)")
    ap.add_argument("--out", default=None, help="output directory")
    args = ap.parse_args()

    out = Path(args.out) if args.out else ROOT / "screenings" / (
        args.slug + ("-phone" if args.phone else ""))
    out.mkdir(parents=True, exist_ok=True)

    httpd, port = serve(ROOT)
    url = f"http://127.0.0.1:{port}/index.html?novel={args.slug}&screening=1"
    if args.base == "blank":
        url += "&base=blank"

    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-angle=swiftshader"])
        if args.phone:
            ctx = browser.new_context(
                viewport={"width": 844, "height": 390}, has_touch=True)
        else:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))

        page.goto(url)
        page.wait_for_function(
            "() => window.plotlines && window.plotlines.story", timeout=30000)
        wait_tiles(page)

        # The script's own metadata: the raw beats plus the resolved marks
        # (with each journey's day-span for the mid-crossing frame).
        meta = page.evaluate("""() => {
          const { novel, story } = window.plotlines;
          const marks = story.beatMarks();
          const name = (id) => novel.locationsById[id]?.novelName || id;
          return {
            title: novel.title,
            beats: novel.story.map((b, i) => ({
              i, kind: b.kind, chapter: b.chapter || null,
              title: b.title || null, narration: b.narration,
              at: b.at ? name(b.at) : null,
              from: b.from ? name(b.from) : null,
              to: b.to ? name(b.to) : null,
              mode: b.mode || null,
              character: [].concat(b.character || []).join(', '),
              t0: marks[i].t0, t1: marks[i].t1,
            })),
          };
        }""")
        beats = meta["beats"]
        print(f"screening {meta['title']}: {len(beats)} beats "
              f"({'phone' if args.phone else 'desktop'}, {args.base} base)")

        sheet = []
        for b in beats:
            i = b["i"]
            # showFirst() for the first beat, then paused steps.
            if i == 0:
                page.evaluate("() => window.plotlines.story.showFirst()")
            else:
                page.evaluate("() => window.plotlines.story.step(1)")
            wait_tiles(page)
            page.wait_for_timeout(250)  # marker/label settle
            card = page.evaluate("""() => ({
              kicker: document.querySelector('.story-clock')?.textContent || '',
              title: document.querySelector('.story-title')?.textContent || '',
              narration: document.querySelector('.story-narration')?.textContent || '',
            })""")
            frame = f"beat-{i + 1:03d}.png"
            page.screenshot(path=str(out / frame))
            entry = {**b, "frame": frame, "card": card}

            # A journey's paused step seats the peg at the leg's END; the
            # mid-crossing composition is a different picture and lies
            # differently, so it gets its own still.
            if b["kind"] in ("journey", "removal") and b["t0"] is not None \
                    and b["t1"] is not None and b["t1"] > b["t0"]:
                mid = (b["t0"] + b["t1"]) / 2
                page.evaluate(
                    "(d) => window.plotlines.renderAt(d, { camera: false })", mid)
                page.wait_for_timeout(150)
                midframe = f"beat-{i + 1:03d}-mid.png"
                page.screenshot(path=str(out / midframe))
                entry["midframe"] = midframe
                # Reseat the peg so the next beat steps from a true state.
                page.evaluate(
                    "(d) => window.plotlines.renderAt(d, { camera: false })",
                    b["t1"])
            sheet.append(entry)

        browser.close()
    httpd.shutdown()

    (out / "sheet.json").write_text(json.dumps(
        {"title": meta["title"], "slug": args.slug, "phone": args.phone,
         "beats": sheet}, indent=1))

    # ---- the contact sheet ----
    cells = []
    for e in sheet:
        head = f"{e['i'] + 1}. {e['kind']}"
        if e["chapter"]:
            head += f" · ch. {e['chapter']}"
        if e["title"]:
            head += f" · {escape(e['title'])}"
        route = ""
        if e["from"]:
            route = f"<p class='route'>{escape(e['from'])} → {escape(e['to'])}" + \
                (f" · {escape(e['mode'])}" if e["mode"] else "") + "</p>"
        elif e["at"]:
            route = f"<p class='route'>at {escape(e['at'])}</p>"
        mid = (f"<figure><img loading='lazy' src='{e['midframe']}'>"
               f"<figcaption>mid-crossing</figcaption></figure>"
               if e.get("midframe") else "")
        cells.append(f"""
    <section class="beat">
      <h2>{escape(head)}</h2>
      {route}
      <p class="narr">{escape(e['narration'] or '')}</p>
      <div class="frames">
        <figure><img loading="lazy" src="{e['frame']}">
          <figcaption>settled</figcaption></figure>
        {mid}
      </div>
    </section>""")

    (out / "index.html").write_text(f"""<!doctype html>
<meta charset="utf-8">
<title>Screening — {escape(meta['title'])}</title>
<style>
  body {{ font: 14px/1.45 Georgia, serif; margin: 24px; background: #f4ecd9; color: #2e2417; }}
  h1 {{ font-weight: normal; }}
  .beat {{ margin: 26px 0; padding-top: 14px; border-top: 1px solid #c9b98f; }}
  .beat h2 {{ font-size: 15px; margin: 0 0 2px; }}
  .route {{ margin: 0; font-style: italic; color: #6b5d42; }}
  .narr {{ max-width: 62em; color: #4a3d28; }}
  .frames {{ display: flex; gap: 12px; flex-wrap: wrap; }}
  figure {{ margin: 0; }}
  img {{ max-width: 560px; width: 100%; border: 1px solid #c9b98f; }}
  figcaption {{ font-size: 12px; font-style: italic; color: #6b5d42; }}
</style>
<h1>Screening — {escape(meta['title'])} ({len(sheet)} beats{', phone' if args.phone else ''})</h1>
<p>Review against docs/SCREENING.md. Every still is the settled frame the
player shows; journeys also carry a mid-crossing frame.</p>
{''.join(cells)}
""")

    if errors:
        print("PAGE ERRORS during screening:", *errors, sep="\n  ")
        sys.exit(1)
    print(f"wrote {len(sheet)} beats → {out}/index.html")


if __name__ == "__main__":
    main()
