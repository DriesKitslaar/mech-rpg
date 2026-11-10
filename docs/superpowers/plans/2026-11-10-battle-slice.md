# Battle Slice Implementation Plan (plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-playable battle between a mech assembled from part sprites and a group of enemies, with the full combat rules, plus the art pipeline and the part-sprite proof the owner has to judge.

**Architecture:** Pure TypeScript rules in `src/core` (no DOM, no storage) operate on an immutable `BattleState`. Typed content data lives in `src/content`. A Canvas 2D UI in `src/ui` draws the state and turns nine abstract input actions into rule actions. Node scripts in `scripts/art` generate and process images.

**Tech Stack:** Node 22, TypeScript, Vite, Vitest, Playwright (`@playwright/test`), `tsx` for scripts, `sharp` and `image-q` for image processing, `undici` for proxy-aware fetch, `@fontsource/vt323` for the UI font.

**Spec:** `docs/superpowers/specs/2026-11-10-mech-rpg-design.md` (Dutch). This plan covers build steps 1 and 2 of spec §13. Later plans: garage and shop; missions, story and saving; Android APK.

## Global Constraints

- All in-game text is English and lives in `src/content/strings.ts`, never inline in UI code.
- Logical screen is 310×270. All layout uses logical units; the canvas backing store is an integer multiple of it. No fractional scaling, no image smoothing.
- Every screen is fully operable with the nine input actions `up, down, left, right, confirm, cancel, prev, next, menu`. Nothing requires touch or a pointer.
- `src/core` imports nothing from `src/ui`, `src/platform`, the DOM or Node. `src/content` imports only types from `src/core`.
- Combat is deterministic for a given seed. `src/core` never calls `Math.random`.
- No secret, key, or proxy address is committed. The art proxy address is read from the environment variable `ART_PROXY_URL`; an optional key from `ART_PROXY_KEY`.
- Every generated image is stored with a JSON sidecar holding its prompt, model, size and quality.
- All names (world, factions, parts, enemies) are original. Do not use names, designs or terms from existing mech games.
- Playwright is run with `--trace off`. Do not run `playwright install`; when `PW_CHROMIUM_PATH` is set, use it as `executablePath`.
- Commit messages end with the two attribution lines used by earlier commits on this branch.

## Review Focus

1. **Double input on Android.** A D-pad press can arrive as both a gamepad button and a key event. Expected: one action per physical press. Pinned in Task 6.
2. **Held direction.** Holding the D-pad must not flood a menu. Expected: one action, then repeats after a delay. Pinned in Task 6.
3. **Viewport that is not 1240×1080.** On a desktop or another handheld the game must letterbox at an integer scale, never blur or overflow. Pinned in Task 1.
4. **Battle that cannot progress.** Arms destroyed, ammo gone or energy too low for any weapon. Expected: ending the turn is always possible and a stalemate ends in defeat instead of running forever. Pinned in Task 4.
5. **Art failures.** Proxy error, timeout or a missing sprite file. Expected: the script exits non-zero with a readable message and writes no partial file; the game draws a labelled placeholder and stays playable. Pinned in Tasks 2 and 7.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/core/types.ts` | All rule types |
| `src/core/rng.ts` | Seeded random numbers |
| `src/core/build.ts` | Build statistics and validation |
| `src/core/battle.ts` | Battle state, shot preview, actions, turn flow |
| `src/core/ai.ts` | Enemy action choice and the auto-player used by simulation |
| `src/content/parts.ts` | Part catalogue for this slice |
| `src/content/enemies.ts` | Enemy definitions and encounters |
| `src/content/strings.ts` | All English UI text |
| `src/content/sprites.json` | Generated manifest: sprite id to file and size |
| `src/platform/input.ts` | Keyboard and gamepad to input actions |
| `src/ui/display.ts` | Canvas scaling |
| `src/ui/widgets.ts` | Text, panels, meters, menus |
| `src/ui/mechLayout.ts` | Pure placement of part sprites into a mech |
| `src/ui/sprites.ts` | Sprite loading with placeholder fallback |
| `src/ui/battleScreen.ts` | Battle screen |
| `src/main.ts` | Boot, loop, URL parameters, test hook |
| `scripts/art/proxy.ts` | Calls to the art proxy |
| `scripts/art/imageOps.ts` | Chroma key, trim, fit, palette |
| `scripts/art/jobs.ts` | List of images to generate and their prompts |
| `scripts/art/generate.ts` | CLI: generate raw images |
| `scripts/art/process.ts` | CLI: raw images to game sprites and manifest |
| `scripts/art/proof.ts` | CLI: contact sheet of all part combinations |
| `scripts/simulate.ts` | CLI: win rates over many seeds |
| `tests/**` | Vitest unit tests, mirroring `src` and `scripts` |
| `e2e/**` | Playwright tests |

---

### Task 1: Project scaffold and integer-scaled canvas

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `index.html`, `.gitignore`, `.env.example`, `src/main.ts`, `src/ui/display.ts`
- Test: `tests/ui/display.test.ts`, `e2e/display.spec.ts`

**Interfaces:**
- Produces: `LOGICAL_W = 310`, `LOGICAL_H = 270`, `computeScale(viewW: number, viewH: number): number`, `fitCanvas(canvas: HTMLCanvasElement, viewW: number, viewH: number, dpr: number): number` (sets backing size and CSS size, returns the scale) from `src/ui/display.ts`.
- Produces npm scripts: `dev`, `build`, `test` (Vitest, one run), `e2e` (Playwright), `typecheck` (`tsc --noEmit`).

- [ ] **Step 1: Create the project files.** `npm init`, install `typescript vite vitest @playwright/test tsx sharp image-q undici @fontsource/vt323` as dev dependencies (`@fontsource/vt323` as a dependency). `tsconfig.json`: `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`. `.gitignore`: `node_modules`, `dist`, `art/raw-tmp`, `test-results`, `playwright-report`, `.env`. `.env.example` contains `ART_PROXY_URL=` and `ART_PROXY_KEY=` with empty values and a one-line comment each. `playwright.config.ts`: `webServer` runs `npm run dev -- --port 5173`, `use.viewport = { width: 1240, height: 1080 }`, `use.launchOptions.executablePath = process.env.PW_CHROMIUM_PATH || undefined`, `testDir: 'e2e'`.

- [ ] **Step 2: Write the failing unit test** in `tests/ui/display.test.ts`:

```ts
import { computeScale } from '../../src/ui/display';
test.each([
  [1240, 1080, 4], [1920, 1080, 4], [800, 600, 2], [310, 270, 1], [300, 200, 1],
])('computeScale(%i, %i) = %i', (w, h, s) => expect(computeScale(w, h)).toBe(s));
```

- [ ] **Step 3: Run `npm test`.** Expected: FAIL, `computeScale` not found.

- [ ] **Step 4: Implement `src/ui/display.ts`.** `computeScale` is `max(1, floor(min(viewW / 310, viewH / 270)))`. `fitCanvas` sets `canvas.width/height` to `310 × scale` and `270 × scale`, sets the CSS size to the backing size divided by `dpr`, and returns the scale.

- [ ] **Step 5: Implement `index.html` and `src/main.ts`.** Black page, no margins, no scrollbars, canvas centred with `image-rendering: pixelated`. `main.ts` calls `fitCanvas` on load and on resize, sets `ctx.imageSmoothingEnabled = false`, applies `ctx.setTransform(scale, 0, 0, scale, 0, 0)` each frame, and for now fills the logical screen with `#101418` and draws a 1-unit `#e08a2c` border.

- [ ] **Step 6: Write `e2e/display.spec.ts`.** Two tests: at 1240×1080 the canvas `width`/`height` attributes are `1240`/`1080`; at 1000×700 they are `620`/`540` and the canvas bounding box lies fully inside the viewport.

- [ ] **Step 7: Run `npm test`, `npm run typecheck`, `npm run e2e -- --trace off`.** Expected: all pass.

- [ ] **Step 8: Commit** with message `Scaffold project with integer-scaled canvas`.

---

### Task 2: Art pipeline and part-sprite proof

This task ends with a decision by the owner. It spends money on the owner's image account: at most 20 images at `medium` quality.

**Files:**
- Create: `scripts/art/proxy.ts`, `scripts/art/imageOps.ts`, `scripts/art/jobs.ts`, `scripts/art/generate.ts`, `scripts/art/process.ts`, `scripts/art/proof.ts`, `src/ui/mechLayout.ts`, `art/palette.json`, `art/reference/style-ref.json`
- Output: `art/raw/<id>.png` + `art/raw/<id>.json`, `public/sprites/<id>.png`, `src/content/sprites.json`, `art/proof/contact-sheet.png`
- Test: `tests/art/imageOps.test.ts`, `tests/art/proxy.test.ts`, `tests/ui/mechLayout.test.ts`

**Interfaces:**
- Consumes: `art/reference/style-ref.png` (already committed).
- Produces from `scripts/art/proxy.ts`:
  - `generateImage(req: { prompt: string; quality: 'low'|'medium'|'high' }, deps?: { fetch: typeof fetch }): Promise<Buffer>`
  - `editImage(req: { prompt: string; quality: 'low'|'medium'|'high'; references: Buffer[] }, deps?): Promise<Buffer>`
  - Both throw `ArtProxyError` (with `status` and `message`) on any non-OK response, a missing `ART_PROXY_URL`, or a response without image data.
- Produces from `scripts/art/imageOps.ts` (all operate on `RawImage = { width: number; height: number; data: Uint8ClampedArray }`, RGBA):
  - `chromaKey(img: RawImage, key: [number, number, number], tolerance: number): RawImage`
  - `trim(img: RawImage): RawImage`
  - `quantize(img: RawImage, palette: [number, number, number][]): RawImage`
- Produces from `src/ui/mechLayout.ts`:
  - `type SpriteSlot = 'legs'|'core'|'head'|'arm'|'rightHand'|'leftHand'|'shoulder'`
  - `type SpriteSize = { w: number; h: number }`
  - `type DrawCmd = { slot: SpriteSlot; x: number; y: number; dim: boolean }`
  - `layoutMech(sizes: Partial<Record<SpriteSlot, SpriteSize>>): DrawCmd[]` — positions are top-left corners inside a 112×112 box, in draw order.
- Produces `src/content/sprites.json`: `Record<string, { file: string; w: number; h: number }>` keyed by sprite id.

**Proxy contract** (an existing service; do not change it):
- Generate: `POST ${ART_PROXY_URL}/openai-run` with JSON `{ action: 'imageGenerate', model: 'gpt-image-2', prompt, size: '1024x1024', quality, n: 1 }`.
- Edit with references: `POST ${ART_PROXY_URL}/openai-image-edit` with JSON `{ action: 'imageEdit', model: 'gpt-image-2', prompt, size: '1024x1024', quality, images: [{ base64, filename, mimeType: 'image/png' }] }`.
- Success body: `{ ok: true, payload: { data: [{ b64_json }] } }`. Failure body: `{ ok: false, error, status }`.
- Send header `x-connector-vault-key: ${ART_PROXY_KEY}` only when that variable is set. Node's `fetch` ignores `HTTPS_PROXY`; when it is set, install `new EnvHttpProxyAgent()` from `undici` as the global dispatcher. Request timeout: 240 s.

**Sprite jobs** (`scripts/art/jobs.ts`). Each job has `id`, `kind`, `box` (maximum processed size) and `subject` (the prompt fragment).

| Kind | Box (w×h) | Ids |
|---|---|---|
| legs | 64×52 | `legs-strider`, `legs-proof-b` |
| core | 56×40 | `core-hauler`, `core-proof-b` |
| head | 26×22 | `head-scout-mk1`, `head-proof-b` |
| arm | 22×44 | `arms-rigger`, `arms-proof-b` |
| hand weapon | 52×20 | `wpn-rivet-rifle`, `wpn-arc-pistol` |
| shoulder weapon | 60×22 | `wpn-mortar-pod` |
| enemy | 96×96 | `enemy-recon-drone`, `enemy-gun-turret` |
| background | 310×270 | `bg-quarry` |

Variant B of each frame part must look clearly different from variant A (for example heavy and angular against light and rounded), so the proof shows whether mismatched parts still read as one machine.

Every part prompt is: a fixed style paragraph, then the subject, then the fixed framing sentence. Style paragraph: `16-bit pixel art, side view facing right, muted military palette of olive, steel grey and orange accents, crisp pixels, no anti-aliasing, no text, no ground shadow.` Framing sentence for parts and enemies: `Show only this single component, centred, filling most of the frame, on a solid pure magenta #FF00FF background.` The background job uses no magenta sentence. Part and enemy jobs pass `art/reference/style-ref.png` as a reference through `editImage`; the background uses `generateImage`.

- [ ] **Step 1: Write `tests/art/proxy.test.ts`** using an injected fake `fetch`:
  - returns the decoded PNG bytes for a `{ ok: true, payload: { data: [{ b64_json }] } }` response;
  - sends `action: 'imageGenerate'`, `model: 'gpt-image-2'`, `size: '1024x1024'` to a URL ending in `/openai-run`;
  - `editImage` sends `action: 'imageEdit'` and one `images` entry per reference to a URL ending in `/openai-image-edit`;
  - throws `ArtProxyError` with `status: 400` and the service's `error` text for `{ ok: false, error: 'bad', status: 400 }`;
  - throws `ArtProxyError` when `ART_PROXY_URL` is unset, without calling `fetch`;
  - throws `ArtProxyError` when `payload.data` is empty.

- [ ] **Step 2: Write `tests/art/imageOps.test.ts`** on small synthetic images:
  - `chromaKey`: a 4×4 image of magenta with one olive pixel becomes fully transparent except that pixel; a pixel at `[250, 10, 245]` is removed with tolerance 40 and kept with tolerance 5.
  - `trim`: a 10×10 transparent image with opaque pixels spanning x 2..5, y 3..7 becomes 4×5; a fully transparent image throws `Error('image is empty after background removal')`.
  - `quantize`: every opaque output pixel equals one of the palette entries; alpha below 128 becomes 0 and alpha of 128 or more becomes 255.

- [ ] **Step 3: Write `tests/ui/mechLayout.test.ts`.** With sizes legs 60×50, core 50×40, head 24×20, arm 20×40, rightHand 50×18, leftHand 40×16, shoulder 56×20:

```ts
const cmds = layoutMech(sizes);
expect(cmds.map(c => c.slot + (c.dim ? '*' : ''))).toEqual(
  ['leftHand*', 'arm*', 'legs', 'core', 'head', 'shoulder', 'arm', 'rightHand']);
const at = (slot: string, dim: boolean) => cmds.find(c => c.slot === slot && c.dim === dim)!;
expect(at('legs', false)).toMatchObject({ x: 22, y: 58 });   // bottom-centre at (52,108)
expect(at('core', false)).toMatchObject({ x: 27, y: 22 });   // overlaps legs by 4
expect(at('head', false)).toMatchObject({ x: 46, y: 5 });    // overlaps core by 3
expect(at('arm', false)).toMatchObject({ x: 42, y: 28 });
expect(at('arm', true)).toMatchObject({ x: 36, y: 26 });
```
  A second test: with only `core` and `shoulder` sizes (a turret), the result contains exactly those two slots and the core's bottom-centre is at (52,108).

- [ ] **Step 4: Run `npm test`.** Expected: the three new files fail on missing modules.

- [ ] **Step 5: Implement `src/ui/mechLayout.ts`** with these rules (round every coordinate):
  - legs: bottom-centre at (52,108). Without legs, the core's bottom-centre is at (52,108).
  - core: bottom-centre at the legs' top-centre, moved down 4.
  - head: bottom-centre at (`core.x + 0.62 × core.w`, `core.y + 3`).
  - shoulder joint J = (`core.x + 0.5 × core.w`, `core.y + 0.3 × core.h`).
  - front arm: its point (0.5w, 0.15h) on J. Back arm: same, then moved by (−6, −2), `dim: true`.
  - hand weapons: point (0.25w, 0.5h) on the arm's point (0.5w, 0.92h); `rightHand` on the front arm, `leftHand` on the back arm with `dim: true`. Skipped when there is no arm.
  - shoulder weapon: point (0.4w, 1.0h) on (`core.x + 0.3 × core.w`, `core.y + 2`).
  - draw order: leftHand, back arm, legs, core, head, shoulder, front arm, rightHand; absent slots are omitted.

- [ ] **Step 6: Implement `scripts/art/proxy.ts` and `scripts/art/imageOps.ts`.** `quantize` maps each opaque pixel to the nearest palette colour by squared RGB distance. Use `sharp` only in the CLI scripts for decoding, resizing and encoding; `imageOps.ts` stays pure.

- [ ] **Step 7: Run `npm test`.** Expected: all pass.

- [ ] **Step 8: Build the palette.** Add a `palette` sub-command to `scripts/art/process.ts` that reduces `art/reference/style-ref.png` to 32 colours with `image-q` and writes them to `art/palette.json` as `[r, g, b][]`. Run it and commit the file. Write `art/reference/style-ref.json` with the prompt recorded in the spec discussion (`model: gpt-image-2`, `size: 1024x1024`, `quality: low`).

- [ ] **Step 9: Implement `scripts/art/generate.ts`.** `tsx scripts/art/generate.ts [--only id,id] [--force] [--max 20]`. Skips jobs whose raw file exists unless `--force`. Refuses to start when the number of jobs to run exceeds `--max`. Writes to a temporary file and renames on success, so a failed call leaves nothing behind. On `ArtProxyError` prints `id`, status and message, and exits with code 1 after finishing the remaining jobs. Prints a final count of images generated.

- [ ] **Step 10: Check the edit endpoint with one image.** Run `generate.ts --only legs-strider`. Expected: `art/raw/legs-strider.png` and its sidecar exist. If the service rejects `imageEdit` for this model, switch part and enemy jobs to `generateImage` (the style paragraph already carries the style) and note that in `jobs.ts`.

- [ ] **Step 11: Implement `scripts/art/process.ts`.** For each raw image: decode, `chromaKey` against `[255, 0, 255]` with tolerance 60 (not for the background), `trim`, resize to fit the job's box keeping aspect ratio, `quantize` with `art/palette.json`, write `public/sprites/<id>.png`. The background is centre-cropped to 31:27 and resized to exactly 310×270. Finally write `src/content/sprites.json`.

- [ ] **Step 12: Implement `scripts/art/proof.ts`.** Compose all 16 combinations of the two variants of legs, core, head and arms using `layoutMech`, each carrying `wpn-rivet-rifle` (right), `wpn-arc-pistol` (left) and `wpn-mortar-pod` (shoulder). Dimmed sprites are drawn at 65% brightness. Lay them out 4×4 on a dark background at 4× scale and write `art/proof/contact-sheet.png`.

- [ ] **Step 13: Generate, process and build the proof.** Run `generate.ts`, `process.ts`, `proof.ts`. Look at the contact sheet and at each processed sprite. Regenerate individual sprites that are unusable (wrong view, cropped, several objects) with `--only … --force`, staying within 20 images in total for this task.

- [ ] **Step 14: Commit** raw images, sidecars, processed sprites, manifest, palette and contact sheet with message `Add art pipeline and part-sprite proof`.

- [ ] **Step 15: Owner gate.** Send the owner `art/proof/contact-sheet.png` and ask whether mechs assembled from generated parts look good enough. Record the answer in `art/proof/DECISION.md` (`pass` or `fail`, date, one sentence). Continue with Task 3 in both cases: this slice uses these sprites either way, and the answer decides how plan 2 sources the full part set.

---

### Task 3: Rule types, slice content and build statistics

**Files:**
- Create: `src/core/types.ts`, `src/core/build.ts`, `src/content/parts.ts`, `src/content/enemies.ts`
- Test: `tests/core/build.test.ts`, `tests/content/content.test.ts`

**Interfaces:**
- Produces from `src/core/types.ts`:

```ts
export type DamageType = 'kinetic' | 'energy' | 'explosive';
export type FrameSlot = 'head' | 'core' | 'arms' | 'legs';
export type WeaponSlot = 'rightHand' | 'leftHand' | 'shoulder';
export type Resist = Record<DamageType, number>;            // 0..0.6
export interface FramePart { id: string; name: string; kind: FrameSlot; ap: number; resist: Resist;
  weight: number; drain: number; price: number; aim?: number; capacity?: number; mobility?: number }
export interface Generator { id: string; name: string; kind: 'generator'; output: number; cooling: number;
  weight: number; price: number }
export interface Weapon { id: string; name: string; kind: 'weapon'; mount: 'hand' | 'shoulder';
  damageType: DamageType; damage: number; accuracy: number; energy: number; heat: number;
  ammo: number | null; costPerShot: number; weight: number; price: number }
export type Part = FramePart | Generator | Weapon;
export type Catalog = Record<string, Part>;
export interface Build { core: string; generator: string; head?: string; arms?: string; legs?: string;
  rightHand?: string; leftHand?: string; shoulder?: string }
export interface BuildStats { weight: number; capacity: number; load: number; mobility: number; turnEnergy: number }
export type BuildError = 'missingSlot' | 'overweight' | 'insufficientEnergy' | 'wrongMount' | 'unknownPart';
export type AiProfile = 'gunner' | 'skirmisher' | 'bruiser';
export interface EnemyDef { id: string; name: string; build: Build; ai: AiProfile; sprite: string }
```
- Produces from `src/core/build.ts`: `computeBuildStats(build: Build, catalog: Catalog): BuildStats` and `validatePlayerBuild(build: Build, catalog: Catalog): BuildError[]`.
- Produces from `src/content/parts.ts`: `CATALOG: Catalog`, `STARTER_BUILD: Build`, `DEMO_BUILD: Build`.
- Produces from `src/content/enemies.ts`: `ENEMIES: Record<string, EnemyDef>`, `ENCOUNTERS: Record<string, string[]>` with `intro: ['recon-drone', 'recon-drone']` and `outpost: ['gun-turret', 'recon-drone']`.

**Content values.** Resist is written kinetic / energy / explosive.

| Id | Name | Kind | AP | Resist | Weight | Drain | Other |
|---|---|---|---|---|---|---|---|
| `head-scout-mk1` | Scout Mk1 | head | 60 | .10/.10/.10 | 40 | 20 | aim 10 |
| `core-hauler` | Hauler Core | core | 220 | .20/.10/.15 | 260 | 60 | |
| `arms-rigger` | Rigger Arms | arms | 110 | .15/.10/.10 | 120 | 40 | aim 5 |
| `legs-strider` | Strider Legs | legs | 150 | .15/.10/.10 | 200 | 50 | capacity 1000, mobility 30 |
| `core-drone` | Drone Shell | core | 50 | 0/0/0 | 60 | 0 | |
| `legs-rotor` | Rotor Assembly | legs | 30 | 0/0/0 | 40 | 0 | capacity 300, mobility 45 |
| `core-turret` | Turret Housing | core | 260 | .40/.20/.10 | 400 | 0 | |

| Id | Name | Output | Cooling | Weight |
|---|---|---|---|---|
| `gen-kd1` | KD-1 Cell | 400 | 25 | 100 |
| `gen-drone` | Drone Cell | 70 | 20 | 30 |
| `gen-turret` | Turret Feed | 200 | 15 | 50 |

| Id | Name | Mount | Type | Damage | Accuracy | Energy | Heat | Ammo | Cost/shot | Weight |
|---|---|---|---|---|---|---|---|---|---|---|
| `wpn-rivet-rifle` | Rivet Rifle | hand | kinetic | 38 | 75 | 60 | 12 | 30 | 15 | 80 |
| `wpn-arc-pistol` | Arc Pistol | hand | energy | 30 | 80 | 90 | 22 | none | 0 | 50 |
| `wpn-mortar-pod` | Mortar Pod | shoulder | explosive | 70 | 60 | 80 | 30 | 8 | 60 | 140 |
| `wpn-drone-stinger` | Stinger | shoulder | kinetic | 14 | 70 | 50 | 10 | none | 0 | 30 |
| `wpn-turret-cannon` | Bastion Cannon | shoulder | kinetic | 60 | 75 | 120 | 35 | none | 0 | 200 |

Prices for this slice: player frame parts 400, `gen-kd1` 500, player weapons 300; enemy-only parts 0.

- `STARTER_BUILD`: the four player frame parts, `gen-kd1`, `rightHand: 'wpn-rivet-rifle'`.
- `DEMO_BUILD`: the starter build plus `leftHand: 'wpn-arc-pistol'` and `shoulder: 'wpn-mortar-pod'`.
- `recon-drone`: `core-drone`, `legs-rotor`, `gen-drone`, `shoulder: 'wpn-drone-stinger'`, ai `gunner`, sprite `enemy-recon-drone`.
- `gun-turret`: `core-turret`, `gen-turret`, `shoulder: 'wpn-turret-cannon'`, ai `gunner`, sprite `enemy-gun-turret`.

**Rules.** `weight` is the sum over all fitted parts. `capacity` is the legs' capacity, or `Infinity` without legs. `load = weight / capacity` (0 without legs). `mobility = round(legs.mobility × (1 − 0.5 × load))`, or 0 without legs. `turnEnergy = generator.output − Σ frame drain`. `validatePlayerBuild` reports `missingSlot` when head, arms or legs is absent, `unknownPart` for an id not in the catalogue or of the wrong kind for its slot, `wrongMount` for a hand weapon on the shoulder or the reverse, `overweight` when `weight > capacity`, and `insufficientEnergy` when a weapon is fitted and `turnEnergy` is below the cheapest fitted weapon's energy.

- [ ] **Step 1: Write `tests/core/build.test.ts`:**
  - `computeBuildStats(STARTER_BUILD)` equals `{ weight: 800, capacity: 1000, load: 0.8, mobility: 18, turnEnergy: 230 }`.
  - `computeBuildStats(DEMO_BUILD)` has `weight: 990`, `mobility: 15`, `turnEnergy: 230`.
  - the recon drone build has `weight: 160`, `mobility: 33`, `turnEnergy: 70`; the gun turret build has `mobility: 0`, `capacity: Infinity`, `turnEnergy: 200`.
  - `validatePlayerBuild(STARTER_BUILD)` and `(DEMO_BUILD)` return `[]`.
  - removing `head` gives `['missingSlot']`.
  - a fixture weapon of weight 300 in `leftHand` on the demo build gives `['overweight']`.
  - a fixture generator with output 200 on the starter build gives `['insufficientEnergy']`.
  - `shoulder: 'wpn-rivet-rifle'` gives `['wrongMount']`; `core: 'nope'` gives `['unknownPart']`.

- [ ] **Step 2: Write `tests/content/content.test.ts`:** every id referenced by `STARTER_BUILD`, `DEMO_BUILD` and every enemy build exists in `CATALOG` with the right kind; every encounter references existing enemies and has one to three entries; every resist value is between 0 and 0.6; every part name is unique.

- [ ] **Step 3: Run `npm test`.** Expected: FAIL on missing modules.

- [ ] **Step 4: Implement the four files.**

- [ ] **Step 5: Run `npm test` and `npm run typecheck`.** Expected: pass.

- [ ] **Step 6: Commit** with message `Add rule types, slice content and build statistics`.

---

### Task 4: Combat engine

**Files:**
- Create: `src/core/rng.ts`, `src/core/battle.ts`
- Test: `tests/core/rng.test.ts`, `tests/core/battle.test.ts`

**Interfaces:**
- Consumes: everything from Task 3.
- Produces from `src/core/rng.ts`: `nextRandom(state: number): { value: number; state: number }` (mulberry32; `value` in [0, 1)).
- Produces from `src/core/battle.ts`:

```ts
export interface PartState { ap: number; maxAp: number }
export interface UnitState { id: string; name: string; side: 'player' | 'enemy'; build: Build; ai?: AiProfile;
  sprite?: string; parts: Partial<Record<FrameSlot, PartState>>; heat: number; energy: number;
  ammo: Partial<Record<WeaponSlot, number | null>>; boosted: boolean; overheated: boolean;
  usedBoost: boolean; usedCool: boolean; fired: WeaponSlot[]; repairsLeft: number; destroyed: boolean }
export type BattleEvent =
  | { type: 'turnStart'; unit: string } | { type: 'turnSkipped'; unit: string }
  | { type: 'shot'; unit: string; weapon: WeaponSlot; target: string; part: FrameSlot; hit: boolean; damage: number }
  | { type: 'partDestroyed'; unit: string; part: FrameSlot } | { type: 'unitDestroyed'; unit: string }
  | { type: 'boost'; unit: string } | { type: 'cool'; unit: string; amount: number }
  | { type: 'repair'; unit: string; part: FrameSlot; amount: number }
  | { type: 'overheat'; unit: string } | { type: 'outcome'; outcome: 'victory' | 'defeat' };
export interface BattleState { units: UnitState[]; round: number; order: string[]; turn: number;
  rng: number; events: BattleEvent[]; outcome: 'ongoing' | 'victory' | 'defeat' }
export type Action =
  | { type: 'fire'; weapon: WeaponSlot; target: string; part: FrameSlot }
  | { type: 'boost' } | { type: 'cool' } | { type: 'repair'; part: FrameSlot } | { type: 'endTurn' };
export type Refusal = 'notYourTurn' | 'noEnergy' | 'noAmmo' | 'alreadyFired' | 'weaponDisabled' | 'noWeapon'
  | 'invalidTarget' | 'alreadyUsed' | 'legsDisabled' | 'noRepairs' | 'partDestroyed' | 'partFull' | 'battleOver';

export function createBattle(player: Build, enemies: EnemyDef[], catalog: Catalog, seed: number): BattleState;
export function activeUnit(state: BattleState): UnitState;
export function evasion(unit: UnitState, catalog: Catalog): number;
export function previewShot(state: BattleState, attacker: string, weapon: WeaponSlot, target: string,
  part: FrameSlot, catalog: Catalog): { hitChance: number; damage: number };
export function checkAction(state: BattleState, action: Action, catalog: Catalog): Refusal | null;
export function applyAction(state: BattleState, action: Action, catalog: Catalog, roll?: () => number): BattleState;
export const BOOST_EVASION = 30, HEAT_LIMIT = 100, HEAT_AFTER_OVERHEAT = 50, REPAIRS_PER_MISSION = 2,
  REPAIR_FRACTION = 0.4, HEAD_LOSS_PENALTY = 30, ROUND_LIMIT = 60;
export const PART_MODIFIER: Record<FrameSlot, number> = { core: 0, legs: -5, arms: -10, head: -20 };
```

**Rules** (spec §4):
- Unit ids: `player`, then `enemy-0`, `enemy-1`, `enemy-2`. A unit only has `parts` entries for frame slots present in its build.
- A round's `order` is all living units by current mobility, highest first; ties go to the player, then to the lower enemy index. Mobility counts as 0 when the legs are destroyed. `order` is recomputed at the start of each round.
- Turn start: if `overheated`, emit `turnSkipped`, set `heat = 50`, clear the flag and pass the turn. Otherwise set `energy` to the build's `turnEnergy`, clear `boosted`, `usedBoost`, `usedCool` and `fired`, emit `turnStart`.
- `evasion` = current mobility, plus 30 when `boosted`; 0 when legs are destroyed or absent.
- Hit chance = `clamp(weapon.accuracy + aim − evasion(target) + PART_MODIFIER[part] − headPenalty, 10, 95)`. `aim` is the head's aim when the head is present and not destroyed, plus the arms' aim for a hand weapon when the arms are not destroyed. `headPenalty` is 30 when the attacker's build has a head and it is destroyed.
- Damage = `max(1, round(weapon.damage × (1 − targetPart.resist[type])))`, using the targeted part's resist. A shot hits when `roll() × 100 < hitChance`; without a `roll` argument the roll comes from `state.rng`.
- A hit on a part with `ap > 0` lowers it, to no less than 0; overflow is lost. A hit on a destroyed part deals `max(1, floor(damage / 2))` to the core instead. A part reaching 0 emits `partDestroyed`; the core reaching 0 marks the unit destroyed.
- `fire` costs the weapon's energy and one ammo (when ammo is not `null`), adds its heat and records the slot in `fired`. Heat above 100 sets `overheated` and emits `overheat`; the current turn continues.
- `boost` costs `ceil(0.3 × turnEnergy)`. `cool` costs `ceil(0.2 × turnEnergy)` and removes heat equal to the generator's cooling. Each once per turn.
- `repair` restores `round(0.4 × maxAp)` to one part, capped at `maxAp`, uses one of the two repairs and ends the turn.
- End of turn: heat drops by the generator's cooling, to no less than 0; then the next living unit in `order` starts its turn, or a new round begins.
- `checkAction` refusals: `battleOver` when the outcome is decided; `fire` gives `noWeapon` (empty slot), `weaponDisabled` (hand weapon with destroyed arms), `alreadyFired`, `noAmmo`, `noEnergy`, `invalidTarget` (unknown, destroyed or same-side target, or a part the target does not have); `boost` gives `alreadyUsed`, `legsDisabled`, `noEnergy`; `cool` gives `alreadyUsed`, `noEnergy`; `repair` gives `noRepairs`, `partDestroyed`, `partFull`, `invalidTarget` (a part the unit does not have). `endTurn` is refused only by `battleOver`. `applyAction` throws `Error('illegal action: <refusal>')` for a refused action.
- Outcome: `victory` when all enemies are destroyed, `defeat` when the player is destroyed or when round 60 ends with the battle undecided. Emits `outcome` once.
- `applyAction` never mutates its input and appends events to a copy of `events`.

- [ ] **Step 1: Write `tests/core/rng.test.ts`:** the same seed yields the same first five values; seeds 1 and 2 differ; 10 000 values all lie in [0, 1) with a mean between 0.48 and 0.52.

- [ ] **Step 2: Write `tests/core/battle.test.ts`.** Helpers: `demo(enemies)` creates a battle with `DEMO_BUILD` and seed 1; `hit = () => 0` and `miss = () => 0.999`. Tests:
  - **order:** `demo(['gun-turret', 'recon-drone'])` has `order` `['enemy-1', 'player', 'enemy-0']`.
  - **preview:** player rifle at drone core `{ hitChance: 57, damage: 38 }`; at drone legs `hitChance: 52`; rifle at turret core `{ hitChance: 90, damage: 23 }`; mortar at turret core `{ hitChance: 70, damage: 63 }`; arc pistol at turret core `damage: 24`; drone stinger at player core `{ hitChance: 55, damage: 11 }`; turret cannon at player core `{ hitChance: 60, damage: 48 }`.
  - **boost:** after the player boosts, the turret's preview against the player core is `hitChance: 30`, the player's energy is 161, and a second boost is refused with `alreadyUsed`. The boost ends when the player's next turn starts.
  - **clamp:** a fixture weapon with accuracy 5 previews at 10; one with accuracy 200 previews at 95.
  - **hit and miss:** a forced hit lowers the drone core from 50 to 12 and the rifle's ammo from 30 to 29; a forced miss leaves AP unchanged and still spends ammo, energy and heat.
  - **one shot per weapon:** a second rifle shot in the same turn is refused with `alreadyFired`.
  - **destroyed part passes damage on:** two forced rifle hits on the drone's legs on consecutive player turns leave legs at 0 and core at 31, with one `partDestroyed` event.
  - **legs destroyed:** that drone's `evasion` is 0 and its `boost` is refused with `legsDisabled`.
  - **arms destroyed:** with the player's arms set to 0, firing `rightHand` is refused with `weaponDisabled` and firing `shoulder` is allowed.
  - **head destroyed:** with the player's head set to 0, the rifle previews at 17 against the drone core (75 + 5 − 33 − 30).
  - **heat:** firing all three weapons gives heat 64 and energy 0; after `endTurn` heat is 39. On the next player turn all three again gives heat 103, `overheated: true` and an `overheat` event; after `endTurn` heat is 78. The following player turn is skipped with a `turnSkipped` event and heat becomes 50.
  - **cool:** at the start of a player turn with heat set to 64, `cool` gives heat 39 and energy 184.
  - **repair:** with the core at 100, `repair core` gives 188, `repairsLeft: 1`, and the active unit is no longer the player. With the core at 200 it gives 220. A third repair is refused with `noRepairs`; a destroyed part with `partDestroyed`; a full part with `partFull`.
  - **victory:** destroying the last enemy's core sets `outcome: 'victory'`, and any further action is refused with `battleOver`.
  - **defeat:** setting the player core to 1 and letting a turret hit sets `outcome: 'defeat'`.
  - **always able to end the turn:** with arms destroyed, shoulder ammo 0 and energy 0, `checkAction(endTurn)` is `null`.
  - **stalemate:** a battle in which every unit only ends its turn reaches `outcome: 'defeat'` with `round` 60, in fewer than 1 000 `applyAction` calls.
  - **purity:** `applyAction` leaves its input state deeply equal to a clone taken before the call.
  - **determinism:** two battles with the same seed and the same action list produce equal event lists; seed 2 produces a different list for the same 20 fire actions.

- [ ] **Step 3: Run `npm test`.** Expected: FAIL on missing modules.

- [ ] **Step 4: Implement `src/core/rng.ts` and `src/core/battle.ts`.** Use `structuredClone` for state copies. Keep turn advancement in one internal function used by `endTurn`, `repair` and the overheated skip.

- [ ] **Step 5: Run `npm test` and `npm run typecheck`.** Expected: pass.

- [ ] **Step 6: Commit** with message `Add combat engine`.

---

### Task 5: Enemy behaviour and battle simulation

**Files:**
- Create: `src/core/ai.ts`, `scripts/simulate.ts`
- Modify: `package.json` (script `simulate`)
- Test: `tests/core/ai.test.ts`, `tests/core/balance.test.ts`

**Interfaces:**
- Consumes: `BattleState`, `Action`, `checkAction`, `applyAction`, `previewShot`, `activeUnit` from Task 4.
- Produces from `src/core/ai.ts`:
  - `chooseEnemyAction(state: BattleState, catalog: Catalog): Action`
  - `chooseAutoPlayerAction(state: BattleState, catalog: Catalog): Action`
  - `runBattle(state: BattleState, catalog: Catalog, playerPolicy: (s: BattleState, c: Catalog) => Action): BattleState` — plays until the outcome is decided.

**Enemy rules.** Evaluated in order for the active enemy; the first that applies is returned. "Usable weapon" means `checkAction` allows firing it at the player's core.
1. If a usable weapon exists whose heat would bring the unit above 100, and `cool` is allowed: `cool`.
2. Profile `skirmisher` only: if `boost` is allowed and, after paying for it, the cheapest usable weapon is still affordable: `boost`.
3. If a usable weapon exists whose heat keeps the unit at or below 100: fire the first such weapon in the order `shoulder`, `rightHand`, `leftHand`, at the player, at the part chosen by profile: `gunner` → core; `skirmisher` → head while it is above 0, else core; `bruiser` → the non-destroyed part with the lowest `ap / maxAp`, ties broken in the order core, legs, arms, head.
4. Otherwise `endTurn`.

**Auto-player rules.** Same shape: cool when the next shot would overheat and cooling is allowed; otherwise fire the first usable weapon (order `rightHand`, `leftHand`, `shoulder`) that keeps heat at or below 100 at the core of the living enemy with the lowest core AP; otherwise `endTurn`.

- [ ] **Step 1: Write `tests/core/ai.test.ts`:**
  - a turret at heat 0 on its turn returns `fire` with `weapon: 'shoulder'`, `target: 'player'`, `part: 'core'`;
  - a turret at heat 80 returns `cool`; applying it and asking again returns the `fire` action; applying that and asking again returns `endTurn`;
  - a fixture `skirmisher` with enough energy returns `boost` first, then fires at `head`; with the player's head at 0 it fires at `core`;
  - a fixture `bruiser` fires at `arms` when the player's arms are at 10 of 110 and everything else is full;
  - every action returned over a full `runBattle` on encounters `intro` and `outpost` is accepted by `checkAction` (wrap the policy and the enemy chooser to assert this).

- [ ] **Step 2: Write `tests/core/balance.test.ts`:** over seeds 1..300 with `DEMO_BUILD` and `chooseAutoPlayerAction`, the `intro` encounter is won in at least 95% of battles and the `outpost` encounter in at least 60% and at most 98%.

- [ ] **Step 3: Run `npm test`.** Expected: FAIL on missing module.

- [ ] **Step 4: Implement `src/core/ai.ts`.**

- [ ] **Step 5: Implement `scripts/simulate.ts`.** `npm run simulate -- --encounter outpost --build demo --seeds 500` prints win rate, mean rounds, and mean remaining player core AP.

- [ ] **Step 6: Run `npm test`.** If only the balance test fails, adjust enemy values in `src/content/parts.ts` (damage, accuracy, AP of enemy-only parts; never the rules or player parts), update the affected expected numbers in `tests/core/battle.test.ts` and the table in this plan, and re-run until all pass.

- [ ] **Step 7: Commit** with message `Add enemy behaviour and battle simulation`.

---

### Task 6: Input mapping

**Files:**
- Create: `src/platform/input.ts`
- Test: `tests/platform/input.test.ts`

**Interfaces:**
- Produces:

```ts
export type InputAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'prev' | 'next' | 'menu';
export const KEY_MAP: Record<string, InputAction>;       // by KeyboardEvent.code
export const PAD_BUTTON_MAP: Record<number, InputAction>; // by standard gamepad button index
export class InputMapper {
  setDown(source: 'key' | 'pad', action: InputAction, down: boolean, timeMs: number): void;
  poll(timeMs: number): InputAction[];   // actions to deliver now, in order; clears the queue
}
export function attachInput(target: Window, mapper: InputMapper): { sample(timeMs: number): void; detach(): void };
```
- `KEY_MAP`: `ArrowUp/Down/Left/Right`, `Enter → confirm`, `Escape → cancel`, `KeyQ → prev`, `KeyE → next`, `Space → menu`.
- `PAD_BUTTON_MAP`: `12 → up`, `13 → down`, `14 → left`, `15 → right`, `0 → confirm`, `1 → cancel`, `4 → prev`, `5 → next`, `9 → menu`. Axes 0 and 1 beyond ±0.5 count as left/right and up/down.

**Rules.** A press delivers its action once. The same action pressed from the other source within 80 ms of the first is ignored. A held direction repeats after 350 ms and then every 120 ms; the other five actions never repeat. An action counts as held while either source holds it. `attachInput` listens to `keydown`/`keyup` (calling `preventDefault` for mapped keys and ignoring `event.repeat`) and `sample` reads `navigator.getGamepads()` once per frame.

- [ ] **Step 1: Write `tests/platform/input.test.ts`:**
  - one press: `setDown('key', 'confirm', true, 0)` then `poll(0)` is `['confirm']`, and `poll(16)` is `[]`;
  - double source: `setDown('pad', 'up', true, 0)`, `setDown('key', 'up', true, 30)`, `poll(30)` is `['up']`;
  - separate presses: pad `up` down at 0 and up at 50, key `up` down at 200 gives two `up` actions in total;
  - hold: `down` held from 0 yields exactly one action by `poll(349)`, a second at `poll(350)`, a third at `poll(470)`, and none after release;
  - no repeat for `confirm` held for 2 000 ms;
  - order: `left` at 0 and `confirm` at 5 are delivered in that order by one `poll(10)`;
  - `KEY_MAP` and `PAD_BUTTON_MAP` together cover all nine actions.

- [ ] **Step 2: Run `npm test`.** Expected: FAIL on missing module.

- [ ] **Step 3: Implement `src/platform/input.ts`.**

- [ ] **Step 4: Run `npm test` and `npm run typecheck`.** Expected: pass.

- [ ] **Step 5: Commit** with message `Add input mapping for keyboard and gamepad`.

---

### Task 7: Battle screen

**Files:**
- Create: `src/content/strings.ts`, `src/ui/widgets.ts`, `src/ui/sprites.ts`, `src/ui/battleScreen.ts`
- Modify: `src/main.ts`
- Test: `tests/ui/battleFlow.test.ts`, `e2e/battle.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces from `src/ui/sprites.ts`: `loadSprites(manifest: Record<string, { file: string; w: number; h: number }>): Promise<SpriteStore>`, where `SpriteStore.get(id: string, fallback: { w: number; h: number; label: string }): { image: CanvasImageSource; w: number; h: number }`. A missing or failed image yields a generated placeholder: a `#5a2a6a` rectangle of the fallback size with the label inside it. `loadSprites` never rejects.
- Produces from `src/ui/battleScreen.ts`:

```ts
export type BattlePhase = 'action' | 'weapon' | 'target' | 'repairPart' | 'animating' | 'result';
export interface MenuView { items: { id: string; label: string; enabled: boolean }[]; cursor: number }
export class BattleFlow {            // no canvas, fully unit-testable
  constructor(state: BattleState, catalog: Catalog);
  readonly state: BattleState; readonly phase: BattlePhase; readonly menu: MenuView;
  readonly targetId: string | null; readonly targetPart: FrameSlot | null;
  readonly preview: { hitChance: number; damage: number } | null;
  readonly message: string;
  onInput(action: InputAction): void;
  advance(): void;                   // show the next queued event, or run the next enemy action
}
export class BattleScreen { constructor(flow: BattleFlow, sprites: SpriteStore, opts: { fast: boolean });
  update(dtMs: number): void; draw(ctx: CanvasRenderingContext2D): void; onInput(action: InputAction): void }
```

**Flow.**
- `action` phase menu, in this order: `fire` "Fire", `boost` "Boost", `cool` "Cool", `repair` "Field Repair", `endTurn` "End Turn". An item is enabled when at least one matching action passes `checkAction`. `up`/`down` move the cursor over all items and wrap; `confirm` on a disabled item does nothing.
- `fire` → `weapon` phase: lists only weapons that can fire now, by name with energy cost and remaining ammo. `confirm` → `target` phase.
- `target` phase: `prev`/`next` cycle living enemies; `up`/`down` cycle the selected enemy's existing parts in the order core, legs, arms, head, starting on core. `preview` is always set in this phase. `confirm` fires and moves to `animating`.
- `repair` → `repairPart` phase: lists the player's parts that pass `checkAction`; `confirm` repairs.
- `cancel` returns to the previous phase from `weapon`, `target` and `repairPart`.
- `animating`: each new `BattleEvent` becomes one message from `strings.ts` (for example `Rivet Rifle hits Recon Drone — core −38`, `Rivet Rifle misses`, `Recon Drone destroyed`, `Overheated! Next turn lost`). `BattleScreen.update` calls `flow.advance()` every 600 ms, or every frame when `fast` is true. When the queue is empty and the active unit is an enemy, `advance()` applies `chooseEnemyAction`. When the queue is empty and it is the player's turn, the phase returns to `action`.
- `result`: reached when the outcome is decided and all messages have been shown. Shows `VICTORY` or `DEFEAT`.
- After every player action that leaves the player's turn active, the phase returns to `action` with the cursor on the first enabled item.

**Layout** (logical units, font VT323 at 12 for body and 16 for headings):
- background sprite `bg-quarry` fills the screen;
- player mech composed with `layoutMech` in a 112×112 box with its top-left at (14, 58); dimmed commands are drawn at 65% brightness;
- up to three enemies drawn from their `sprite` at (196, 44), (228, 84), (196, 124) scaled to fit 64×64; the selected enemy in `target` phase has a bracket marker; destroyed enemies are not drawn;
- top bar, 14 high: current message;
- bottom panel from y = 178 to 270: left 118 wide holds the current menu; the rest shows, for the player, an AP bar per part plus `EN` and `HEAT` meters, and in `target` phase the selected enemy's parts with AP bars, the hit chance and the expected damage for the highlighted part;
- the `HEAT` meter turns `#e04a2c` above 75; a destroyed part's bar is drawn empty and its label struck through.

**`src/main.ts`.** Read URL parameters `encounter` (default `intro`), `seed` (default: current time), `fast` (`1` or absent). Create the battle with `DEMO_BUILD`, load sprites, run a `requestAnimationFrame` loop that samples input, delivers polled actions to the screen, updates and draws. Expose `window.__game = { battle: () => ({ outcome, round, phase, menu, message }) }`.

- [ ] **Step 1: Write `tests/ui/battleFlow.test.ts`** with a battle of `DEMO_BUILD` against encounter `intro`, seed 1:
  - initial `phase` is `action` after `advance()` has been called until the player is active; menu ids are `['fire', 'boost', 'cool', 'repair', 'endTurn']`, with `repair` disabled (all parts full) and the cursor on `fire`;
  - `confirm` → `weapon` phase listing three weapons; `confirm` → `target` phase with `targetId: 'enemy-0'`, `targetPart: 'core'`, `preview` equal to `previewShot` for that shot;
  - `next` selects `enemy-1`; `down` selects `legs`; `cancel` returns to `weapon`, `cancel` again to `action`;
  - confirming the shot changes `state` (rifle ammo 29) and yields a non-empty `message`;
  - with energy below every weapon's cost, `fire` is disabled, `confirm` on it leaves `phase` as `action`, and moving to `endTurn` and confirming passes the turn;
  - driving the flow with the policy "fire first weapon at first target if enabled, else end turn" plus `advance()` until `phase === 'result'` terminates within 5 000 steps and `message` is `VICTORY` or `DEFEAT` matching `state.outcome`.

- [ ] **Step 2: Write `e2e/battle.spec.ts`:**
  - open `/?encounter=intro&seed=7&fast=1`, wait for `window.__game`, and loop at most 400 times: read `__game.battle()`; if `phase` is `result`, stop; if `phase` is `action` and `fire` is enabled press `Enter` three times (fire, first weapon, first target's core); else if `phase` is `action` press `ArrowDown` until `menu.cursor` is on `endTurn`, then `Enter`; otherwise wait 50 ms. Expect the final `outcome` to be `victory` or `defeat` and `message` to match it. Save a screenshot of the first `action` phase and of the result to `test-results/`.
  - open `/?encounter=outpost&seed=3&fast=1` with requests to `/sprites/**` aborted; expect no page errors and the first `action` phase to be reached (placeholders in use).

- [ ] **Step 3: Run `npm test` and `npm run e2e -- --trace off`.** Expected: FAIL on missing modules.

- [ ] **Step 4: Implement `src/content/strings.ts`, `src/ui/widgets.ts` (`drawText`, `drawPanel`, `drawMeter`, `drawMenu`), `src/ui/sprites.ts`, `src/ui/battleScreen.ts`, and update `src/main.ts`.** Load VT323 through `@fontsource/vt323` and wait for `document.fonts.ready` before the first frame.

- [ ] **Step 5: Run `npm test`, `npm run typecheck`, `npm run e2e -- --trace off`.** Expected: all pass.

- [ ] **Step 6: Review the two screenshots** at 1240×1080: all text readable and inside its panel, nothing overlapping, the mech assembled without gaps, meters reflecting the state. Fix what is wrong and re-run Step 5.

- [ ] **Step 7: Commit** with message `Add playable battle screen`.

- [ ] **Step 8: Hand over.** Send the owner the two screenshots and the command to play in a browser (`npm install`, then `npm run dev`; arrow keys, Enter, Escape, Q/E), and ask for feedback on the feel of a battle before plan 2 is written.
