# Frog Ninja: handoff

Read this first when picking the work up. Everything needed is in this repo.

## Where things are (updated 2026-11-15)
- **`PROBLEMS.md`: read it first.** The living log of what is problematic or missing. The
  6-hourly trace review adds to it (on the `claude/trace-review` branch and its pull request).
- **`PRINCIPLES.md`**: the core game principles and the balance rule. Check every gameplay
  change against it.
- **`STYLE.md`** and **`ASSETS.md`**: the visual style for whoever draws the game, and the
  list of every element to create. All current art is placeholder.
- **`STORY.md`**: the plot, the cast (our conference mascots), the comics, and how the
  brands appear without becoming adverts.
- **`SOUNDS.md`**: every sound effect and the music, all synthesised for now, and how to
  swap in real recordings.
- **`SPEC.md`**: the measured anatomy of the logo frog.
- **Deploy:** Heroku app `cfpninja`, by `git push heroku main` from a machine that has the
  Heroku login. Pushing to GitHub alone deploys nothing.
- **Testing:** the Debug pill at the top right of `/game` (drag items onto the field, no
  clock or score), plus `tools/mockserver.py` and `tools/cdp.py` for headless runs.
- **Run recorder:** every run (and debug session) posts an anonymous event log to
  `/api/v0/game/traces`; see `log()` in `static/js/views/frog-game.js`.

The sections below are the 2026-11-10 handoff and are partly out of date: the game is
deployed, and it has grown a lot since (see the git log).

## What exists
- **The game is shipped to `main` (commit 115b272), but not deployed.**
  - It is the `/game` route: a survival fruit slicer starring the CFP.ninja frog (time is the currency: fruit buys seconds, the score is how long you last).
  - It has a top-20 scoreboard with GitHub login.
  - Code:
    - `static/js/views/frog-game.js`: the engine. The frog is an inline SVG; fruit, particles and the slash trail are drawn on a canvas.
    - `static/js/views/game.js`: the page, scoreboard and login-to-save.
    - The `/* Frog Ninja game (/game) */` block at the end of `static/css/style.css`.
    - `pkg/api/game.go` and `pkg/api/game_test.go`.
    - `pkg/models/game_score.go`.
    - The routes and migration line in `pkg/server/server.go`.
  - API:
    - `GET /api/v0/game/scores` is public, with your own rank added when logged in.
    - `POST /api/v0/game/scores` needs a login, with body `{score, slices, duration_ms}`.
    - There is one `game_scores` row per user, and its score only ever goes up.
- **`design/frog/`** holds this note plus:
  - `SPEC.md`: **the measured anatomy of the logo frog.** It covers the palette, line weights, every part's position in the 2048 × 1934 logo frame, and the list of where the current SVG is off. Start here.
  - `mockups/`: the three playable layout mockups (A full stage, B dojo card, C night arcade). A shipped. Open the HTML files straight from disk.
  - `mockups/frog compare.html`: the logo, the current SVG frog, and an overlay of the two. Use it to check every frog change against the logo.
  - `tools/cdp.py`: screenshots in a separate headless Chrome with a throwaway profile, plus scripted clicks and JS. It uses only the standard library, so there is nothing to install. Works on Mac and Windows; set `CHROME=` if Chrome lives elsewhere.
  - `tools/mockserver.py` + `tools/csp.txt`: serve `static/` with the SPA fallback, the **production CSP**, and a fake scoreboard API. Use it to test /game without Go or a database.

## Next step: make the frog identical to the logo
The current frog is a hand redraw and doesn't match the logo closely enough (see "Where the current SVG redraw is off" in SPEC.md). The agreed direction is **trace, don't redraw**:
1. Turn each colour region of `static/img/cfpninja_full.png` into an SVG path in `viewBox="0 0 2048 1934"`. There are about 60 regions, with exact colours in SPEC.md. Keep the black backing and outlines as their own layer.
2. Group the paths into rig parts:
   - head, with eyes and pupils for blinking and looking
   - bandana knot, so it can flap
   - left and right arm (sleeve plus hand)
   - laptop
   - left and right katana
   - torso, legs, shadow
3. Paint the hidden areas the animation reveals, in the same flat style: the hands and chest behind the laptop, and the katana blades. The logo never shows a blade.
4. Re-rig the intro in `frog-game.js` on the new parts. The intro is: the laptop is flung, both arms reach over the shoulders, the katanas are drawn and swing out to a ready stance, with a slash pose per side. Pivots should be the real shoulder points from SPEC.md.
5. Check every step in `frog compare.html` with `tools/cdp.py` screenshots. The overlay must line up.

Then port the result into `static/js/views/frog-game.js`; the mockup copy is the classic-script twin used by the HTML mockups.

## Still open
- **Deploy.** cfp.ninja is a Heroku app, and pushing `main` does not deploy it.
  - Deploy `main` from the Heroku dashboard (Deploy, then Manual deploy) or with `git push heroku main`.
  - Do not set `DATABASE_AUTO_MIGRATE` in production: it never runs the full auto-migrate. The server creates the `game_scores` table itself on startup when it is missing (`EnsureGameScoresTable` in `pkg/server/server.go`).
  - Check it worked: `https://cfp.ninja/api/v0/game/scores` returns `{"scores":[]}`, not a 404. Don't check a static file, because the SPA fallback answers 200 for any path.
- **Nav link.** There is no link to /game anywhere yet; it's a hidden easter egg until Marek says otherwise.

## House rules that apply here
- **Pushing.** Marek OK'd pushing cfp.ninja straight to `main`. Push a branch first anyway so CI (`make test`) compiles the Go, then fast-forward `main`.
- **Look.** Buttons are text only (no emoji or symbols), and links never get underlined on hover. New UI copies the site's existing look and classes.
- **CSP.** The page has no inline `<script>` or `<style>`, and images may only come from the site itself or `data:`. That's why the scoreboard shows no GitHub avatars.
- **Logo files.** Never edit `static/img/cfpninja*.png`. The frog is traced *from* them.
- **Mockups first.** New visual directions start as clickable HTML mockups for Marek to pick from, before anything is built into the app.
