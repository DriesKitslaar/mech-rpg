import { MIRROR_ID } from '../core/arena';
import type { Mission } from '../core/campaign';
import { isDrill } from '../core/training';
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

/** Rows of briefing text that fit in the body, given how many lines of objectives sit under them. */
export const BRIEFING_ROWS = 10;
export const briefingRows = (mission: Mission): number => BRIEFING_ROWS - objectiveLines(mission).length;
export const BRIEFING_CHARS = charsFor(LOGICAL_W - 24);

/** A contract's briefing: who is asking, what they say, what to expect, and whether to take it. */
export class BriefingScreen implements Screen {
  private list = new MenuList([
    { id: 'accept', label: B.accept, enabled: true },
    { id: 'back', label: B.back, enabled: true },
  ]);

  /** The briefing writes itself out; the menu does not wait for it. */
  private rows: string[][];
  private writer: Typewriter;

  constructor(private app: App, private mission: Mission) {
    this.rows = mission.briefing.map((paragraph) => wrap(paragraph, BRIEFING_CHARS));
    this.writer = new Typewriter(this.rows.flat(), 150, app.deps.fast);
  }

  update(dtMs: number): void {
    this.writer.update(dtMs);
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.app.closeBriefing(this.mission);
    else if (action === 'confirm') {
      if (this.list.selected?.id === 'accept') this.app.startMission(this.mission.id, !!this.mission.replay);
      else this.app.closeBriefing(this.mission); // back to the list the briefing was opened from
    }
  }

  view(): ScreenView {
    return {
      menu: { items: this.list.items, cursor: this.list.cursor },
      briefing: {
        mission: this.mission.id, replay: !!this.mission.replay, reward: this.mission.reward, objectives: objectiveLines(this.mission),
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
      : mission.arenaRank !== undefined || mission.id === MIRROR_ID ? STRINGS.arena.fight
      : mission.replay ? B.replay
      : mission.id.startsWith('open-') ? B.open
      : mission.phase === 'choice' ? B.exclusive : mission.phase === 'verdict' ? B.verdict
      : mission.phase === 'finale' ? B.finale : mission.phase === 'patrol' ? B.repeatable : '';
    wrap(tag, charsFor(LOGICAL_W - 84)).slice(0, 2).forEach((line, i) =>
      drawText(ctx, line, 72, 40 + i * 11, { color: decisive ? COLORS.danger : COLORS.dim }));

    // Body: what the client says, and under it what the contract asks for when that is more than a fight.
    drawPanel(ctx, 4, 72, LOGICAL_W - 8, 122);
    const objectives = objectiveLines(mission);
    const lastRow = 78 + (briefingRows(mission) - 1) * LINE;
    const written = this.writer.visible();
    let at = 0;
    let y = 78;
    for (const paragraph of this.rows) {
      for (const _full of paragraph) {
        const line = written[at++];
        if (y > lastRow) break;
        drawText(ctx, line, 12, y);
        y += LINE;
      }
      y += 4;
    }
    // What the contract asks for appears when the client has finished talking.
    if (this.writer.done) objectives.forEach((line, i) => drawText(ctx, line, 12, 191 - (objectives.length - i) * LINE, { color: COLORS.heat }));

    // Footer: what to expect, what it pays, and the choice.
    drawPanel(ctx, 4, 198, LOGICAL_W - 8, 68);
    drawText(ctx, B.engagements(mission.battles.length), 12, 203, { color: COLORS.dim });
    drawText(ctx, `${B.reward} ${mission.reward}`, 12, 215, { size: 16, color: COLORS.armor });
    drawText(ctx, B.hostiles, 104, 203, { color: COLORS.dim });
    hostiles(mission).slice(0, 5).forEach((line, i) => drawText(ctx, line, 104, 213 + i * 10));
    drawList(ctx, this.list, 236, 216, 56, 2);
  }
}
