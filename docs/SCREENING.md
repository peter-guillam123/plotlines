# The screening room — judging how a book *looks* and *feels*

The gates guarantee a book loads, plays, and tells the truth about the
data. None of them can see the **pixels**: a marker parked under the
transport bar, a label collision, a camera framing that leaves the subject
a speck in one corner, a card that says Vienna over a map of somewhere
else. And none of them can feel **pacing**: dead air, a frozen stretch, a
metronome rhythm. The screening room covers both, in three tiers, cheap to
dear:

1. **Always-on** — `node tools/rushes.mjs data/<slug>.json`. Besides the
   truth checks, rushes now prints a `feel:` line (dead air, continental
   zoom share, beat-length spread) and warns on stillness runs, identical
   framing, A-B-A-B ping-pong and metronome rhythm. Milliseconds, no
   browser. Justify or fix every warning, as ever.
2. **Per-book screening** — the contact sheet (below), reviewed against
   the rubric by an agent or a person. Minutes per book, headless.
3. **The human watch-through** — unchanged, and still the last word. Real
   browser, 1×, end to end, as a stranger. Stills can't judge motion,
   easing or the sound bed; the editor can.

## Making the contact sheet

```
python3 tools/screening.py <slug>              # desktop pass, real tiles
python3 tools/screening.py <slug> --phone      # landscape-phone pass
python3 tools/screening.py <slug> --base blank # no tile host (CI-friendly)
```

Output lands in `screenings/<slug>/` (git-ignored): one PNG per beat —
the settled frame the player would show — plus a mid-crossing frame for
every journey, `sheet.json` with each beat's metadata and the card text as
actually rendered, and `index.html`, the contact sheet.

It drives the real page in headless Chromium (software WebGL, so it works
identically anywhere, no visible browser, no throttling). Needs Python
Playwright with Chromium — installed system-wide on the build machine; the
repo itself stays dependency-free.

## The review rubric

The reviewer reads the contact sheet **in order** and reports findings as
a table: beat, severity (fix / question), one line on the problem, one on
the suggested fix — the same register as rushes output. Do **not**
re-litigate the text-vs-map checks (mode, direction, named places — that
is gate 3's job, from the data); vision judges only what pixels show.

Per frame:

1. **Subject in frame.** The focus character's marker is visible, inside
   the safe rectangle (clear of the rail, the story card and the transport
   bar), not clipped and not a speck.
2. **Card-vs-picture truth.** The card names a place; the camera is
   plausibly on it, and at this zoom its label or pin is visible.
3. **Readable at a glance.** Narration untruncated; place labels not
   colliding with each other or with markers; nothing important under UI
   furniture.
4. **Meaningful zoom.** Not a featureless close-up of empty parchment; not
   a whole-continent shot for a walk across town; a journey's route
   visibly enters and leaves the frame.
5. **Base map present.** Real tiles (or the declared blank base), no
   unloaded squares, the NLS overlay where Britain is in shot.
6. **Emphasis correct.** The highlighted route matches the focus
   character's colour; retired characters' hollow marks aren't dragging
   the eye; the mid-crossing frame shows the peg ON its route.

Per sequence (read the sheet in runs of a dozen):

7. **Framing variety.** Three-plus consecutive near-identical frames reads
   as a stopped page (rushes flags the geometric case; vision catches the
   visual one).
8. **Camera grammar.** A journey's settled and mid-crossing frames should
   read as different pictures — establish, cross, arrive. If they look the
   same, the choreography failed for that leg.
9. **Continuity.** Trails only ever grow; no marker visually teleports
   between adjacent frames without a journey beat between them.
10. **Progress furniture.** The bar's fill, the odometer and the chapter
    heading advance frame over frame — and agree with the card. (Known
    seam, found on this rubric's first outing: at a journey's end the
    bar's clock-driven chapter heading can run ahead of the card's.)

## What screening cannot do

Stills cannot judge easing, dwell, the cross-fade, or sound. A green
screening pass earns a book the editor's watch-through; it never replaces
it. And the honesty checks stay where they were: rushes and gate 3 own the
data's truth, `tools/images.mjs` owns the picture decisions.

Known harness artefacts a reviewer should not report as bugs (learned on
the rubric's first outing, Jane Eyre):

- **A journey's settled still holds the route framing** with the peg
  arrived; the player's final push-in to the destination is motion, seen
  in the timelapse film and the watch-through, never in the sheet.
- **The mid-crossing frame's odometer shows the arrival figure** — the
  still is composed for geometry, not the ticker.
- **The faint full route web on early frames is furniture**, deliberate:
  ghost mode sketches the whole journey ahead; trails are the record of
  travel and only ever grow.
- **Retired discs are small hollow rings** — zoom before reporting a dead
  character as still alive; at contact-sheet size a ring reads solid.
