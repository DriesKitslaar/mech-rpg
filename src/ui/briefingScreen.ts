import { MIRROR_ID } from '../core/arena';
import type { Mission } from '../core/campaign';
import { groundFor } from '../core/ground';
import { isDrill } from '../core/training';
import { feeAfter, takesWingman, type Wingman } from '../core/wingman';
import { ALL_ENEMIES } from '../content/arena';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { Typewriter } from './typewriter';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawPortrait, drawText, wrap } from './widgets';

const B = STRINGS.briefing;

/** One line per kind of enemy across all of a contract's battles: "Recon Drone x3". */
export function hostiles(mission: Mission): string[] {
  const counts = new Map<string, number>();
  for (const battle of mission.battles) for (const id of battle.enemies) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]) => `${id === 'mirror' ? STRINGS.arena.mirror.name : ALL_ENEMIES[id]?.name ?? id}${n > 1 ? ` x${n}` : ''}`);
}

const BO = STRINGS.objectives.brief;

/**
 * What a contract asks for beyond destroying everything, one line per battle that asks it, numbered
 * when the contract has several battles; and who, if anyone, fires in support.
 */
export function objectiveLines(mission: Mission): string[] {
  const numbered = mission.battles.length > 1;
  return mission.battles.flatMap((battle, i) => {
    const o = battle.objective;
    const name = o && 'target' in o ? (ALL_ENEMIES[battle.enemies[o.target]]?.name ?? '') : '';
    const asked = !o || o.type === 'destroy' ? []
      : [o.type === 'survive' ? BO.survive(o.rounds) : o.type === 'protect' ? BO.protect(o.name)
        : o.type === 'leader' ? BO.leader(name) : o.type === 'disable' ? BO.disable(name) : BO.driveOff(name)];
    const lines = [...asked, ...(battle.support ? [B.support(battle.support.name)] : [])];
    return lines.map((text) => (numbered ? `${i + 1}: ${text}` : text));
  });
}

/** What the ground does, one line for each kind of ground the contract is fought on. */
export function groundLines(mission: Mission): string[] {
  const ids = [...new Set(mission.battles.flatMap((battle) => groundFor(battle.background)?.id ?? []))];
  return ids.map((id) => `${STRINGS.ground[id].name}: ${STRINGS.ground[id].note}`);
}

/** Rows of briefing text that fit in the body, given how many lines of objectives sit under them. */
export const BRIEFING_ROWS = 10;
export const briefingRows = (mission: Mission): number => BRIEFING_ROWS - objectiveLines(mission).length - groundLines(mission).length;
export const BRIEFING_CHARS = charsFor(LOGICAL_W - 24);

/** A contract's briefing: who is asking, what they say, what to expect, and whether to take it. */
export class BriefingScreen implements Screen {
  private list: MenuList;
  /** Who can be hired for this contract, and which of them is: -1 is nobody. */
  private hires: Wingman[];
  private hired = -1;

  /** The briefing writes itself out; the menu does not wait for it. */
  private rows: string[][];
  private writer: Typewriter;

  constructor(private app: App, private mission: Mission) {
    this.rows = mission.briefing.map((paragraph) => wrap(paragraph, BRIEFING_CHARS));
    const typing = app.typing();
    this.writer = new Typewriter(this.rows.flat(), 150 * typing.factor, typing.instant);
    this.hires = takesWingman(mission) ? app.wingmen(mission) : [];
    this.list = new MenuList([
      { id: 'accept', label: B.accept, enabled: true },
      ...(this.hires.length > 0 ? [{ id: 'wingman', label: B.wingman, enabled: true }] : []),
      { id: 'back', label: B.back, enabled: true },
    ]);
  }

  private get wingman(): Wingman | undefined { return this.hires[this.hired]; }

  /** What the contract pays the pilot: the fee, less the share of whoever was hired. */
  private get fee(): number { return this.wingman ? feeAfter(this.mission.reward, this.wingman) : this.mission.reward; }

  /** Walks through nobody and everyone for hire, round and round. */
  private choose(step: number): void {
    const count = this.hires.length + 1;
    this.hired = ((this.hired + 1 + step + count) % count) - 1;
  }

  update(dtMs: number): void {
    this.writer.update(dtMs);
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.app.closeBriefing(this.mission);
    else if (this.list.selected?.id === 'wingman' && (action === 'left' || action === 'right' || action === 'confirm')) this.choose(action === 'left' ? -1 : 1);
    else if (action === 'confirm') {
      if (this.list.selected?.id === 'accept') this.app.startMission(this.mission.id, !!this.mission.replay, this.wingman?.id ?? null);
      else this.app.closeBriefing(this.mission); // back to the list the briefing was opened from
    }
  }

  view(): ScreenView {
    return {
      menu: { items: this.list.items, cursor: this.list.cursor },
      // True while the briefing is still writing itself out.
      typing: !this.writer.done,
      briefing: {
        mission: this.mission.id, replay: !!this.mission.replay, reward: this.fee, objectives: objectiveLines(this.mission), ground: groundLines(this.mission),
        wingman: this.hires.length === 0 ? null
          : { id: this.wingman?.id ?? null, name: this.wingman?.name ?? B.alone, share: Math.round((this.wingman?.share ?? 0) * 100), open: this.hires.length },
        lent: !isDrill(this.mission) && this.mission.loaner !== undefined,
      },
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { mission } = this;
    const { sprites } = this.app.deps;
    const bg = sprites.get(mission.battles[0].background, { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.72)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Header: portrait (or a plain terminal mark for the dispatcher), title and client.
    drawPanel(ctx, 4, 4, LOGICAL_W - 8, 64);
    drawPortrait(ctx, sprites, mission.portrait, 8, 8, 56);
    drawText(ctx, mission.title.toUpperCase(), 72, 8, { size: 16, color: COLORS.accent });
    drawText(ctx, mission.client, 72, 26, { color: COLORS.text });
    const decisive = !mission.replay && (mission.phase === 'choice' || mission.phase === 'verdict');
    const tag = isDrill(mission) ? STRINGS.training.tag
      : mission.loaner !== undefined ? B.lent
      : mission.id.startsWith('cup-') ? STRINGS.arena.cups.tag
      : mission.arenaRank !== undefined || mission.id === MIRROR_ID ? STRINGS.arena.fight
      : mission.replay ? B.replay
      : mission.id.startsWith('open-') ? (mission.elite ? B.openElite : B.open)
      : mission.phase === 'choice' ? B.exclusive : mission.phase === 'verdict' ? B.verdict
      : mission.phase === 'finale' ? B.finale : mission.phase === 'patrol' ? B.repeatable : '';
    wrap(tag, charsFor(LOGICAL_W - 84)).slice(0, 2).forEach((line, i) =>
      drawText(ctx, line, 72, 40 + i * 11, { color: decisive ? COLORS.danger : COLORS.dim }));

    // Body: what the client says, and under it what the contract asks for when that is more than a fight.
    drawPanel(ctx, 4, 72, LOGICAL_W - 8, 122);
    const objectives = objectiveLines(mission);
    const ground = groundLines(mission);
    const lastRow = 78 + (briefingRows(mission) - 1) * LINE;
    const onHire = this.list.selected?.id === 'wingman';
    const written = this.writer.visible();
    let at = 0;
    let y = 78;
    if (onHire) {
      // On the wingman's row the client makes way for a word about whoever is being considered.
      drawText(ctx, (this.wingman?.name ?? B.alone).toUpperCase(), 12, y, { color: COLORS.accent });
      wrap(this.wingman?.text ?? B.aloneText, BRIEFING_CHARS).forEach((line, i) => drawText(ctx, line, 12, y + 15 + i * LINE));
      if (this.wingman) drawText(ctx, B.wingmanTerms(this.wingman.damage, Math.round(this.wingman.share * 100)), 12, y + 15 + 3 * LINE, { color: COLORS.heat });
      drawText(ctx, B.wingmanHint, 12, 191 - LINE, { color: COLORS.dim });
    }
    for (const paragraph of onHire ? [] : this.rows) {
      for (const _full of paragraph) {
        const line = written[at++];
        if (y > lastRow) break;
        drawText(ctx, line, 12, y);
        y += LINE;
      }
      y += 4;
    }
    // What the contract asks for appears when the client has finished talking.
    // What the ground does comes last, in the colour of the weather.
    if (this.writer.done && !onHire) {
      const under = [...objectives.map((text) => ({ text, color: COLORS.heat })), ...ground.map((text) => ({ text, color: COLORS.energy }))];
      under.forEach((line, i) => drawText(ctx, line.text, 12, 191 - (under.length - i) * LINE, { color: line.color }));
    }

    // Footer: what to expect, what it pays, and the choice.
    drawPanel(ctx, 4, 198, LOGICAL_W - 8, 68);
    drawText(ctx, B.engagements(mission.battles.length), 12, 203, { color: COLORS.dim });
    drawText(ctx, `${B.reward} ${this.fee}`, 12, 215, { size: 16, color: COLORS.armor });
    if (this.hires.length > 0) {
      drawText(ctx, B.wingman, 12, 233, { color: COLORS.dim });
      drawText(ctx, this.wingman?.name ?? B.alone, 12, 243, { color: this.wingman ? COLORS.accent : COLORS.text });
      if (this.wingman) drawText(ctx, B.wingmanShare(Math.round(this.wingman.share * 100)), 12, 253, { color: COLORS.dim });
    }
    drawText(ctx, B.hostiles, 104, 203, { color: COLORS.dim });
    hostiles(mission).slice(0, 5).forEach((line, i) => drawText(ctx, line, 104, 213 + i * 10));
    drawList(ctx, this.list, 236, this.hires.length > 0 ? 210 : 216, 56, 3);
  }
}
