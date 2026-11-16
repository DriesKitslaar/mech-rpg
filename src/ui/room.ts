import { drawAmbience, placeLights } from './ambience';
import { LOGICAL_H, LOGICAL_W } from './display';
import { drawGlow, drawShadow } from './light';

/**
 * A room of the game with a mech standing in it, outside battle: the hangar behind the hub and the
 * garage, the vault, the arena, the simulator. The room's own lights glow behind the mech, a shadow
 * lies at its feet, and some of the light spills over it, so that it stands in the place and not in
 * front of a picture of it. In the hangar somebody is welding up on the walkway.
 */

/** The part of the screen a room fills: everything under the bar along the top. */
const ROOM = { top: 14, height: LOGICAL_H - 14, width: LOGICAL_W };
/** Where the middle of a mech's feet is, from the corner the mech is drawn at. */
export const MECH_FEET = { x: 76, y: 155 };
/** How much of a room's light spills over what stands in it. */
export const SPILL = 0.4;

/** The welder: where, how long there is from one spell of welding to the next, how long a spell lasts, and how many sparks fly in it. */
export const WELD = { x: 9, y: 41, every: 5200, lasts: 1400, sparks: 14 };
/** How long a spark lives. */
export const SPARK_MS = 460;

const scatter = (a: number, b: number): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** How far through a spell of welding the welder is, from 0 to 1, or null between spells. The first spell starts a little after the room is entered. */
export function welding(clockMs: number): number | null {
  const at = (clockMs + WELD.every - 1800) % WELD.every;
  return at < WELD.lasts ? at / WELD.lasts : null;
}

export interface Spark { x: number; y: number; color: string; long: boolean }

/** The sparks in the air at this moment: each is thrown up and a little sideways, and falls. */
export function weldSparks(clockMs: number): Spark[] {
  const spell = Math.floor((clockMs + WELD.every - 1800) / WELD.every);
  const at = (clockMs + WELD.every - 1800) % WELD.every;
  const sparks: Spark[] = [];
  for (let i = 0; i < WELD.sparks; i++) {
    const age = at - (i / WELD.sparks) * WELD.lasts;
    if (age < 0 || age >= SPARK_MS) continue;
    const s = age / 1000;
    const vx = (scatter(i, spell + 1) - 0.25) * 46;
    const vy = -18 - 34 * scatter(i, spell + 7);
    const p = age / SPARK_MS;
    sparks.push({
      x: Math.round(WELD.x + vx * s),
      y: Math.round(WELD.y + vy * s + 150 * s * s),
      color: p < 0.3 ? '#ffffff' : p < 0.65 ? '#ffe08a' : '#ff9a3c',
      long: p < 0.3,
    });
  }
  return sparks;
}

/** The welder's light and sparks. A calm picture has the light steady and at half strength; the sparks are small and stay. */
function drawWelder(ctx: CanvasRenderingContext2D, clockMs: number, calm: boolean): void {
  if (welding(clockMs) === null && weldSparks(clockMs).length === 0) return;
  if (welding(clockMs) !== null) {
    const flicker = calm ? 0.7 : 0.55 + 0.45 * scatter(Math.floor(clockMs / 33), 3);
    drawGlow(ctx, { x: WELD.x, y: WELD.y, r: 20, color: '#bfe4ff', alpha: 0.6 * flicker }, calm ? 0.5 : 1);
  }
  for (const spark of weldSparks(clockMs)) {
    ctx.fillStyle = spark.color;
    ctx.fillRect(spark.x, spark.y, 1, spark.long ? 2 : 1);
  }
}

/**
 * What goes over a room's picture and under the mech: darker edges, the room's lights, its haze,
 * and in the hangar the welder. `still` is for a hurried game: nobody welds in it.
 */
export function drawRoom(ctx: CanvasRenderingContext2D, background: string, clockMs: number, calm = false, still = false): void {
  drawAmbience(ctx, background, clockMs, 'behind', ROOM, calm);
  if (background === 'bg-garage' && !still) drawWelder(ctx, clockMs, calm);
}

/** The shadow of a mech drawn with its corner at `x`, `y`. */
export function drawMechShadow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  drawShadow(ctx, x + MECH_FEET.x, y + MECH_FEET.y, 108, 13, 0.5);
}

/** What goes over the mech: a share of the room's light, and the last of its haze. */
export function drawRoomSpill(ctx: CanvasRenderingContext2D, background: string, clockMs: number, calm = false): void {
  for (const light of placeLights(background, clockMs, calm)) drawGlow(ctx, light, (calm ? 0.5 : 1) * SPILL);
  drawAmbience(ctx, background, clockMs, 'front', ROOM, calm);
}
