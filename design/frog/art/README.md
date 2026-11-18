# Frog Ninja art pipeline (the visual overhaul)

Every placeholder drawn in code is replaced, one element at a time, by generated art that
Marek picks. Plan approved 2026-11-18. Look and tone: `../STYLE.md` (version 2). What to make:
`../ASSETS.md`. Where each element stands: `manifest.json` (this folder).

## The loop
1. **Prompt.** Claude writes prompts from STYLE.md v2 and the element's notes, always two tiers:
   2 *faithful* (closest to the logo frog) and 2 *unhinged* (the faithful style at its maximum
   expression: stronger pose, eyes, V and smile pushed as far as the logo's own shapes allow;
   never speed-line bursts, glow trails or a different, louder style; STYLE.md). Reference images go with every request: the logo (`static/img/cfpninja_full.png`),
   the chosen style anchor (element 0.1), and the picked master of that state.
2. **Generate.** Nano Banana 2 (`gemini-3.1-flash-image`) through the ElevenLabs connector
   (claude.ai custom connector `https://api.elevenlabs.io/v1/mcp`), paid from ElevenLabs
   credits. One generation per request; never retry one that is still running (each retry is
   billed). No transparent backgrounds: items are made on a flat plain background and cut out.
3. **Save.** Results go to `~/Desktop/Frog Ninja art desk/candidates/<id>/<tier>-<n>.<ext>`
   (an id with `/` becomes `_`). Never into this repo (it is public); the desk folder is backed
   up to Drive, `Claude (private)/frog art desk`. The prompt is logged in the element's
   `prompts` list in `manifest.json`.
4. **Pick.** `python3 design/frog/tools/artdesk.py`, then http://127.0.0.1:8742: today's
   placeholder next to the candidates, Pick / Reject / notes, saved straight to `manifest.json`.
5. **Refine.** Claude reads verdicts and notes and writes the next round, until there is a pick.
6. **Into the game.** The pick is cut out, vectorized where it is SVG (frog, background) and
   split into rig parts, committed under `static/img/game/` with a hashed name, and switched on
   in the game's `ART` table; the code drawing stays as the fallback. Status: `in game`, then
   `approved` once Marek has played it on desktop and phone.

## Few drawings, many frames
A new image only when the silhouette or the expression changes. Between key poses the same
drawing moves by its rig parts (head, arms, hands, katanas, bandana tails). New key poses are
edits of the state's master; poses that belong together come from one model sheet.

## Order of work
1 style anchor, 2 background (three depths + post), 3 frog (base pose, then each state),
4 blades and trails, 5 fruit (outside + cross-section, then the fake-3D cut renderer),
6 power-ups and items, 7 effects (fire, hacking breath, fireworks, sparks, juice),
8 later: the cast, the interface, the comics.

## Tools
- `tools/art_seed.py`: builds or tops up `manifest.json` from ASSETS.md (keeps picks).
- `tools/art_current.py`: screenshots today's placeholder of every element into the desk.
- `tools/artdesk.py`: the picking board.

## Each swap is checked with
`scenario_test.py` (plus a check for any new renderer), `anim_sheet.py` for frog changes,
`monkey.py` at 1280x720 and 390x844, frame rate on a phone-sized run, then branch, CI, main,
`git push heroku main`, and the live file hash.
