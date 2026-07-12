# Storytelling — how a novel's script is written

The map data (places, movements, timelines) records what is *true*. The
**script** decides how it is *told*. Story mode plays the script: an
ordered sequence of beats written for a viewer who has never read the
book. This document is the rubric every script is written and screened
against. It sits beside `ADDING-A-NOVEL.md` (the data playbook); a novel
isn't finished until it has both an honest dataset and a watchable
script.

## The first law: text gets the time it needs

Every word shown on screen must be readable at a comfortable pace before
anything changes. The content of a beat is timed from reading time
(`READ_BASE_SECONDS + READ_PER_WORD_SECONDS × words`, floor
`BEAT_MIN_SECONDS`, in `js/constants.js`) — never from a target runtime.
The story takes as long as it takes; pace belongs to the reader, who has
the speed control and the step buttons. If a script feels long, cut
words, not seconds.

Each beat plays as a short sequence of **phases** (see `js/story.js`), so
the eye is never asked to read and chase at once: the camera does its move
*first* (a zoom always completes before a peg starts moving), *then* the
content window opens — a scene simply holds for its reading time, a journey
lets the traveller cross the route just framed, and a journey then pushes in
on the place reached and dwells there a moment. The very first beat gets a
slow "living" push-in — the map drifts gently inward through the reading, so
an opening scene breathes rather than freezes.

## The beats

A novel's script is a `story` array in its JSON. Five kinds:

```jsonc
// SCENE — no travel. The camera settles on a place; the card narrates
// what happens there. This is how stationary years get story instead of
// silence (a childhood, a courtship, an illness).
{ "kind": "scene", "character": "david", "at": "blunderstone", "chapter": 2,
  "title": "The firm hand",                       // optional short heading
  "narration": "His mother marries the cold Mr Murdstone. The house learns silence." },

// JOURNEY — a travel leg plays. Must match a real movement in the data
// (same character, from, to, chapter) — the validator refuses a journey
// that points at nothing. After the camera frames the route, the traveller
// crosses it (at least as long as the narration takes to read), then the
// camera pushes in on the place reached.
{ "kind": "journey", "character": "david", "from": "warehouse", "to": "dover", "chapter": 13,
  "narration": "Robbed before he is even out of London, David walks the whole Dover road to throw himself on the mercy of an aunt he has never met." },

// REMOVAL — a relocation the book doesn't narrate as a journey: a quick
// glide rather than a performed voyage, with a plain legend. Same fields
// and matching rule as a journey.
{ "kind": "removal", "character": "micawbers", "from": "windsor-terrace", "to": "canterbury", "chapter": 36,
  "narration": "The Micawbers remove to Canterbury, where something may turn up." },

// HANDOFF — an explicit change of protagonist. Never swap horses silently.
{ "kind": "handoff", "character": "emly", "at": "yarmouth", "chapter": 3,
  "narration": "We leave David for a moment. This is Little Em'ly's story now — the fisherman's niece in the boat-house on the Yarmouth flats." },

// MEANWHILE — an interstitial that winds the clock back to show a
// concurrent thread. The beats after it may start earlier than the story
// has already reached; the interstitial is what makes that legible.
{ "kind": "meanwhile", "narration": "Meanwhile — in the years David was courting Dora, Mr Peggotty was walking Europe, looking for Em'ly." }
```

`narration` is required on every beat. `character` may be an array on a
shared journey (the focus is the first named).

## The rules of the telling

1. **Never move the camera without saying why.** Every jump of attention
   is carried by a beat whose card explains it. If the frame will move
   more than a country's width, the beat before it must be a `handoff`,
   `meanwhile` or `removal` — something that prepares the eye.
2. **Never rewind silently.** Time may only step backward after a
   `meanwhile` interstitial, and the story-clock's "earlier" reading is
   part of the telling. Close the loop too: when the rewound thread
   catches up, the next beat re-joins the main current explicitly
   ("And so, by the spring, both threads met at Yarmouth…").
3. **No two handoffs back to back.** Each protagonist gets at least a
   scene or a journey before attention moves again.
4. **Stationary time gets story.** Any rest longer than a phase of life
   (a schooling, a marriage, an apprenticeship) earns at least one scene
   beat. The viewer should never watch a still map and wonder if the
   thing has crashed.
5. **Cover every movement.** Each movement in the data appears in the
   script as a `journey` or a `removal` — otherwise its trail pops onto
   the map undramatised. (The rushes tool checks.)
6. **The script narrates; the data testifies.** Beats reference real
   movements and places — the validator enforces it — and narration
   retells the book without inventing specifics the text doesn't have.
   The honesty badges underneath (place certainty, route provenance)
   are unchanged by the telling.
7. **Write for a stranger, and introduce everyone.** Assume the viewer
   has not read the book. The first time a beat — or a place card — names
   anyone outside the tracked cast, give them a one-line gloss: who they
   are, with a *light characterising touch*, not a bare label. "The
   fly-eating madman Renfield, now the Count's thrall"; "Charlotte's
   court-proud father, Sir William"; "the careworn wife Stiva betrays". A
   type or a telling detail — not a string of adjectives. Watch three
   traps in particular: a title a character inherits mid-book (Arthur
   Holmwood → Lord Godalming — the reader met "Arthur", so "Godalming"
   reads as a new man); someone known only by relation then suddenly
   named ("her mother" → "Joan"); and periphrasis ("Simon's son" for
   Stephen). Then say why a journey matters, and prefer the concrete
   ("sent to a boarding school kept by a bully") to the allusive ("the
   Salem House episode"). Editorial register, no spoiler-coyness — the map
   is a retelling, it may tell.
8. **20–45 words a beat.** Under 20 usually isn't earning its stop;
   over ~60 won't be read (the rushes tool warns). Vary the rhythm:
   scene, journey, journey, scene reads better than strict alternation.
9. **No em dashes.** A spaced hyphen carries a dash-pause ("a mill - and
   a monster in the dark"); the em dash has become a tell of synthetic
   writing, so keep it out of every narration, note and card. En dashes
   for ranges (chapters 56-57, 1805-1812) are fine.

## Converging paths — narrating the near-miss

A few books run on coincidence rather than journey: characters crossing the
same city on the same day, always just missing one another. The engine
already shows it — a finished path stays drawn faintly, so a live character
visibly crosses an earlier one — and the telling does the rest. When two
threads pass the same ground close in time, spend a beat on it: name the
gap, from the pane, in the present tense of the character we're with. "Only
twenty minutes earlier, Stephen had stood on the very spot Bloom now
crosses." The map shows the *where*; the narration supplies the *when*, and
the ache of the miss.

Two cautions. The crossing must be **true** — the same place, and the stated
time-gap matching the timed data (the text-vs-map check verifies it below);
a beautiful near-miss the data doesn't bear out is still a lie. And don't
narrate every coincidence or none will land — pick the few the book itself
leans on. This is a technique for the near-miss class of book (see
`ADDING-A-NOVEL.md` §3), not a rule for every novel.

## The screening loop

A script is never shipped on the first draft:

1. **Draft** against this rubric.
2. **Rushes** — `node tools/rushes.mjs data/<novel>.json <story.json>`
   performs the script headless and reports: total runtime, per-beat
   durations, camera-jump sizes, over-long narrations, rewinds without a
   meanwhile, movements left uncovered, scenes where the character isn't
   actually at the named place, and route spills (a leg drawn across the
   wrong medium — see ADDING-A-NOVEL §3). Fix every error; justify or fix
   every warning.
3. **Text-vs-map check** — a reviewer (an LLM agent; it needs judgement,
   not a script) reads every beat's narration against the route the map
   will actually **draw** and reports contradictions. Rushes checks how the
   script *plays*; this checks whether it *tells the truth*. For each beat,
   cross-check:
   - **mode** — the narration's implied conveyance (walk / horse / coach /
     train / ship / elephant / sledge) vs the movement's `mode`;
   - **land vs sea** — an overland narration on a sea route, or a voyage on
     an inland route (judge the `via` by its place-names and coordinates; a
     river journey by boat is correctly `ship`);
   - **named places** — towns and regions the narration names lie on or near
     the route (endpoints or `via`);
   - **direction** — the from→to geography matches the narration;
   - **scene placement** — a `scene` beat's `at` matches its narration;
   - **shared-vs-solo** — a movement's `character` array matches who the
     narration says travels together; a companion the narration names isn't
     dropped, and a solo flight isn't drawn as a shared line.
   - **crossings** — any near-miss the narration asserts (one character on a
     spot another lately passed, "twenty minutes earlier…") is true against
     the timed movements: the two paths really share that point, and the
     stated gap matches the clock. A crossing the data doesn't bear out is a
     lie, however good the line — cut it or fix the timing.
   - **first-mention context** — every named person a newcomer wouldn't
     know is introduced, at first mention (in a beat *or* a place card),
     with a one-line gloss: a role or relationship *and* a light
     characterising touch, not a bare name ("the fly-eating madman
     Renfield, now the Count's thrall"). Watch the three traps from rule 7:
     a title inherited mid-book (Arthur → Lord Godalming), a character
     known only by relation then suddenly named ("her mother" → "Joan"),
     and periphrasis ("Simon's son" for Stephen).

   This catches the class of error rushes is blind to. It has found, in
   practice: Mr Peggotty *walking* across France drawn as a sea voyage round
   Gibraltar; David's overland Swiss exile tagged `ship`; a phantom
   traveller (Lord Godalming) galloping in one beat and boarding a launch in
   the next. Fix every genuine contradiction; a nested-flashback rewind
   behind a `meanwhile` is correct, not one.
4. **Completeness check** — the other blind spot. Rushes and the text-vs-map
   check both police what *is* in the script; neither can see what's
   *missing*, because knowing which of a novel's moments matter needs someone
   who has read the book. In particular a major **non-travel** turning point
   — a proposal, a betrothal, a death, a revelation at a fixed place — has no
   movement to be "uncovered", so it slips past every mechanical check. So a
   reviewer (an LLM agent; it needs judgement) reads the novel against the
   script and asks: *which turning points does this skip, and does a stranger
   need any of them to follow the story?* Report them as candidate `scene`
   beats, each with one line on why it earns a stop.

   The bar is deliberately **high**, because PlotLines is not trying to tell
   the whole book. Flag only the **load-bearing** (a later beat leans on it)
   or the **stranger-confusing** (its absence leaves a plot hole) — never
   every subplot, or the pass drowns the script in stops. The editor decides
   what actually goes in. This is what would have caught P&P shipping without
   Mr Collins's proposal and Charlotte Lucas's acceptance — the betrothal the
   whole Kent hinge silently depends on.
5. **Screening** — watch it in the browser, end to end, at 1×, as a
   stranger would. Only then does it go in front of the editor.

## What the player does with it

Story mode with a script plays beats in order: journeys animate across
their whole beat, scenes hold the camera on the place, removals glide,
interstitials own the screen. ◂ ▸ step one beat; Play auto-advances;
the speed control divides durations; scrubbing the timeline pauses the
guided story (the reader has taken the wheel — play resumes the beat).
Novels without a `story` array fall back to the plain clock playback.
