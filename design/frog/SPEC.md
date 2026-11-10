# CFP.ninja frog: build spec (measured from cfpninja_full.png)

Reference frame: the logo PNG itself, **2048 × 1934 px**. Use `viewBox="0 0 2048 1934"` for the rig so every number below can be used as is.
The figure is symmetric around **x = 1024**. The only asymmetric parts are the bandana knot (on the frog's right, our left) and the crossed shins.

## Palette (exact pixel values)
| Role | Hex |
|---|---|
| Outline / shadow | #000000 |
| Gi + bandana | #a3211d |
| Highlight stripe (bandana band, knee tops) | #ba2823 |
| Skin | #98b74b |
| Chin, jaw, chest | #f1eda4 |
| Laptop screen | #495154 |
| Laptop rim + base bar | #5d666a (shadow side #444d4f) |
| Katana wrap / guard greys | #a1a5a7, #929898 (dark diamonds ≈ #444d4f) |
| Eye whites, highlights, "CFP" | #ffffff |

## Line weights
- **Inner lines:** about 30 px (1.5 % of width). Examples: the head top, the line between bandana cap and band, the mouth, the laptop base.
- **Outer silhouette:** 47–62 px (2.3–3 %). The whole figure sits on a thick black backing, like a sticker.
- **Shadow:** a flat black ellipse spanning x 66–1984 (94 % of the width). Its top is about y 1700, its bottom y 1832, centred on x 1024.

## Vertical layout (y, top to bottom)
| y | Part |
|---|---|
| 110 | top of the head outline |
| 140–256 | bandana cap |
| 272–306 | highlight stripe, along the top edge of the band |
| 280–486 | bandana band. Its bottom edge dips in a V between the eyes, which makes the angry brows |
| 384–786 | green face. It is widest at the cheeks: x 520–1528, about 1010 px or 53 % of the figure width |
| 388–622 | eyes |
| 646–764 | mouth line, a cheek-to-cheek smile that sags about 118 px in the middle |
| 650–936 | yellow jaw band, which narrows into the chest V between the lapels |
| 788–936 | lapels, either side of the chest V |
| 812–1074 | shoulders. The gi forms a bell that widens downward |
| 966–1418 | laptop screen with rim, x 544–1504 (47 % of the width) |
| 1458–1484 | laptop base bar, x 598–1450 |
| 1276–1576 | knees |
| 1510–1632 | trouser cuffs, under the laptop |
| 1526–1788 | crossed green shins and feet |
| 1700–1832 | shadow |

The head takes about 40 % of the figure's height. Torso and laptop take about 40 %, and the legs and shadow about 20 %.

## Head
- **Silhouette:** a wide, low dome, with green cheek bulges sticking out at the sides at y ≈ 560–700. It is not a tall egg.
- **Bandana:**
  - The cap is separated from the band by a black line.
  - The highlight stripe runs along the top of the band.
  - The band's lower edge comes down in a V to the bridge of the nose, covering the top inner quarter of each eye. That is the whole angry expression; the eyes themselves are plain circles.
- **Knot:** on the left side of the image (x 360–608, y 212–454). It has two flaps with notched, cut ends. The upper flap points up and left; the lower one is shorter and points down and left.
- **Eyes:** large whites (left eye white x 664–924, about 260 px wide).
  - **Pupils:** about 300 × 220 px, black. Centres are at (813, 505) and (1234, 501), 421 px apart.
  - **Highlights:** circles of r ≈ 39 at (842, 466) and (1206, 465). They sit up and toward the middle of the face, so they mirror each other rather than pointing the same way.
- **Nostrils:** two small black teardrops at about (940, 640) and (1045, 640), angled outward.
- **Mouth:** one thick black curve from cheek to cheek. Below it is the yellow jaw band, with green on the outer sides.

## Torso and arms
- **Gi:** a bell shape from the shoulders (y ≈ 812) widening down into the lap.
  - **Lapels:** two red panels either side of the yellow chest V.
  - **Shoulders:** red regions at x 324–624 and 1424–1718.
- **Sleeves:** big red rounded bulges on the outer sides, at x 256–520 and 1524–1780, y 1060–1270.
- **Hands:** small green knobs that only peek out at the laptop's outer edges (x 458–548 and 1500–1586, y 1176–1316). The fingers are behind the laptop rim. Anything else hidden behind the laptop has to be drawn new for animation.

## Laptop
- **Screen:** a trapezoid, wider at the top (x 544–1504) than at the bottom, with rounded corners.
  - **Rim:** a lighter grey border about 22 px wide inside a black outline.
  - **Base bar:** a separate thin bar below the screen, with a gap between them.
- **"CFP":** chunky rounded heavy sans (Nunito Black / Arial Rounded weight), white. The letters span x 684–1364, y 1074–1348, about 60 % of the screen height. The P has a laptop-grey counter (the hole).

## Katanas
- Two swords crossed in an **X behind the frog**. Only the handles show above the shoulders.
- **Angle:** about **40° from vertical**, with the handle tops pointing up and out. The handle wrap centres step along a 40° line, from (224, 379) through (285, 451), (339, 516) and (393, 580).
- **Handle:** about 110 px thick with outline, running from about (160, 330) to (400, 640).
  - It has a rounded pommel cap.
  - The wrap shows grey diamonds with dark triangles between them, 4 visible diamonds about 85 px apart.
- **Guard:** a flat grey bar about 210 px long, perpendicular to the handle, at about (403, 667), just above the shoulder.
- **Below the guard:** a short stretch of wrap with more diamonds shows before the sword disappears behind the body. The blade/scabbard is never visible in the logo, so a drawn blade is new art.

## Legs
- **Knees:** wide red ovals reaching out to x 120 and 1930, the widest point of the body.
  - Each has a #ba2823 highlight band on top that ends in a small notch.
- **Cuffs:** red blocks under the laptop at x 540–736 and 1310–1508.
- **Shins:** two green bars crossing in an X under the laptop.
  - **Feet:** knobby, like the ends of a bone, with two lobes at each end.
  - The shin from lower left to upper right is in front.

## Where the current SVG redraw is off (overlay: "frog compare.html")
1. **Head too tall and narrow.** The real head is wider and flatter, with cheek bulges. The real eyes are bigger and are cut by the bandana V, and the highlights should point toward the middle of the face.
2. **Torso too short.** The real gi is a tall bell, and the laptop is bigger and higher, starting just under the chin at y 966.
3. **Arms wrong.** The real arms are bulging sleeves at the sides with hands peeking at the laptop edges, not short stubs in front.
4. **Katanas wrong.** The real ones are thick handles with diamond wrap at 40°, crossed behind, with bar guards at the shoulders. Mine are thin and close to upright.
5. **Legs too squashed.** The knees need to be wider with highlight bands, the cuffs are missing, and the crossed shins need bone-like feet.
6. **Wrong line weights and shadow.** The outline should be 1.5 % inside and 2.5–3 % on the silhouette, and the shadow ellipse should be 94 % of the width.

## Suggested way to make it identical
Trace, don't redraw. Turn each colour region of the PNG into an SVG path in the 2048 × 1934 frame; there are about 60 regions, listed above. That gives a vector frog that matches the logo pixel for pixel. Then group the paths into rig parts:
- head, with eyes and pupils for blinking and looking
- bandana knot, so it can flap
- left and right arm, each sleeve plus hand
- laptop
- left and right katana
- torso, legs, shadow

For animation, a few hidden areas then need new art in the same style:
- the hands behind the laptop
- the chest behind the laptop
- the katana blades
