# The frog's colours and the colour guardian

Brand rule: the frog in the game wears the logo's colours, in every pose. Generated art drifts (the robe redder or
more pastel, the ink brown or grey); the guardian puts it back before it ships.

- The palette: `design/frog/palette.json`. Pulled from the logo (`static/img/cfpninja_full.png`): inking, robe, robe
  lit, skin, belly, white, laptop and katana greys. The shades the logo does not have (robe shaded, skin shaded, belly
  shaded, tongue) come from Marek's picked game frog, set on the logo's colours.
- The board: `design/frog/art/palette-board.png` (`color_guardian.py board`): the swatches, and every game picture's
  own colours next to them.
- The tool: `design/frog/tools/color_guardian.py` (its docstring has the commands).

The flow for anything new of the frog:
1. It is generated; Marek picks.
2. A new look on purpose (a new skin, the sensei, a costume)? Add it to the palette first: a new entry under `skins`
   (`color_guardian.py add <skin> <id> <#hex> "<name>"`), and build with `--skin <skin>`.
   A new prop or effect in the picture (a sake bottle, a flame)? `color_guardian.py propose <file>` lists the colours
   the palette does not know; `add extras ...` the ones that belong. From then on they are kept like the rest.
3. An ordinary pose of the normal frog: the build tools paint the palette over it (`fix_image`), nothing to do.
4. `ship.py` runs `color_guardian.py check` first. It is instant (a picture judged once stays judged: names are content
   hashes, the list is `design/frog/palette-ok.json`). If something is off it stops; `color_guardian.py rewire` repaints
   the built assets in place and renames them, then commit and ship again.

Not covered: the seagull, the scene, fruit and effects (not the frog). Steel keeps its light and dark (blades are
shaded); only a colour tint is taken out of it.
