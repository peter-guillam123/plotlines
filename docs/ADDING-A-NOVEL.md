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
  engraving* of the actual place. No `indicative` flag.
- **Conjectured (imagined) place** → there is nothing to photograph, so
  use a *period painting of the real country the fiction is anchored to*
  (the Carpathians for Castle Dracula), and set `"indicative": true` — it
  gets an "Indicative" corner badge and reads as mood, never as record.
  If a fictional place has no evocative real region (a nondescript London
  villa), **use no image** rather than a generic one.

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
   spot clear of the sheet; the historic overlay shows over Britain. Then
   a mobile pass.
7. **Write the script** — the novel's `story` array of narrated beats, per
   `STORYTELLING.md` (the rubric) and its screening loop (draft → rushes →
   watch-through). The dataset records what is true; the script decides
   how it is told. A novel isn't finished without both.
8. **Update** the About page (a diary entry + any new attribution) and add
   the shelf entry to `data/novels.json` with first-edition spine colours.

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
- **Dev-loop gotcha:** the preview browser caches ES modules hard. After
  editing JS, prime the changed files (`fetch(p,{cache:'reload'})`) before
  reloading, or verify against the *served* file with `curl` — a stale
  module will fool you into thinking a fix didn't land.

---

*This document is the source of truth for how a novel is added. If a rule
here ever conflicts with older prose in the README or the About page,
this wins — and fix the other.*
