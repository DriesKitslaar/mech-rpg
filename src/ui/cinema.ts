import { drawCone, drawGlow, ringOf, soft, wide, type Pt } from './light';
import { drawWord, fitTall, wordTop } from './signType';
import { COLORS, drawOutlined, drawText } from './widgets';

/**
 * The moments a battle is staged like a film. An Overdrive goes off behind a band across the field
 * with the pilot's own mech large in it. The last machine of a battle goes down slowly and from
 * close by, between two black bars. And a battle that is over looks like what it was: light on a
 * field that was won, the colour gone out of one that was lost. All of it follows from how long
 * the moment has been going; none of it moves a word of the interface.
 */

const scatter = (a: number, b: number): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** The field: the part of the screen between the bar along the top and the panel underneath. */
export interface Field { top: number; height: number; width: number }

/* ---- The Overdrive's cut-in ---- */

/** How long the band is up, how long it takes to open and to close, and how tall it is when open. */
export const CUT_IN_MS = 900;
const CUT_OPEN_MS = 110;
const CUT_CLOSE_MS = 150;
export const CUT_IN_H = 68;
/** How many speed lines cross the band. */
export const SPEED_LINES = 16;
/** Twice life size: the mech's pixels stay square. */
export const CUT_IN_SCALE = 2;
/** Where a mech's head is, from the corner the mech is drawn at. */
export const MECH_HEAD = { x: 83, y: 27 };
const HEAD = MECH_HEAD;

/** How far open the band is, from 0 to 1, this long after the Overdrive went off. */
export function cutInOpen(ms: number): number {
  if (ms < 0 || ms >= CUT_IN_MS) return 0;
  if (ms < CUT_OPEN_MS) return ms / CUT_OPEN_MS;
  if (ms > CUT_IN_MS - CUT_CLOSE_MS) return (CUT_IN_MS - ms) / CUT_CLOSE_MS;
  return 1;
}

/** How tall the letters of the name in the band are at most, and how wide the name may be: the mech has the left of the band. */
export const CUT_IN_NAME_TALL = 18;
export const CUT_IN_NAME_W = 142;

/**
 * The band across the middle of the field: dark, edged in the game's colour, with speed lines
 * racing through it, the mech's head and shoulders at twice life size sliding in from the left,
 * and at the right what the Overdrive is called. `mech` draws the mech with its corner at 0, 0.
 * A calm picture leaves out the flash the band opens with and has its wash of colour at half strength.
 */
export function drawCutIn(
  ctx: CanvasRenderingContext2D, ms: number, field: Field, words: { heading: string; name: string },
  mech: (ctx: CanvasRenderingContext2D) => void, calm = false,
): void {
  const open = cutInOpen(ms);
  if (open <= 0) return;
  const middle = field.top + Math.round(field.height / 2) - 4;
  const h = Math.max(2, Math.round(CUT_IN_H * open));
  const top = middle - Math.floor(h / 2);
  ctx.fillStyle = 'rgba(8, 6, 22, 0.94)';
  ctx.fillRect(0, top, field.width, h);
  // The game's colour washes in from the left: soft light, where the canvas can make it.
  const wash = soft() ? ctx.createLinearGradient?.(0, 0, field.width, 0) as CanvasGradient | undefined : undefined;
  if (wash && typeof wash.addColorStop === 'function') {
    // Soft light: a calm picture has it at half strength.
    wash.addColorStop(0, `rgba(255, 93, 177, ${calm ? 0.17 : 0.34})`);
    wash.addColorStop(0.7, `rgba(255, 93, 177, ${calm ? 0.03 : 0.06})`);
    wash.addColorStop(1, 'rgba(255, 93, 177, 0)');
    const before = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = wash;
    ctx.fillRect(0, top, field.width, h);
    ctx.globalCompositeOperation = before;
  }
  // Speed lines, right to left, each at its own height and pace.
  for (let i = 0; i < SPEED_LINES; i++) {
    const y = top + 2 + Math.floor(scatter(i, 1) * Math.max(1, h - 4));
    const length = 24 + Math.floor(50 * scatter(i, 2));
    const pace = 480 + 520 * scatter(i, 3);
    const span = field.width + length;
    const x = Math.round(field.width - (((ms * pace) / 1000 + scatter(i, 4) * span) % span));
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 93, 177, 0.45)';
    ctx.fillRect(x, y, length, 1);
  }
  // The mech: it comes in fast and then drifts on slowly. Nothing of it shows outside the band.
  const arrive = Math.min(1, ms / 180);
  const slide = Math.round(-70 * (1 - arrive) * (1 - arrive) + (8 * ms) / CUT_IN_MS);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, field.width, h);
  ctx.clip();
  ctx.translate(80 - HEAD.x * CUT_IN_SCALE + slide, middle - 14 - HEAD.y * CUT_IN_SCALE);
  ctx.scale(CUT_IN_SCALE, CUT_IN_SCALE);
  mech(ctx);
  ctx.restore();
  // The band's edges: the game's colour outside, a thin pale line inside.
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, top, field.width, 1);
  ctx.fillRect(0, top + h - 1, field.width, 1);
  if (h >= 8) {
    ctx.fillStyle = 'rgba(255, 214, 236, 0.4)';
    ctx.fillRect(0, top + 2, field.width, 1);
    ctx.fillRect(0, top + h - 3, field.width, 1);
  }
  // What it is called, once the band is open enough to hold it.
  if (h >= 44) {
    drawText(ctx, words.heading, field.width - 12, middle - 22, { size: 10, align: 'right', color: COLORS.accent });
    // Its name in the sign's letters, steel, as tall as fits beside the mech; in the font where the sign cannot write it.
    const tall = fitTall(words.name, CUT_IN_NAME_W, CUT_IN_NAME_TALL);
    if (tall === null) drawOutlined(ctx, words.name, field.width - 12, middle - 12, { size: 20, align: 'right', color: '#ffffff' });
    else drawWord(ctx, words.name, field.width - 10, wordTop(middle - 1, tall), { tall, metal: 'steel', align: 'right' });
  }
  // It opens with a flash of its own.
  if (!calm && ms < 70) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.5 * (1 - ms / 70)).toFixed(2)})`;
    ctx.fillRect(0, top, field.width, h);
  }
}

/* ---- A boss's entrance ---- */

/** How tall the band a boss comes in on is, and where its window on the boss begins: the words have the left of the band, the boss the right. */
export const ENTRANCE_H = 68;
export const ENTRANCE_WINDOW_X = 164;
/** Twice life size: the boss's pixels stay square. */
export const ENTRANCE_SCALE = 2;
/** How tall the letters of the warning and of the boss's name are at most, and how wide either may be. */
export const ENTRANCE_WARNING_TALL = 23;
export const ENTRANCE_NAME_TALL = 18;
export const ENTRANCE_WORDS_W = ENTRANCE_WINDOW_X - 16;
/** How far through the band's time the boss's eye begins to open, and how long it takes to. */
export const EYE_OPENS_AT = 0.2;
export const EYE_OPENS_FOR = 0.1;
/** The band and its stripes. */
const ENTRANCE_PLATE = 'rgba(8, 8, 20, 0.92)';
const STRIPE = 16;

/** The boss as the band shows it. */
export interface Entrant {
  /** Draws the boss with the corner of its picture at 0, 0, facing left as it stands on the field. */
  draw(ctx: CanvasRenderingContext2D): void;
  /** What the window looks at, on that picture: its eye, or where its head is. */
  focus: Pt;
  /** The light of its eye, where it has one that is known. */
  eye: { r: number; color: string } | null;
}

/** How far to the right of its place the band is, this far through its time: it comes in from the right, holds, and leaves to the left. */
export function entranceShift(share: number, width: number): number {
  return Math.round(width * (1 - Math.min(1, share / 0.16) - Math.max(0, (share - 0.88) / 0.12)));
}

/** How open the boss's eye is, from 0 to 1, this far through the band's time: shut, then open in a blink, then holding with a slow swell. A calm picture has it simply open. */
export function entranceEye(share: number, clockMs: number, calm = false): number {
  if (calm) return 1;
  if (share < EYE_OPENS_AT) return 0;
  const open = Math.min(1, (share - EYE_OPENS_AT) / EYE_OPENS_FOR);
  return open * (0.8 + 0.2 * Math.sin(clockMs / 160));
}

/**
 * The band a boss comes in on: across the middle of the field, from the right. Hazard stripes run
 * along its edges; at the left the warning and the boss's name, in the sign's letters; at the
 * right a window on the boss itself at twice its size, looked at where its eye is, and the eye
 * opens. `share` is how far through the band's time it is, from 0 to 1; `alarm` is which of its
 * two colours the warning is in at this moment. Words the sign cannot write, or that do not fit,
 * are written in the font. A calm picture has the eye's light at half strength, and steady.
 */
export function drawEntrance(
  ctx: CanvasRenderingContext2D, share: number, clockMs: number, field: Field,
  words: { warning: string; name: string; alarm: boolean }, boss: Entrant | null, calm = false,
): void {
  const x = entranceShift(share, field.width);
  const middle = field.top + Math.round(field.height / 2) - 4;
  const top = middle - ENTRANCE_H / 2;
  ctx.fillStyle = ENTRANCE_PLATE;
  ctx.fillRect(x, top, field.width, ENTRANCE_H);
  if (boss) {
    // The window: the boss at twice its size, what it is looked at by in the middle of it.
    const windowW = field.width - ENTRANCE_WINDOW_X;
    const { focus } = boss;
    // It comes in a little behind the band, and then drifts on slowly.
    const behind = Math.max(0, 1 - share / 0.3);
    const drift = Math.round(36 * behind * behind - 6 * share);
    const eyeX = x + ENTRANCE_WINDOW_X + Math.round(windowW / 2) + drift;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + ENTRANCE_WINDOW_X, top, windowW, ENTRANCE_H);
    ctx.clip();
    ctx.fillStyle = 'rgba(40, 8, 14, 0.9)';
    ctx.fillRect(x + ENTRANCE_WINDOW_X, top, windowW, ENTRANCE_H);
    ctx.translate(eyeX - focus.x * ENTRANCE_SCALE, middle - focus.y * ENTRANCE_SCALE);
    ctx.scale(ENTRANCE_SCALE, ENTRANCE_SCALE);
    boss.draw(ctx);
    ctx.restore();
    // The eye opens: a light on it, soft, that is not there where no soft light is drawn.
    if (boss.eye) {
      const open = entranceEye(share, clockMs, calm);
      if (eyeX > x + ENTRANCE_WINDOW_X) drawGlow(ctx, { x: eyeX, y: middle, r: boss.eye.r * ENTRANCE_SCALE + 10, color: boss.eye.color, alpha: 0.6 * open }, calm ? 0.5 : 1);
    }
    // The window's edge.
    ctx.fillStyle = COLORS.danger;
    ctx.fillRect(x + ENTRANCE_WINDOW_X, top, 1, ENTRANCE_H);
  }
  // Hazard stripes run along both edges, the one way along the top and the other along the bottom.
  const shift = Math.floor(clockMs / 40) % STRIPE;
  ctx.fillStyle = COLORS.danger;
  for (let sx = -STRIPE; sx < field.width + STRIPE; sx += STRIPE) {
    ctx.fillRect(x + sx + shift, top, 8, 3);
    ctx.fillRect(x + sx + STRIPE - shift, top + ENTRANCE_H - 3, 8, 3);
  }
  // The words: over the whole band where there is no boss to show, else at its left.
  const room = boss ? ENTRANCE_WORDS_W : field.width - 20;
  const cx = x + (boss ? ENTRANCE_WINDOW_X / 2 : field.width / 2);
  const warning = fitTall(words.warning, room, ENTRANCE_WARNING_TALL);
  if (warning === null) drawText(ctx, words.warning, cx, top + 6, { size: 32, align: 'center', color: words.alarm ? COLORS.danger : COLORS.heat });
  else drawWord(ctx, words.warning, cx, top + 8, { tall: warning, metal: words.alarm ? 'red' : 'amber' });
  const name = fitTall(words.name, room, ENTRANCE_NAME_TALL);
  if (name === null) drawText(ctx, words.name, cx, top + 44, { align: 'center' });
  else drawWord(ctx, words.name, cx, wordTop(top + 50, name), { tall: name, metal: 'steel' });
}

/* ---- The last machine of a battle ---- */

/**
 * How long the field is held at the blow, how slowly things move in the close look, and how long
 * the look lasts on the field's own clock: until the machine's last blast, which goes off 300
 * milliseconds into its going up, has had 200 to bloom. At half speed that is a second of the
 * player's time; with battles played faster it is less, and the blast is in it all the same.
 */
export const FINISH_HOLD_MS = 160;
export const FINISH_SLOW = 0.5;
export const FINISH_FIELD_MS = 500;
/** Twice as close: the pixels stay square. */
export const FINISH_ZOOM = 2;
/** How tall the black bars are that close in over the top and the bottom of the field. */
export const LETTERBOX = 12;

/**
 * Whether the machine destroyed by the event at `index` is the one the battle ends with: the last
 * to fall of the side that lost. Not while the battle is still on, not a machine of the side that
 * won, and not one that another of its own side follows. (A bomb that takes the pilot with it goes
 * up after the pilot does: the battle still ends with the pilot.)
 */
export function endsBattle(
  events: readonly { type: string; unit?: string }[], outcome: 'ongoing' | 'victory' | 'defeat', index: number,
): boolean {
  const event = events[index];
  if (!event || event.type !== 'unitDestroyed' || outcome === 'ongoing') return false;
  const lost = (unit: string | undefined): boolean => (outcome === 'defeat') === (unit === 'player');
  if (!lost(event.unit)) return false;
  return !events.slice(index + 1).some((later) => later.type === 'unitDestroyed' && lost(later.unit));
}

/**
 * How far in the black bars are, from 0 to 1: they close in over the first eighth of a second of
 * the player's time, and open again over the last of the look, which is counted on the field's clock.
 */
export function letterbox(realMs: number, fieldMs: number): number {
  if (realMs < 0 || fieldMs >= FINISH_FIELD_MS) return 0;
  return Math.max(0, Math.min(1, realMs / 120, (FINISH_FIELD_MS - fieldMs) / 75));
}

/**
 * What the close look is drawn round: the point asked for, moved only as far as it has to be so
 * that nothing from outside the field comes into view, on whole pixels.
 */
export function focusOn(at: Pt, field: Field): Pt {
  const halfW = Math.ceil(field.width / (FINISH_ZOOM * 2));
  const halfH = Math.ceil(field.height / (FINISH_ZOOM * 2));
  return {
    x: Math.max(halfW, Math.min(field.width - halfW, Math.round(at.x))),
    y: Math.max(field.top + halfH, Math.min(field.top + field.height - halfH, Math.round(at.y))),
  };
}

/** Moves and scales the canvas so that `focus` is in the middle of the field at twice its size, and keeps the drawing inside the field. */
export function lookClose(ctx: CanvasRenderingContext2D, focus: Pt, field: Field): void {
  ctx.beginPath();
  ctx.rect(0, field.top, field.width, field.height);
  ctx.clip();
  ctx.translate(Math.round(field.width / 2) - focus.x * FINISH_ZOOM, field.top + Math.round(field.height / 2) - focus.y * FINISH_ZOOM);
  ctx.scale(FINISH_ZOOM, FINISH_ZOOM);
}

/** The two black bars, as far in as `open` says. */
export function drawLetterbox(ctx: CanvasRenderingContext2D, open: number, field: Field): void {
  const h = Math.round(LETTERBOX * Math.max(0, Math.min(1, open)));
  if (h <= 0) return;
  ctx.fillStyle = '#04040c';
  ctx.fillRect(0, field.top, field.width, h);
  ctx.fillRect(0, field.top + field.height - h, field.width, h);
}

/* ---- A battle that is over ---- */

/** How long the look of a result takes to come over the field. */
export const RESULT_IN_MS = 500;
/** How many shafts of light stand behind the word after a win, and how many motes rise through them. */
export const RAYS = 5;
export const MOTES = 12;

/**
 * A field that was won: warm light from above, shafts of it fanning out behind the word, and motes
 * rising through them. Soft light, but for the motes. `still` is for a hurried game: all of it at
 * once, nothing turning and nothing rising. A calm picture has no light that lies over the whole
 * field, so it keeps the motes and leaves the rest out.
 */
export function drawVictory(ctx: CanvasRenderingContext2D, ms: number, field: Field, calm = false, still = false): void {
  const share = still ? 1 : Math.min(1, Math.max(0, ms) / RESULT_IN_MS);
  if (share <= 0) return;
  const light = calm || !wide() ? undefined : ctx.createLinearGradient?.(0, field.top, 0, field.top + field.height * 0.7) as CanvasGradient | undefined;
  if (light && typeof light.addColorStop === 'function') {
    light.addColorStop(0, `rgba(255, 214, 150, ${(0.24 * share).toFixed(3)})`);
    light.addColorStop(1, 'rgba(255, 214, 150, 0)');
    const before = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = light;
    ctx.fillRect(0, field.top, field.width, field.height * 0.7);
    ctx.globalCompositeOperation = before;
  }
  // The shafts stand behind where the word is written, and turn slowly.
  const from = { x: field.width / 2, y: field.top + 46 };
  const turn = still ? 0 : ms / 9000;
  for (let i = 0; i < (calm ? 0 : RAYS); i++) {
    const angle = turn + ((i + 0.5) / RAYS) * Math.PI * 2;
    drawCone(ctx, from, { x: from.x + Math.cos(angle) * 170, y: from.y + Math.sin(angle) * 170 }, 46, '#ffd9a0', 0.12 * share);
  }
  if (still) return;
  for (let i = 0; i < MOTES; i++) {
    const age = (ms / (2600 + 1400 * scatter(i, 2)) + scatter(i, 3)) % 1;
    const x = Math.round(scatter(i, 1) * (field.width - 4) + 2 + Math.sin(age * 6 + i) * 3);
    const y = Math.round(field.top + field.height - 4 - age * (field.height - 8));
    ctx.fillStyle = `rgba(255, 226, 170, ${(0.7 * share * Math.sin(age * Math.PI)).toFixed(2)})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

/**
 * A field that was lost: the colour goes out of it, it darkens, and red closes in from its edges.
 * It comes over the field once and then holds, so a calm picture has it too.
 */
export function drawDefeat(ctx: CanvasRenderingContext2D, ms: number, field: Field, still = false): void {
  const share = still ? 1 : Math.min(1, Math.max(0, ms) / RESULT_IN_MS);
  if (share <= 0) return;
  if (wide()) {
    const blend = ctx.globalCompositeOperation;
    const alpha = ctx.globalAlpha;
    // Grey laid on so that only the colour is taken out: what was light stays light and what was dark, dark.
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = 0.85 * share;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, field.top, field.width, field.height);
    ctx.globalCompositeOperation = blend;
    ctx.globalAlpha = alpha;
  }
  // Where the colour cannot be taken out (it is the costliest thing a result draws) the field is simply darker.
  ctx.fillStyle = `rgba(6, 4, 10, ${((wide() ? 0.3 : 0.55) * share).toFixed(3)})`;
  ctx.fillRect(0, field.top, field.width, field.height);
  if (!soft()) return;
  const cx = field.width / 2;
  const cy = field.top + field.height / 2;
  const reach = Math.hypot(field.width, field.height) / 2;
  const red = ctx.createRadialGradient?.(cx, cy, reach * 0.45, cx, cy, reach) as CanvasGradient | undefined;
  if (!red || typeof red.addColorStop !== 'function') return;
  red.addColorStop(0, 'rgba(150, 16, 16, 0)');
  red.addColorStop(1, `rgba(150, 16, 16, ${(0.42 * share).toFixed(3)})`);
  ctx.fillStyle = red;
  ctx.fillRect(0, field.top, field.width, field.height);
}

/* ---- The rank on a settlement ---- */

/** How long what the stamp throws up lasts after it has landed. */
export const STAMP_FX_MS = 340;
/** How many sparks a rank that pays throws. */
export const STAMP_SPARKS = 8;

/**
 * What a rank does as it lands on the bill: a ring runs out from it, and a rank that pays (`grand`)
 * also flares and throws sparks. `ms` is how long ago it landed. A calm picture has the flare at half strength.
 */
export function drawStamp(ctx: CanvasRenderingContext2D, at: Pt, ms: number, color: string, grand: boolean, calm = false): void {
  if (ms < 0 || ms >= STAMP_FX_MS) return;
  const p = ms / STAMP_FX_MS;
  const before = ctx.globalAlpha;
  ctx.globalAlpha = 1 - p;
  ringOf(ctx, at.x, at.y, 9 + 20 * p, color);
  if (grand) {
    for (let i = 0; i < STAMP_SPARKS; i++) {
      const angle = (i / STAMP_SPARKS) * Math.PI * 2 + 0.4;
      const reach = 11 + 24 * p;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(at.x + Math.cos(angle) * reach), Math.round(at.y + Math.sin(angle) * reach), 1, 1);
    }
  }
  ctx.globalAlpha = before;
  if (grand) drawGlow(ctx, { x: at.x, y: at.y, r: 34, color, alpha: 0.5 * (1 - p) }, calm ? 0.5 : 1);
}
