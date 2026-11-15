# Frog Ninja: story, cast and brands

## Why this exists

Frog Ninja has to stand as a great little game by itself: played solo, or on a tablet at a
conference stand. It is also a way for people to meet our conference mascots. The second
goal must never get in the way of the first.

**The brand rule: characters, never adverts.** The brands show up as animals with
personality who are part of the party and react to how you play. No logos on the playfield,
no banners, no "sponsored by", no links in the middle of a run. If someone falls for the
llama and later recognises it on a conference site, that is the win. Where the brands are
named outright is outside the run: the comics, the scoreboard screen, the game-over panel.

## The cast

Each is the mascot of one of our events. The source of truth for each is that brand's own
artwork; the game redraws them in the frog's sticker style (`STYLE.md`).

| Animal | Brand | Looks like (from the brand art) | Source file |
|---|---|---|---|
| Frog | CFP.ninja | green frog, red bandana with a frown-shaped lower edge, red gi, two katanas on its back, a laptop in its lap | `static/img/cfpninja_full.png` in this repo |
| Monkey | SREday | brown monkey with a wide grin, in a purple suit with a white shirt and purple tie, mid-stride, long curled tail | `hello-deck/brands/mascot-sreday.png` in `sreday/sreday` |
| Llama | LLMday | fluffy bright green llama, cream muzzle, brown hooves, prancing | `hello-deck/brands/mascot-llmday.png` in `sreday/llmday` |
| Platypus | PLATFORMday | brown platypus with a grey bill, olive hoodie, tan trousers, flat cross-hatched tail, one fist raised | `hello-deck/brands/mascot-platformday.png` in `sreday/platformday`; also the brand kit |
| Corgi | Conf42 | orange and white corgi with big eyes; seen in a blue space suit, and with a headset | `docs/assets/conf42/404_corgi.png`, `kickoff_corgi.png` in `conf42/src`; also the brand kit |

Brand kit with masters for all of them: `https://conf42.com/assets/brandkit/`.

Suggested personalities and jobs at the party (to confirm):

- **Frog** (CFP.ninja): focused, a little smug, takes the salad far too seriously.
- **Monkey** (SREday): the host in the sharp suit; keeps the party running, throws the
  fruit with terrifying accuracy, panics quietly when something breaks.
- **Llama** (LLMday): the dancer; confident, occasionally says something that sounds wise
  and is completely wrong.
- **Platypus** (PLATFORMday): the DJ in the hoodie; built the sound system, will tell you
  how.
- **Corgi** (Conf42): arrived in a space suit, guards the dessert table, delivers the
  crates.

## The backstory, told as comics

Short, wordless or nearly wordless strips, in the game's own art style. They can be shown
before the first run (skippable), on the game's page, and shared on their own.

**Strip 1: "The dessert"** (the intro; 6 panels)

1. Wide shot: a beach at sunset, a disco ball hung from a palm, the five animals dancing.
   The platypus is at the decks, the monkey is carrying a tray.
2. The monkey lifts the lid of the dessert dish with a flourish. It is empty. A single
   crumb.
3. Everyone turns to look at the corgi, who is suddenly very interested in the sea. Crumbs
   on its space suit.
4. The llama points, with total confidence, at the frog, who is in the corner on its
   laptop reviewing talk proposals.
5. The frog looks up. The bandana frown deepens. It closes the laptop.
6. The frog on the mooring post at the water's edge, katanas drawn, the others lined up
   behind it with armfuls of fruit. Caption: "Fruit salad. Now."

**Strip 2: "Power-ups"** (4 panels, one each; can be shown as tips)

1. The monkey lobs a firefly by mistake. The frog swallows it and breathes fire. The monkey
   straightens its tie, singed.
2. The platypus slides a bottle of golden sake across. The frog, drunk, slices everything
   in sight including the platypus's headphones cable.
3. The llama hands over its alarm clock ("so you are not late"). Time stops; the frog
   strolls between frozen fruit drawing dotted lines.
4. The corgi arrives with a crate and a bundle of fireworks, delighted. Everyone else takes
   one step back.

**Strip 3: "Game over"** (3 panels, shown with the result)

1. The clock hits zero. The frog, exhausted, slumps on the post.
2. The bowl: a salad sized to how long the run lasted (a sad single grape for a short run,
   a mountain for a long one).
3. The animals' verdict, by result: the llama applauds, the monkey gives a thumbs up, the
   corgi has already eaten half.

More strips can follow the events themselves (a strip per conference, the cast in that
city).

## Where the characters appear in the game (subtle first)

Ordered from least to most intrusive; build in this order and stop when it starts to
distract from the fruit.

1. **Background life.** The four dance on the beach behind the playfield, small, dark and
   low-contrast like the rest of the background.
2. **Reactions.** They cheer a combo step, gasp at a wrecked power-up, duck from fireworks,
   freeze mid-move during the time freeze.
3. **Who throws what.** Fruit comes from the monkey's side; the corgi drags the crate in;
   the llama tosses the clock; the platypus slides the sake. The player learns to glance at
   an animal to know what is coming.
4. **Game-over verdict.** The salad bowl and the cast's reaction (strip 3), with each
   animal's name and brand in small print under it.
5. **Scoreboard.** A small mascot beside each podium step, and one line: "Frog Ninja is
   brought to you by the animals of SREday, LLMday, PLATFORMday and Conf42", with links.
   This is the one place a link to the events belongs.
6. **Conference mode (later).** At an event, the stand's own mascot takes a bigger role and
   the scoreboard is the event's.

## Not decided

- Names for the animals (so far they are called by their species).
- Whether the comics are shown before the first run or only on request.
- Whether other animals become playable (the list of character variants in `STYLE.md` is
  frog-only for now).
