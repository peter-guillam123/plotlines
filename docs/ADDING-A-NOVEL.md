# Adding a novel

The playbook for turning an out-of-copyright novel into a PlotLines
dataset that gets the best possible first pass — with all the lessons the
existing four books taught us baked in, so none of them has to be
re-discovered.

Read this before starting a new book. The behaviour (camera, routes,
images, badges) is already in the code and applies to any dataset
automatically; what this document carries is the **judgement** — how to
fill the data honestly — which no code can enforce.

The one rule underneath everything: **every claim on the map is badged for
how much we actually know, and the novel's own words always outrank our
cleverness.** If you remember nothing else, remember that.

---

## 1. The shape of a novel

One hand-written JSON file per book in `data/<slug>.json`, plus a shelf
entry in `data/novels.json`. The loader (`js/data.js`) validates on
startup and names the offending entry; structural slips throw, content
gaps warn. Enums live in `js/constants.js` — that file is the source of
truth for allowed values, this document explains them.

### Top level

```jsonc
{
  "title": "...", "author": "...", "year": 1850,
  "gutenbergId": 766,
  "overture": "One or two sentences: the sweep of the whole book, shown before Start.",
  "mapHome": { "bounds": [[west, south], [east, north]] },   // REQUIRED — see traps
  "timeline": { "epoch": "1893-05-03", "calendar": true, "span": 30, "unit": "days" },
  "sources": [ "scholarship the pins lean on — see Tess" ],
  "regions": [ { "id": "...", "name": "..." } ],   // groups places in Explore
  "chapters": [ { "n": 1, "title": "...", "day": 0, "when": "his birth" } ],
  "characters": [ ... ],
  "locations": [ ... ],
  "movements": [ ... ]
}
```

- **`mapHome.bounds`** frames the overture (the whole-story opening shot).
  Set it to the country the story *mostly* lives in, **not** the full
  extent — otherwise a single far journey (an emigration to Australia)
  zooms the opening out to the globe. `[lng, lat]` order, `[[SW],[NE]]`.
- **`timeline`** drives the story clock.
  - Dated novels: `epoch` = the day chapter 1 begins (ISO date),
    `calendar: true` — the clock ticks real dates (Dracula, P&P).
  - Undated novels: `epoch: null, calendar: false` — the clock shows the
    nearest chapter's `when` life-stage label plus "about N years in"
    (Tess, David Copperfield).
- **`chapters[].day`** is the day-offset from the epoch where the chapter
  begins (the timeline axis is *days*, not chapter position). `when` is a
  short life-stage phrase for undated books.

### Characters

```jsonc
{ "id": "david", "name": "David Copperfield", "colour": "prussian",
  "role": "one line", "start": { "location": "blunderstone" } }
```

- `colour` must be a key in `CHARACTER_COLOURS` (constants.js) — period
  inks and dyes, not neon.
- `start.location` must exist. Every character's movements must form a
  continuous chain from `start` (the validator catches teleports).
- **The disc monogram is two initials — first name + last name** — so
  Fitzwilliam Darcy reads **FD**, not a lonely F. It is derived
  automatically (`characterInitial` in `js/ui/format.js`): a leading title
  is dropped so the monogram is the person, not the honorific (Count
  Dracula → D, Professor Van Helsing → VH), and a single-name character
  keeps one letter (Danglars, Haydée). Where the automatic pair reads wrong
  — a name whose salient words aren't first-and-last — set an explicit
  `"initials"` on the character to override it (Lady Catherine de Bourgh →
  `"initials": "LC"`, not the derived CB). Check each cast's monograms as
  you build: two letters must be unambiguous *within that book* and sit
  cleanly on the disc.

### Locations

```jsonc
{ "id": "whitby-crescent", "region": "whitby",
  "name": "Royal Crescent, Whitby",        // the real, modern name
  "novelName": "the Crescent",             // how the book names it (the hover title)
  "coords": [-0.6175, 54.489],             // [lng, lat] — GeoJSON order
  "certainty": "real",                     // see §2
  "note": "why this spot (required for anything not `real`)",
  "story": "what happens here (every place should have one)",
  "quote": "the book's own words", "quoteRef": "Ch. 6",
  "image": { ... }                         // optional, see §4
}
```

### Movements

```jsonc
{ "character": "lydia",                     // string, or an array for a shared journey
  "from": "longbourn", "to": "newcastle",
  "chapter": 53, "mode": "coach",           // foot|horse|coach|train|ship|unknown
  "days": 3,                                // duration of the leg (drives real-time pace)
  "startDay": 64,                           // optional: explicit day for out-of-order events
  "via": [ ... ],                           // optional shaping/staging points, see §3
  "note": "the story of the leg (shown in the caption)",
  "routeNote": "...", "routeSource": "...", "routeCertainty": "documented"   // if `via` is fleshed
}
```

`character` as an **array** (`["emly","mrpeggotty","micawbers"]`) is a
shared journey — one movement, several travellers, drawn as parallel
strands. `days` is the leg's real duration: the engine plays journeys at
true relative length and fast-forwards the rests.

---

## 2. Place certainty — the first hierarchy

`certainty` on every location. This is not decoration; it changes how the
pin and its routes render, and it is the reader's guarantee.

| value | means | renders |
|---|---|---|
| `real` | a real, precisely locatable place | solid ink dot |
| `identified` | a real place the book names obliquely ("Kingstead" = Highgate) | solid ink dot |
| `conjectured` | fictional; the position is our best guess | **hollow ring**, and every route touching it is **dashed** |

Anything not `real` **must** carry a `note` explaining the reasoning. A
conjectured pin says "best guess" in its card and invites correction.
When in doubt, mark down, not up.

---

## 3. Route provenance — the second hierarchy (and the important one)

A journey drawn as a straight line from A to B tells a lie: the coach to
Newcastle ground up the Great North Road, it didn't fly over Yorkshire.
So longer trips get `via` waypoints that follow the real ground. A `via`
entry is **either**:

- a bare `[lng, lat]` — an unnamed shaping point (just bends the line), or
- `{ "at": [lng, lat], "name": "Grantham", "note": "..." }` — a **named
  staging post**. Named stops bead on the map and announce themselves
  ("through Grantham") when you ride along with a character.

Any movement with named stops declares its provenance with three fields,
and the confidence is badged on hover. **The hierarchy, text first:**

| `routeCertainty` | means | badge |
|---|---|---|
| `novel` | the author names the path themselves | filled "From the novel" |
| `documented` | a real named source the book doesn't spell out (Cary's *New Itinerary*, a rail line) | outlined "Documented route" |
| `reconstructed` | period-plausible but assembled; no single source names it whole | dashed "Reconstructed" |
| `illustrative` | the text is genuinely vague; drawn as a gesture | dashed "Illustrative" |

**The rules, in order of importance:**

1. **The text beats the atlas.** Where the author names the way — David's
   runaway walk, the Demeter's logged voyage, Elizabeth's tour ("Oxford,
   Blenheim, Warwick, Kenilworth, Birmingham") — that is `novel`, and no
   research is allowed to overrule it. A route counts as `novel` if its
   *defining* turns come from the text, even where we add connective
   points between them (the Demeter's capes).
2. **Don't invent precision.** If the book only names the endpoints, the
   path is `documented` at best — and if the record is genuinely thin
   (Mr Peggotty wandering Europe), leave it `illustrative` and few, rather
   than faking a town-by-town itinerary. A gesture honestly flagged beats
   a confident lie.
3. **`routeSource` cites the actual source** — the chapter for `novel`,
   the itinerary or line for `documented`, "no route named in the text —
   reconstructs…" for the softer tiers.
4. **Short trips need nothing.** If every leg is under ~60 km (Tess's
   Wessex walks), straight lines are honest. Don't flesh what doesn't need
   it.

### Transport modes and how they route

`mode` is `foot | horse | coach | train | ship | unknown`. It picks the
travel icon and shapes how you research the path:

- **coach / horse** → the turnpike network. A rider used the same
  maintained roads as the coaches (that's where the surface and the
  posting inns were), so route them the same; a lone rider may clip a
  corner the coach road looped around. Sources: Cary's *New Itinerary*,
  Paterson's *Roads* — they list every staging town on every road.
- **train** → the *period-correct* line. A train is on rails, so once you
  know the company's route there's little ambiguity — but get the decade
  right (a junction that opened in 1875 can't be on an 1850s journey).
  Bradshaw's *Railway Guide* (and the Continental Bradshaw) is the source.
- **ship** → the period sailing track, which is where anachronism bites
  hardest. **The trap:** the deep Roaring-Forties great-circle clipper
  route to Australia was only promoted from ~1852 — for an 1840s voyage
  the correct passage rounds the Cape of Good Hope and keeps north of the
  40th parallel. Always check the route against the book's decade, not the
  most famous version of it.

### Checking the drawn line — the spill detector

An arc is blind to coastlines, so a land leg can clip a sea and a sea leg can
clip a headland. `node tools/route-spill.mjs [data/<slug>.json]` samples each
drawn path against a coarse land polygon and flags any leg whose *contiguous*
wrong-medium run is long enough to be a real lie (a train across the Adriatic,
a steamer cutting the Malay peninsula) rather than an honest short hop (the
Channel, a harbour mouth). It also runs inside `rushes`, so a spill shows up
in the standard gate. Fix a flag by adding `via` points that hug the real
coast, road or shipping lane — the same lever as route provenance. Two honest
exceptions the tool already ignores: a `sledge` leg (its medium is snow and
sea-ice, not the land/water binary), and a **river-boat**, which runs through
land by design — mark such a `ship` leg `"medium": "river"` (the Rhine, the
Sereth up to the castle) and the detector leaves it alone.

### Making a river leg follow the river — the river-tracer

`medium: "river"` stops the detector complaining, but the leg is still *drawn*
as the usual sparse polyline — which on a long, winding river (the Congo up to
Kurtz) cuts straight across the land instead of following the water. Where the
river *is* the story, trace it. `node tools/river-trace.mjs "<River[,River2…]>"
<lng,lat> <lng,lat> [--eps KM]` loads Natural Earth's public-domain river
centrelines (named rivers, vendored in `tools/data/`), finds the named river,
walks the shortest path along the water between the two endpoints, simplifies
it (Douglas–Peucker, `--eps` in km) and prints a paste-ready chain of `via`
coordinates. Bake those into the leg's `via` (keep `medium: "river"`); label
the handful of real ports/stations along it as `{ "at": …, "name": … }` beads
and leave the rest as bare shaping points. It is author-time only — the runtime
still just draws the polyline. Caveat: the centreline is generalised at map
scale, so it follows the river convincingly but not every oxbow. Reusable for
any river book (the Mississippi, the Nile, the Volga).

### Timing converging paths — the near-miss class

Most books are one person going somewhere. A few are the opposite: two or
more people crossing the same ground over a single day, forever just
missing each other — Bloom and Stephen around Dublin, Clarissa and Septimus
across London. The near-miss is the whole point of such a book, and it is
**told, not computed**: a finished route already stays drawn faintly, so one
character's bright path visibly crosses another's dimmed one, and the script
names the coincidence in the pane. No new machinery — but two data
disciplines the ordinary books don't need:

1. **Time the movements honestly.** When the story collapses to a single
   day the clock runs in hours, so `startDay` and `days` become *fractional*
   days (8 a.m. is `0.333`; a forty-minute walk is `0.028`). The timeline
   axis is already real-valued, so this needs no new field — but the numbers
   must be *true*, because a crossing the narration later asserts has to
   actually happen at those positions and those times. Both candidate novels
   hand you the clock: Ulysses is timed to the minute in the topographical
   guides, and Dalloway has Big Ben striking the hours as a motif.
2. **Find the crossings before you script.** For each pair of characters,
   list the places they both pass and how far apart in time — those
   coincidences are the beats worth writing. (A helper could list them from
   the timed data; build it only once we're past the first such book.)

Where the record won't support a precise time, don't manufacture one:
narrate the crossing softly ("earlier that morning") rather than fake a
false "twenty minutes". The honesty spine holds here too.

---

## 4. Images — the third hierarchy

A place may carry one image (shown in the card, sheet only). Same honesty
spine: **the image type tracks the place's certainty.**

```jsonc
"image": {
  "file": "assets/images/whitby.jpg",
  "caption": "Whitby harbour and the abbey from the East Cliff, photographed c.1890",
  "credit": "Detroit Publishing Co. photochrom · Library of Congress · public domain",
  "indicative": true   // omit for real places; true for a stand-in painting
}
```

- **Real / identified place** → a *contemporaneous photograph or
  engraving* of the actual place. No `indicative` flag. (A real place under
  an invented name whose exact spot can't be honestly pictured — Marlott is
  Marnhull — may use an indicative regional view instead; that's allowed.)
- **Conjectured (imagined) place** → there is nothing to photograph, so
  use a *period painting of the real country the fiction is anchored to*
  (the Carpathians for Castle Dracula), and set `"indicative": true` — it
  gets an "Indicative" corner badge and reads as mood, never as record.
  If a fictional place has no evocative real region (a nondescript London
  villa), **use no image** rather than a generic one.

**Every place is a decided question.** A location either carries an `image`,
or records a considered blank so the decision is in the data, not lost:

```jsonc
"imageBlank": "the only period image of Galatz is a Roma genre study, not a view of the town"
```

A location with *neither* is **unreviewed** — the picture pass hasn't been
done for it, and the book isn't finished. The gate below is what makes that
visible instead of silently forgotten.

**Reusing an image is fine — for the same real place, across books.** If
Regent's Park turns up in two novels and one good period view honestly serves
both, use it in both: a reader only ever sees one book, so there's no visible
repetition, and neither book carries a needless blank. What is *not* allowed
is one image standing in for two *different* places, or the same image on two
cards *within one book* — that reads as a mislabel or as filler. The gate
flags the within-book case; the cross-book case is a positive and the gate
leaves it alone.

Sourcing rules, non-negotiable:

- **Public domain only** (pre-1930, or an explicit PD/CC0 tag). Reject
  anything NC / fair-use / unclear. 19th-century paintings and photographs
  are overwhelmingly clear; galleries (LoC, the Met, Rijksmuseum, Tate,
  NGV) publish open-access scans.
- **Commit the file into `assets/images/`. Never hotlink** — hotlinking
  leaks readers' IPs to third parties and rots. Download (Wikimedia
  `Special:FilePath/<file>?width=1200` renders a JPEG even from a TIFF),
  keep it ~1200px, and add it to the repo.
- **Look at it before you commit it.** Open the downloaded file and
  confirm it depicts what the caption claims. This is the honesty check
  that can't be automated.
- Full attribution goes in the card `credit` **and** the About page.

**A helper for the search half.** `node tools/image-candidates.mjs "<place
+ period query>"` queries Wikimedia Commons, keeps only public-domain / CC0
files, and prints each with its licence, source page and provenance — the
tedious search-and-filter, done. It does NOT pick or commit: you still open
each candidate and confirm it is really the place and really the period
(the search returns noise — a bond certificate for "San Francisco", a
modern cross-section diagram for "Suez"), then download the full file, crop
if needed, and record the attribution. Sharpen a vague query with a date or
a landmark ("Suez Canal 1869", "San Francisco 1878 panorama"). The
assistant can view the thumbnails and do the honesty pass itself, then
surface a shortlist for the editor to choose from.

**The gate.** `node tools/images.mjs data/<slug>.json` reports, per place,
*placed · blank · unreviewed*, and exits non-zero while anything is
unreviewed. It also checks the files are in the repo (never hotlinked) and
that no invented place shows a real photo of itself. Run it with no argument
to sweep the whole shelf. `rushes` prints the same one-line tally on every
run, so the picture step can't quietly drop off — the failure mode this gate
exists to prevent.

---

## 5. The build process

The pipeline that produced the honest datasets, in order:

1. **Research.** Fan out (parallel agents work well): the cast and their
   journeys; each place's real/identified/conjectured position with
   scholarship; each fleshed route's period path with sources. Keep the
   endpoints you'll use fixed so the research connects.
2. **Curate** into the JSON, applying §§2–4. One book, one file.
3. **Verify quotes** — fetch the Gutenberg text and string-match every
   `quote` verbatim; fix or cut anything that isn't there word for word.
4. **Audit routes against the text** — for every fleshed route, ask *does
   the book name this path?* Promote the genuinely text-named ones to
   `novel`; confirm nothing external contradicts a detail the author gave.
   (This audit caught David being robbed on the wrong road.)
5. **Validate** — load it; `js/data.js` throws on structural slips and
   warns on content gaps. Fix every throw; read every warn.
6. **Verify in the browser** — it boots without a boot-error banner; the
   overture frames the home country (not the globe); concurrent journeys
   overlap; any global voyage stays in frame; a place card centres its
   spot clear of the sheet; the historic overlay shows over Britain; and
   two characters travelling together show as two discs side by side, not
   one. **PlotLines is desktop-only** — no mobile pass (a project decision;
   it overrides the global mobile rules).
7. **Write the script** — the novel's `story` array of narrated beats, per
   `STORYTELLING.md` (the rubric) and its screening loop (draft → rushes →
   **text-vs-map check** → **completeness check** → watch-through). The
   dataset records what is true; the script decides how it is told. The
   completeness check is the one that asks what major beat — often a
   non-travel one, invisible to the mechanical gates — has been *missed*
   (it is why P&P nearly shipped without Mr Collins). A novel isn't finished
   without both an honest dataset and a watchable, complete script.
8. **Images** — the picture pass (§4). Give every place either an image or a
   considered `imageBlank`; run `node tools/images.mjs data/<slug>.json`
   until nothing is unreviewed. This is a step of the build, not an optional
   afterthought — it lives here so it can't be skipped.
9. **Update** the About page (a diary entry + any new attribution) and add
   the shelf entry to `data/novels.json` with first-edition spine colours.

**The four hard gates** (a book that fails any does not ship): it **loads**
(`js/data.js` throws on structural slips); **rushes is clean**
(`errors: 0`); the **text-vs-map check** passes (a reviewer confirms
every beat's narration matches the route the map draws — mode, land/sea,
named places, direction, scene placement, shared-vs-solo; see
`STORYTELLING.md`'s screening loop); and **images are reviewed**
(`tools/images.mjs` shows `0 unreviewed` — every place imaged or a logged
blank). Three are deterministic and run headlessly; the text-vs-map check
needs an agent's judgement, and the *content* of each image needs a human's
eye (is it really the place, is it really public domain) — the gate enforces
that the decision was made, not that the picture is honest. That last part is
still yours.

---

## 6. Traps we already paid for (don't re-discover these)

- **Declare `mapHome` or the overture zooms to the globe.** A far outlier
  (an emigration) blows out the auto-fit. (The validator warns if missing.)
- **The camera now handles global voyages** — the director's zoom floor is
  0, so a trans-oceanic leg frames England and the destination together.
  No per-novel work needed; just don't reintroduce a floor.
- **Coordinate order is `[lng, lat]`.** A pin in the sea off Somalia means
  you swapped them. (The validator range-checks.)
- **JSON house style differs per file.** `david-copperfield.json` is fully
  expanded (round-trips through `json.dumps(indent=2)`); the others keep
  coord arrays and via-entries compact on one line. When injecting data by
  script, **don't `json.dump` a compact file** — it explodes every array
  and buries your real change in a 1000-line diff. Insert surgically, or
  match the file's existing style.
- **The NLS historic overlay is Great Britain only.** European and sea
  legs sit on the sepia base; that's expected, and the place image carries
  the visual there.
- **Overlay period.** The default overlay is the 1885–1903 OS survey; for a
  Regency or earlier book that's an anachronism to declare on About (the
  OS Old Series exists but isn't yet servable as a seamless layer).
- **A single-day book runs the clock in hours — verify the ticker.** The
  timeline axis is real-valued, so fractional-day movements *play* fine, but
  the clock/ticker (`js/ui/format.js`) has only ever shown calendar dates and
  life-stage phrases; confirm it renders a sub-day time sensibly, or lean on
  the beat narration to carry the hour, before relying on it. Untested until
  the first single-day novel (see §3, the near-miss class).
- **The NLS overlay is Great Britain only — Ireland is not on the bucket.**
  London serves at street zoom, but Dublin 404s across every Irish layer name
  on the keyless `mapseries-tilesets` bucket (probed). A Dublin book renders
  on the sepia vector base but has no genuine period paper under it until an
  Irish tile source is found — a research task, not a given.
- **Dev-loop gotcha:** the preview browser caches ES modules hard. After
  editing JS, prime the changed files (`fetch(p,{cache:'reload'})`) before
  reloading, or verify against the *served* file with `curl` — a stale
  module will fool you into thinking a fix didn't land.
- **A route must match its mode and its narration.** The commonest content
  bug is a `via` copied from the wrong journey: Mr Peggotty's *walk* across
  France once carried the elopement's Gibraltar sea-track, and David's
  overland Swiss exile was tagged `ship`. The text-vs-map check (screening
  loop step 3) exists to catch exactly this — run it.
- **A scene needs an integer `chapter`.** The loader and rushes both reject
  a chapterless scene now. If a place-moment falls mid-journey (a
  perpetually-moving character like Fogg), make it a `handoff` — no chapter,
  no resting check — rather than a chapterless scene.
- **Shared journeys are one line, not two.** When characters genuinely
  travel together, give them one movement with an array `character` and a
  matching array-character beat — don't leave two parallel legs (David and
  Steerforth once rode to Yarmouth on separate lines). But leave *apart* the
  ones that only look shared: a pursuit, a funeral, converging-by-different-
  means, or the same route on different days (Jane rides to Netherfield,
  Elizabeth walks it the next morning). And separate movements alone isn't
  enough: two characters on the same leg in the same chapter with no explicit
  `startDay` derive the *same* time and travel in lockstep, so a pursuer
  glides beside his quarry like a companion. Give the second an offset
  `startDay` that fits the story — a follower who trails (a little later), a
  watcher already waiting at the destination (earlier, so he is resting there
  when she arrives), or a next-day journey (Jane rides day 44, Elizabeth walks
  day 45). Alec never travels *with* Tess; he lies in wait ahead or trails
  behind.
- **Don't lodge two characters at one node when the book gives them
  different addresses.** A single "London" pin quietly sends everyone to the
  same doorstep. Darcy once shared the Gardiners' Cheapside house (Gracechurch
  Street) because it was the only London node — the proudest man in the book
  parked at the very trade-district address he sneers at. Where the novel
  distinguishes them — a fashionable West End house against a City street —
  give them distinct pins, even when one is unlocated and `conjectured`. The
  class geography *is* the plot.
- **A leg crossing the antimeridian** (a trans-Pacific voyage) needs its
  `via` longitudes to step across the 180° line going the intended way
  (e.g. 145 → 165 → 180 → −165 → −140), or the line lunges backward across
  the map. The geometry engine's great-circle densification then draws it
  correctly — but **verify that crossing in the browser**; it is the one
  route that can silently draw the wrong way round the world.
- **A new conveyance means a new mode.** The mode enum is in `js/data.js`
  and the glyphs in `js/ui/modeicons.js`; add both rather than forcing an
  odd fit (the `elephant` and wind-`sledge` modes were added for Eighty
  Days). One caveat left open: that sledge glyph is a *wind*-sledge (a sail
  on a runner) — a dog-sledge (Frankenstein's Arctic) reuses it and could
  earn its own variant.

---

*This document is the source of truth for how a novel is added. If a rule
here ever conflicts with older prose in the README or the About page,
this wins — and fix the other.*
