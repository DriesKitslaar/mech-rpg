import type { GameState } from '../core/game';
import { levelFor } from '../core/pilot';
import { MEDALS } from '../content/medals';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { playTime } from './record';
import { COLORS, drawText } from './widgets';

const C = STRINGS.credits;

/** One line of the roll. `gap` is the space left above it. */
export interface CreditLine { text: string; size?: number; color?: string; gap?: number }

/** True when the pilot has ever finished this contract, in this cycle or an earlier one: every won contract leaves a rank. */
const ever = (game: GameState, missionId: string): boolean => game.completed.includes(missionId) || Object.hasOwn(game.ranks, missionId);

/** The people of the story, in the order they come into it, and how the game knows the pilot has met each. */
export const CAST: { name: string; role: string; met(game: GameState): boolean }[] = [
  { name: 'Dispatch', role: C.roles.dispatch, met: () => true },
  { name: 'Director Brenn', role: C.roles.brenn, met: (g) => ever(g, 'hadron-1') },
  { name: 'Analyst Varga', role: C.roles.varga, met: (g) => ever(g, 'lumen-1') },
  { name: 'Tamsin', role: C.roles.tamsin, met: (g) => ever(g, 'undertow-1') },
  { name: 'Ashfall', role: C.roles.ashfall, met: (g) => g.met.includes('rival') || ever(g, 'rival-1') },
  { name: 'Sable', role: C.roles.sable, met: (g) => g.met.includes('sable') },
  { name: 'Rook', role: C.roles.rook, met: (g) => g.met.includes('rook') },
  { name: 'Krell', role: C.roles.krell, met: (g) => g.met.includes('krell') },
  { name: 'The Actuary', role: C.roles.actuary, met: (g) => ever(g, 'audit-1') },
];

/**
 * The end roll: the game's name, who flew and what they did, and the people of Varn they met on the
 * way. Someone who was on a road this pilot did not take is left blank: there is a reason to go again.
 */
export function creditLines(game: GameState, medalCount: number): CreditLine[] {
  const s = game.stats;
  const heading = (text: string): CreditLine => ({ text, color: COLORS.dim, gap: 26 });
  return [
    { text: STRINGS.title, size: 32, color: COLORS.accent },
    heading(C.flownBy),
    { text: game.callsign, size: 24, color: COLORS.armor, gap: 2 },
    { text: C.level(levelFor(game.xp)) },
    heading(C.record),
    { text: C.stat(STRINGS.record.contracts, String(s.contracts)), gap: 2 },
    { text: C.stat(STRINGS.record.kills, String(s.kills)) },
    { text: C.stat(STRINGS.record.sRanks, String(Object.values(game.ranks).filter((rank) => rank === 'S').length)) },
    { text: C.stat(STRINGS.record.arena, game.arenaRank > 0 ? String(game.arenaRank) : STRINGS.record.none) },
    { text: C.stat(STRINGS.record.medals, `${game.medals.length}/${medalCount}`) },
    { text: C.stat(STRINGS.record.time, playTime(s.seconds)) },
    heading(C.cast),
    ...CAST.flatMap((member): CreditLine[] => (member.met(game)
      ? [{ text: member.name, gap: 6 }, { text: member.role, size: 10, color: COLORS.dim }]
      : [{ text: C.unknown, gap: 6, color: COLORS.dim }, { text: C.notMet, size: 10, color: COLORS.dim }])),
    heading(C.again),
    { text: C.cycle, gap: 2 },
    { text: C.thanks, size: 16, color: COLORS.accent, gap: 40 },
  ];
}

const heightOf = (line: CreditLine): number => (line.gap ?? 0) + Math.max(11, (line.size ?? 12) + 1);
/** How tall the whole roll is. */
export const creditsHeight = (lines: CreditLine[]): number => lines.reduce((sum, line) => sum + heightOf(line), 0);

/** How fast the roll climbs, in logical pixels a second, and how long a press is ignored after it opens. */
export const CREDITS_SPEED = 18;
export const CREDITS_HOLD_MS = 600;

/** The end roll. It climbs by itself and stops with its last line in the middle of the screen; a press skips to there, the next leaves. */
export class CreditsScreen implements Screen {
  private lines: CreditLine[];
  private clock = 0;
  /** How far the roll has climbed, and how far it goes. */
  private scroll = 0;
  private readonly end: number;

  constructor(private app: App) {
    this.lines = creditLines(app.game!, MEDALS.length);
    // It starts below the screen and stops when its last line reaches the middle.
    this.end = creditsHeight(this.lines) + LOGICAL_H / 2 - 12;
    if (app.deps.fast) this.scroll = this.end;
  }

  private get done(): boolean {
    return this.scroll >= this.end;
  }

  update(dtMs: number): void {
    this.clock += dtMs;
    this.scroll = Math.min(this.end, this.scroll + (dtMs / 1000) * CREDITS_SPEED);
  }

  onInput(action: InputAction): void {
    if (action !== 'confirm') return;
    // A press carried over from the page before does nothing.
    if (!this.app.deps.fast && this.clock < CREDITS_HOLD_MS) return;
    if (this.done) this.app.closeCredits();
    else this.scroll = this.end;
  }

  view(): ScreenView {
    return { menu: { items: [], cursor: 0 }, credits: { done: this.done } };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const bg = this.app.deps.sprites.get('still-varn', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(6, 6, 16, 0.78)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    let y = LOGICAL_H - Math.round(this.scroll);
    for (const line of this.lines) {
      y += line.gap ?? 0;
      const h = Math.max(11, (line.size ?? 12) + 1);
      // Only what is on screen is drawn.
      if (y > -h && y < LOGICAL_H) drawText(ctx, line.text, LOGICAL_W / 2, y, { align: 'center', size: line.size, color: line.color });
      y += h;
    }
    if (this.done && Math.floor(this.clock / 420) % 2 === 0) {
      drawText(ctx, STRINGS.scene.continue, LOGICAL_W / 2, LOGICAL_H - 16, { align: 'center', color: COLORS.dim });
    }
  }
}
