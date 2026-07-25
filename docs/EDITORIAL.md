# Editorial policy

What may go on the shelf, and how the difficult books are handled. The
other two documents cover craft: `ADDING-A-NOVEL.md` is the dataset,
`STORYTELLING.md` the script. This one carries the judgement that decides
whether a book is built at all, and in what voice.

It is short on purpose. PlotLines does not wrap its books in apparatus.

---

## 1. Choosing a book: the copyright rule

**Only build books that are strictly out of copyright by the UK rule: the
author died more than seventy years ago.** In 2026 that means died in 1955
or earlier.

Being on Project Gutenberg is **not** sufficient. Gutenberg follows US
public domain (broadly, published before 1929), which is a different and
looser test. A book can be freely readable on Gutenberg and still in
copyright here.

The rule has teeth: E. M. Forster was dropped from the shelf despite being
an author the editor loves and despite *Howards End*, *A Room with a View*
and *A Passage to India* all being US public domain, because Forster died
in 1970 and stays in UK copyright until 2040. If the rule can cost us
Forster, it can cost us anything.

Two traps:

- **Check the translator, not only the author.** A translation is its own
  copyrighted work. Constance Garnett (d. 1946) and C. H. Brewitt-Taylor
  (d. 1938) are clear; a modern translation of the same novel is not. This
  is why several otherwise obvious world classics are not on the shelf.
- **Check the death year, not the publication year.** A book published in
  1890 by an author who lived to 1960 is still in copyright.

Record the author's death year when proposing a book, so the check is
visible rather than assumed.

## 2. The care, and exactly where it stops

Two different things get confused, and PlotLines treats them oppositely.

**Real-world harms are ours to reproduce or not.** A racial slur, a
dehumanising description, an imperial framing taken for granted: if that
language ends up in *our* narration, in a place note or in a pin quote, we
have chosen to put it there. We do not. It is kept out, or contextualised
in our own editorial voice.

**A book's own adult content is not ours to tidy.** Sex, adultery,
drunkenness, cruelty, a character behaving badly: these are the book, and
they are told straight. Bloomsday is a day of appetite and the shelf says
so. Becky Sharp is a schemer. Emma Bovary's affairs are the map's whole
subject. Softening any of it would be a lie about the novel.

The distinction is the point: **PlotLines is context for someone who is
about to read the real thing, never a bowdlerised substitute for it.** So
the care goes into keeping our own voice honest, never into protecting a
grown reader from the book.

Both failure modes are real and symmetric: over-protecting the reader from
the novel, and quietly waving through a genuine harm. When in doubt, ask
the editor rather than deciding silently.

## 3. Sensitive books: great care, no heavy apparatus

Some books on the shelf carry the prejudice of their age. The house style
for them was set on *Heart of Darkness* and holds for every one since:
**treat them like the other books, with far more care in the execution and
no defensive scaffolding around them.**

In practice:

- **Slurs and dehumanising language stay out of narration and pin quotes
  entirely.** These novels are full of extraordinary passages that carry no
  such freight; use those. Never reproduce a slur for atmosphere.
- **Pick quotes from the landscape and the journey**, not from a line whose
  power depends on the ugliness. There is nearly always a better sentence
  on the same page.
- **Place notes stay truthful about the real geography** - the Congo Free
  State as it actually was, under Conrad's deliberate fog. That is accuracy,
  not apparatus.
- **No content-warning UI, no banner, no framing essay.** A normal diary
  entry like any other book.
- **One honest line is allowed** where a book's whole stance needs naming.
  *Kim* carries a single `mapNote` at the front door saying it is a Raj
  novel told from inside the imperial worldview. One line, not a lecture.
- **Run an independent sensitivity reader** over the finished telling for
  any colonial-era book, as a separate pass with fresh eyes. On *Kim* it
  caught "gone half-native" in our own narration, which everyone else had
  read past.

**Images need the same care.** Refuse posed ethnographic "types of India"
plates and their equivalents: they are not pictures of a place, they are
pictures of people arranged as specimens. Favour landscape, architecture,
a river, a road. A logged `imageBlank` is always better than a demeaning
stand-in - *Kim*'s Grand Trunk Road and Saharanpur both ship as honest
blanks for exactly this reason.

## 4. The pre-ship language check

**The care extends to books that do not look colonial at all.** *The Lost
World* is a 1912 boys' adventure and it shipped with "half-breed" and
"Indian(s)" for Amazonian peoples in our own narration. A reader would have
met that on the map. It was caught after shipping, which is once too late.

So, before any book with non-European peoples in it ships, grep the
finished dataset for the words we will not print in our own voice. The
current list - narration, notes, titles and place descriptions all count:

```
half-breed · half-caste · native(s) as a noun for people · savage ·
primitive · Indian(s) for Indigenous or tribal peoples · Oriental ·
coolie · squaw
```

Two notes on using it. "Indian" meaning *of India* is correct and stays
(*Kim* is "as much Indian as Irish"); the slur sense is "Indian" for
Indigenous peoples of the Americas. And the fix is not a thesaurus swap:
**name the actual people** where the book or the record allows ("the Accala
people", "the Kurdish villages"), or use a plain neutral word - villager,
crew, the river villages.

This list is a floor, not a ceiling. It catches the words we already know
about; the sensitivity reader catches the framing that no grep can see.

## 5. Where this sits in the build

- **Before research**: the copyright check (§1). A book that fails it is
  not proposed.
- **While writing**: §§2-3 govern narration, notes and quote choice.
- **Before shipping**: the language check (§4), plus the sensitivity reader
  on any colonial-era book, alongside the four hard gates in
  `ADDING-A-NOVEL.md` §5.
- **Always**: if a call feels finely balanced, it belongs with the editor.
  That is not a failure of the process, it is the process.
