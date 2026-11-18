import { isSwarm } from '../core/board';
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
import { briefingTrack } from './soundtrack';
import { Typewriter } from './typewriter';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawPortrait, drawText, wrap } from './widgets';

const B = STRINGS.briefing;

/** One line per kind of enemy across all of a contract's battles: "Recon Drone x3". */
export function hostiles(mission: Mission): string[] {
  const counts = new Map<string, number>();
  for (const battle of mission.battles) for (const id of [...battle.enemies, ...(battle.reserve ?? [])]) counts.set(id, (counts.get(id) ?? 0) + 1);
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
    const more = battle.reserve?.length ? [BO.reserve(battle.reserve.length)] : [];
    const lines = [...asked, ...more, ...(battle.support ? [B.support(battle.support.name)] : [])];
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

/**
 * A contract's briefing: who is asking, what they say, what to expect, and whether to take it.
 * Where the other side has made an offer for the same contract, a row of the menu turns the page
 * to it and back: the client, the words, the fight and the pay are then theirs.
 */
export class BriefingScreen implements Screen {
  private list!: MenuList;
  /** Who can be hired for this contract, and which of them is: -1 is nobody. */
  private hires!: Wingman[];
  private hired = -1;

  /** The briefing writes itself out; the menu does not wait for it. */
  private rows!: string[][];
  private writer!: Typewriter;
  /** The offer that is showing: the contract as it was opened, or as the other side offers it. */
  private mission!: Mission;
  /** What the other side offers for this contract, when they do. */
  private other: Mission | null;

  constructor(private app: App, private first: Mission) {
    this.other = app.otherOffer(first);
    this.turnTo(first);
  }

  /** Shows an offer: its words write themselves out afresh, and the menu is the one that goes with it. */
  private turnTo(mission: Mission, cursor = 'accept'): void {
    this.mission = mission;
    this.rows = mission.briefing.map((paragraph) => wrap(paragraph, BRIEFING_CHARS));
    const typing = this.app.typing();
    this.writer = new Typewriter(this.rows.flat(), 150 * typing.factor, typing.instant);
    this.hires = takesWingman(mission) ? this.app.wingmen(mission) : [];
    this.hired = -1;
    const items = [
      { id: 'accept', label: B.accept, enabled: true },
      ...(this.hires.length > 0 ? [{ id: 'wingman', label: B.wingman, enabled: true }] : []),
      ...(this.other ? [{ id: 'other', label: mission === this.other ? B.firstOffer : B.otherOffer, enabled: true }] : []),
      { id: 'back', label: B.back, enabled: true },
    ];
    this.list = new MenuList(items, Math.max(0, items.findIndex((item) => item.id === cursor)));
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
    else if (action === 'cancel') this.app.closeBriefing(this.first);
    else if (this.list.selected?.id === 'wingman' && (action === 'left' || action === 'right' || action === 'confirm')) this.choose(action === 'left' ? -1 : 1);
    else if (action === 'confirm') {
      const id = this.list.selected?.id;
      if (id === 'accept') this.app.startMission(this.mission.id, !!this.mission.replay, this.wingman?.id ?? null, this.mission === this.other);
      // The other side's offer and back: the cursor stays on the row that turns the page, and the song is the client's whose page it is.
      else if (id === 'other' && this.other) {
        this.turnTo(this.mission === this.other ? this.first : this.other, 'other');
        this.app.playTrack(briefingTrack(this.mission));
      }
      else this.app.closeBriefing(this.first); // back to the list the briefing was opened from
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
        // How many offers there are for this contract, the client of the one showing, and whether that is the other side's.
        offers: this.other ? 2 : 1, client: this.mission.client, turned: this.mission === this.other,
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
      : isSwarm(mission) ? B.swarm
      : mission.id.startsWith('open-') ? (mission.elite ? B.openElite : B.open)
      : mission.phase === 'choice' ? B.exclusive : mission.phase === 'verdict' ? B.verdict
      : mission.phase === 'finale' ? B.finale : mission.phase === 'patrol' ? B.repeatable
      : this.other ? (mission === this.other ? B.otherTag : B.twoOffers) : '';
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
    // Three rows as a rule; a contract with somebody for hire and a second offer has four, and room for them.
    const rows = this.list.items.length;
    drawList(ctx, this.list, 236, rows >= 4 ? 204 : rows >= 3 ? 210 : 216, 56, Math.max(3, rows));
  }
}
