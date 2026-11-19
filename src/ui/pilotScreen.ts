import { ARCHETYPES, adviceFor, archetypeOf, wonAs, type Archetype, type BuildAdvice } from '../core/archetype';
import { DEFAULT_CALLSIGN, type BuildSlot } from '../core/game';
import { MEDAL_PAY, medalProgress, type Medal } from '../core/medals';
import { OVERDRIVES, type OverdriveId } from '../core/battle';
import { MAX_LEVEL, OVERDRIVE_LEVEL, checkBuyPerk, fittedOverdrive, levelFor, overdriveOpen, perkPoints, xpForLevel } from '../core/pilot';
import { ARCHETYPE_BUILDS, STAGES } from '../content/archetypeBuilds';
import { MEDALS } from '../content/medals';
import { PERKS } from '../content/perks';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { nameRank, nextNameAt, renownOf } from '../core/renown';
import { RECORD_ROWS, rankTally, recordLines } from './record';
import { CHAR_W, COLORS, LINE, MEDAL_COLORS, charsFor, drawList, drawMedal, drawMeter, drawPanel, drawRowLight, drawTabs, drawText, wrap } from './widgets';

const P = STRINGS.pilot;
const M = STRINGS.medals;
export type PilotPage = 'perks' | 'drive' | 'medals' | 'record' | 'classes';
const PAGES: PilotPage[] = ['perks', 'medals', 'record', 'classes', 'drive'];
const O = STRINGS.overdrive;
const C = STRINGS.classes;
/** The suggested build is listed in two columns: what the frame is made of and what is inside it, then what it fights with. */
const ADVICE_COLUMNS: BuildSlot[][] = [['head', 'core', 'arms', 'legs', 'generator', 'booster'], ['fcs', 'module', 'rightHand', 'leftHand', 'shoulder']];
/** Medals listed at a time. */
const MEDAL_ROWS = 13;
/** Where, on the page of kinds, what makes a kind is written after its name; and how wide a column of the build to try is. */
const CLASS_RULE_X = 92;
const ADVICE_COLUMN_W = 146;

/** The pilot: level and perks, the medals earned and still to earn, the record of what they have done, and the kinds of machine there are. */
export class PilotScreen implements Screen {
  private page: PilotPage = 'perks';
  private perks = new MenuList();
  private medals = new MenuList();
  private drives = new MenuList();
  private classes = new MenuList();

  constructor(private app: App) {
    this.refresh();
  }

  private refresh(): void {
    const game = this.app.game!;
    this.perks.setItems(PERKS.map((perk) => ({
      id: perk.id, label: perk.name, enabled: checkBuyPerk(game, perk.id, PERKS) === null,
      note: `${game.perks[perk.id] ?? 0}/${perk.maxRank}`,
    })));
    // The Overdrives: the one flown with is marked; one that is not open yet says at which level it is.
    const fitted = fittedOverdrive(game);
    this.drives.setItems(OVERDRIVES.map((id) => ({
      id, label: O.names[id], enabled: overdriveOpen(game, id),
      note: fitted === id ? O.fitted : overdriveOpen(game, id) ? undefined : O.level(OVERDRIVE_LEVEL[id]),
    })));
    // The kinds of machine, in the order their rules are asked: each with what was won as it. The one the pilot flies now is marked.
    const flown = archetypeOf(game.build, this.app.deps.catalog);
    this.classes.setItems(ARCHETYPES.map((kind) => ({
      id: kind, label: C.names[kind], enabled: wonAs(game, kind) > 0 || kind === flown, note: String(wonAs(game, kind)),
    })));
    this.medals.setItems(MEDALS.map((medal) => {
      const { have, need, earned } = medalProgress(medal, game);
      return {
        id: medal.id, label: this.nameOf(medal), enabled: earned,
        // Earned, or how far along; a medal that is simply done or not says nothing until it is, and
        // neither does one that keeps its name to itself: its count would give away what it is for.
        note: earned ? M.held : need > 1 && !this.isHidden(medal) ? `${have}/${need}` : undefined,
      };
    }));
  }

  private isHidden(medal: Medal): boolean {
    return !!medal.secret && !this.app.game!.medals.includes(medal.id);
  }

  private nameOf(medal: Medal): string {
    return this.isHidden(medal) ? M.secretName : medal.name;
  }

  /** The medal under the cursor: its name, what it takes, and whether it is held or what it will pay. */
  private detail(): { title: string; lines: string[]; status: string } | null {
    const medal = MEDALS.find((m) => m.id === this.medals.selected?.id);
    if (!medal) return null;
    const earned = this.app.game!.medals.includes(medal.id);
    return {
      title: this.nameOf(medal),
      lines: wrap(this.isHidden(medal) ? M.secretText : medal.text, charsFor(LOGICAL_W - 60)),
      status: earned ? M.held : M.pays(MEDAL_PAY[medal.tier]),
    };
  }

  /** The kind under the cursor on the page of kinds, and the kind the pilot's own build is. */
  private get kind(): Archetype {
    return (this.classes.selected?.id ?? ARCHETYPES[0]) as Archetype;
  }

  private get flown(): Archetype {
    return archetypeOf(this.app.game!.build, this.app.deps.catalog);
  }

  /** A build of the kind under the cursor that the pilot could put together now, and what of it is still to be bought. */
  private advice(): BuildAdvice {
    const stock = new Set(this.app.stock().map((part) => part.id));
    return adviceFor(this.app.game!, STAGES.map((stage) => ARCHETYPE_BUILDS[this.kind][stage]), (id) => stock.has(id), this.app.deps.catalog);
  }

  private get list(): MenuList | null {
    return { perks: this.perks, medals: this.medals, drive: this.drives, classes: this.classes, record: null }[this.page];
  }

  private turn(by: number): void {
    this.page = PAGES[(PAGES.indexOf(this.page) + by + PAGES.length) % PAGES.length];
  }

  update(): void {}

  onInput(action: InputAction): void {
    if (action === 'up') this.list?.move(-1);
    else if (action === 'down') this.list?.move(1);
    else if (action === 'next' || action === 'right') this.turn(1);
    else if (action === 'prev' || action === 'left') this.turn(-1);
    else if (action === 'cancel') this.app.go('hub');
    else if (action === 'confirm' && this.page === 'perks' && this.perks.selected?.enabled) {
      this.app.buyPerk(this.perks.selected.id);
      this.refresh();
    } else if (action === 'confirm' && this.page === 'drive' && this.drives.selected?.enabled) {
      const at = this.drives.cursor;
      this.app.fitOverdrive(this.drives.selected.id as OverdriveId);
      this.refresh();
      this.drives.cursor = at;
    }
  }

  view(): ScreenView {
    const game = this.app.game!;
    return {
      menu: { items: this.list?.items ?? [], cursor: this.list?.cursor ?? 0 },
      page: this.page,
      pilot: { level: levelFor(game.xp), points: perkPoints(game, PERKS) },
      medalCount: { earned: MEDALS.filter((m) => game.medals.includes(m.id)).length, of: MEDALS.length },
      ...(this.page === 'medals' ? { detail: this.detail() } : {}),
      ...(this.page === 'drive' ? { overdrive: fittedOverdrive(game) ?? null } : {}),
      ...(this.page === 'record' ? { record: recordLines(game, MEDALS.length), known: { rank: nameRank(game), renown: renownOf(game), next: nextNameAt(game) } } : {}),
      ...(this.page === 'classes' ? { classes: { flown: this.flown, kind: this.kind, advice: this.advice() } } : {}),
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const bg = this.app.deps.sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.6)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, P.heading, 5, 1, { color: COLORS.accent });
    // The callsign stands a little after the heading, however long the heading is in the language set. A pilot
    // who never took a name is called what the heading already says: it is not written twice.
    if (game.callsign !== DEFAULT_CALLSIGN) drawText(ctx, game.callsign, 5 + Math.round(P.heading.length * CHAR_W) + 6, 1);
    drawTabs(ctx, LOGICAL_W - 5, 1, PAGES.map((page) => P.pages[page]), PAGES.indexOf(this.page));

    if (this.page === 'perks') this.drawPerks(ctx);
    else if (this.page === 'drive') this.drawDrive(ctx);
    else if (this.page === 'medals') this.drawMedals(ctx);
    else if (this.page === 'classes') this.drawClasses(ctx);
    else this.drawRecord(ctx);
    drawText(ctx, this.page === 'perks' ? P.hint : this.page === 'drive' ? O.hint : P.pageHint, LOGICAL_W / 2, 255, { align: 'center', color: COLORS.dim });
  }

  /**
   * The kinds of machine: what makes each, in the order the rules are asked, and what was won as it; under
   * that, what the one under the cursor is good at, and a build of it to put together now.
   */
  private drawClasses(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const { catalog } = this.app.deps;
    const flown = this.flown;
    drawPanel(ctx, 4, 18, LOGICAL_W - 8, 95);
    drawText(ctx, C.heading, 12, 22, { color: COLORS.dim, size: 10 });
    drawText(ctx, C.won, LOGICAL_W - 12, 22, { align: 'right', color: COLORS.dim, size: 10 });
    this.classes.items.forEach((item, i) => {
      const kind = item.id as Archetype;
      const y = 34 + i * LINE;
      const selected = i === this.classes.cursor;
      if (selected) {
        drawRowLight(ctx, 7, y + 1, LOGICAL_W - 17);
        drawText(ctx, '>', 10, y, { color: COLORS.accent });
      }
      // The kind the pilot flies now stands out; one never won as is dim.
      drawText(ctx, item.label, 18, y, { color: selected ? COLORS.accent : kind === flown ? COLORS.armor : item.enabled ? COLORS.text : COLORS.dim });
      drawText(ctx, C.rules[kind], CLASS_RULE_X, y, { color: COLORS.dim });
      drawText(ctx, item.note ?? '', LOGICAL_W - 12, y, { align: 'right', color: wonAs(game, kind) > 0 ? COLORS.text : COLORS.dim });
    });

    const kind = this.kind;
    drawPanel(ctx, 4, 117, LOGICAL_W - 8, 135);
    drawText(ctx, C.names[kind].toUpperCase(), 12, 121, { color: COLORS.accent });
    if (kind === flown) drawText(ctx, C.yours, LOGICAL_W - 12, 121, { align: 'right', color: COLORS.armor });
    wrap(C.notes[kind], charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((text, i) => drawText(ctx, text, 12, 133 + i * LINE));

    // One to put together now: what the pilot owns of it is plain, what is still to be bought stands out, and what no shop sells yet is dim.
    const advice = this.advice();
    ctx.fillStyle = COLORS.border;
    ctx.fillRect(12, 168, LOGICAL_W - 24, 1);
    drawText(ctx, C.advice, 12, 171, { color: COLORS.dim, size: 10 });
    const status = advice.unsold.length > 0 ? C.unsold : advice.toBuy.length === 0 ? C.owned : C.toBuy(advice.cost);
    drawText(ctx, status, LOGICAL_W - 12, 171, { align: 'right', color: advice.toBuy.length === 0 ? COLORS.armor : COLORS.dim, size: 10 });
    ADVICE_COLUMNS.forEach((slots, column) => slots.forEach((slot, row) => {
      const id = advice.build[slot];
      const x = 12 + column * ADVICE_COLUMN_W;
      const y = 182 + row * LINE;
      drawText(ctx, STRINGS.garage.slotTags[slot], x, y + 1, { color: COLORS.dim, size: 10 });
      const name = id !== undefined && Object.hasOwn(catalog, id) ? catalog[id].name : '-';
      const color = id === undefined || advice.unsold.includes(slot) ? COLORS.dim : advice.toBuy.includes(slot) ? COLORS.accent : COLORS.text;
      drawText(ctx, name, x + 34, y, { color });
    }));
  }

  /** The Overdrives: which there are, which is flown with, what the one under the cursor does, and how the meter fills. */
  private drawDrive(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, 4, 18, LOGICAL_W - 8, 52);
    drawText(ctx, O.heading, 12, 22, { color: COLORS.dim, size: 10 });
    drawList(ctx, this.drives, 12, 33, LOGICAL_W - 36, OVERDRIVES.length);
    drawPanel(ctx, 4, 74, LOGICAL_W - 8, 78);
    const id = this.drives.selected?.id;
    if (id) {
      drawText(ctx, O.names[id].toUpperCase(), 12, 80, { size: 16, color: COLORS.accent });
      wrap(O.notes[id], charsFor(LOGICAL_W - 28)).slice(0, 4).forEach((text, i) => drawText(ctx, text, 12, 100 + i * LINE));
    }
    drawPanel(ctx, 4, 156, LOGICAL_W - 8, 96);
    wrap(O.how, charsFor(LOGICAL_W - 28)).slice(0, 6).forEach((text, i) => drawText(ctx, text, 12, 162 + i * LINE, { color: COLORS.dim }));
  }

  private drawPerks(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    // Level and progress towards the next one.
    const level = levelFor(game.xp);
    const points = perkPoints(game, PERKS);
    drawPanel(ctx, 4, 18, LOGICAL_W - 8, 50);
    drawText(ctx, P.level, 12, 24, { color: COLORS.dim });
    drawText(ctx, String(level), 12, 34, { size: 24, color: COLORS.accent });
    drawText(ctx, P.points, LOGICAL_W - 12, 24, { align: 'right', color: COLORS.dim });
    drawText(ctx, String(points), LOGICAL_W - 12, 34, { size: 24, align: 'right', color: points > 0 ? COLORS.armor : COLORS.dim });
    if (level < MAX_LEVEL) {
      const floor = xpForLevel(level);
      const ceiling = xpForLevel(level + 1);
      drawText(ctx, `${P.xp} ${game.xp} / ${ceiling}`, LOGICAL_W / 2, 26, { align: 'center' });
      drawMeter(ctx, 70, 42, LOGICAL_W - 140, 6, game.xp - floor, ceiling - floor, COLORS.energy);
      drawText(ctx, P.next, LOGICAL_W / 2, 51, { align: 'center', color: COLORS.dim, size: 10 });
    } else {
      drawText(ctx, P.maxLevel, LOGICAL_W / 2, 36, { align: 'center', color: COLORS.armor });
    }

    // Perks, and what the selected one does.
    drawPanel(ctx, 4, 72, LOGICAL_W - 8, 108);
    drawList(ctx, this.perks, 12, 80, LOGICAL_W - 36, PERKS.length);
    drawPanel(ctx, 4, 184, LOGICAL_W - 8, 68);
    const perk = PERKS.find((p) => p.id === this.perks.selected?.id);
    if (perk) {
      drawText(ctx, perk.name.toUpperCase(), 12, 190, { color: COLORS.accent });
      wrap(perk.description, charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((text, i) => drawText(ctx, text, 12, 204 + i * LINE));
      const refusal = checkBuyPerk(game, perk.id, PERKS);
      if (refusal === 'maxed') drawText(ctx, P.maxed, 12, 238, { color: COLORS.dim });
      else if (refusal === 'noPoints') drawText(ctx, P.noPoints, 12, 238, { color: COLORS.dim });
    }
  }

  private drawMedals(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const earned = MEDALS.filter((m) => game.medals.includes(m.id));
    // How many are held, and how many of each metal.
    drawPanel(ctx, 4, 18, LOGICAL_W - 8, 18);
    drawText(ctx, `${M.heading} ${earned.length}/${MEDALS.length}`, 12, 21, { color: COLORS.accent });
    ([3, 2, 1] as const).forEach((tier, i) => {
      const x = LOGICAL_W - 46 - i * 40;
      drawMedal(ctx, x, 22, tier, true);
      drawText(ctx, `${earned.filter((m) => m.tier === tier).length}/${MEDALS.filter((m) => m.tier === tier).length}`, x + 12, 21, { color: MEDAL_COLORS[tier] });
    });

    drawPanel(ctx, 4, 40, LOGICAL_W - 8, MEDAL_ROWS * LINE + 10);
    const { items, offset } = this.medals.visible(MEDAL_ROWS);
    items.forEach((item, i) => {
      const y = 45 + i * LINE;
      const selected = offset + i === this.medals.cursor;
      const medal = MEDALS[offset + i];
      if (selected) {
        drawRowLight(ctx, 7, y + 1, LOGICAL_W - 29);
        drawText(ctx, '>', 10, y, { color: COLORS.accent });
      }
      drawMedal(ctx, 18, y + 1, medal.tier, item.enabled);
      drawText(ctx, item.label, 32, y, { color: selected ? COLORS.accent : item.enabled ? COLORS.text : COLORS.dim });
      if (item.note) drawText(ctx, item.note, LOGICAL_W - 22, y, { align: 'right', color: item.enabled ? COLORS.armor : COLORS.dim });
    });
    if (offset > 0) drawText(ctx, '^', LOGICAL_W - 16, 45, { color: COLORS.dim });
    if (offset + MEDAL_ROWS < this.medals.items.length) drawText(ctx, 'v', LOGICAL_W - 16, 45 + (MEDAL_ROWS - 1) * LINE, { color: COLORS.dim });

    // The one under the cursor: what it takes, and what it pays or that it is held.
    drawPanel(ctx, 4, 197, LOGICAL_W - 8, 55);
    const detail = this.detail();
    const medal = MEDALS.find((m) => m.id === this.medals.selected?.id);
    if (detail && medal) {
      const held = game.medals.includes(medal.id);
      drawMedal(ctx, 12, 203, medal.tier, held);
      drawText(ctx, detail.title.toUpperCase(), 26, 202, { color: COLORS.accent });
      detail.lines.slice(0, 2).forEach((text, i) => drawText(ctx, text, 26, 215 + i * LINE));
      drawText(ctx, detail.status, LOGICAL_W - 12, 238, { align: 'right', color: held ? COLORS.armor : COLORS.dim });
    }
  }

  private drawRecord(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const lines = recordLines(game, MEDALS.length);
    drawPanel(ctx, 4, 18, LOGICAL_W - 8, RECORD_ROWS * LINE + 12);
    const columnW = (LOGICAL_W - 8 - 24) / 2;
    lines.forEach((line, i) => {
      const x = 12 + Math.floor(i / RECORD_ROWS) * (columnW + 8);
      const y = 24 + (i % RECORD_ROWS) * LINE;
      drawText(ctx, line.label, x, y, { color: COLORS.dim });
      drawText(ctx, line.value, x + columnW, y, { align: 'right' });
    });

    // The ranks held, best first, as one row of counts.
    const top = 18 + RECORD_ROWS * LINE + 16;
    drawPanel(ctx, 4, top, LOGICAL_W - 8, 40);
    drawText(ctx, STRINGS.record.ranksHeld, 12, top + 5, { color: COLORS.dim });
    rankTally(game).forEach(([rank, count], i) => {
      const x = 12 + i * 58;
      drawText(ctx, rank, x, top + 17, { size: 16, color: count > 0 ? COLORS.accent : COLORS.dim });
      drawText(ctx, String(count), x + 14, top + 20, { color: count > 0 ? COLORS.text : COLORS.dim });
    });

    // The name the record has earned, what it means to the other side, and how far off the next one is.
    const N = STRINGS.renown;
    const known = top + 44;
    const rank = nameRank(game);
    const next = nextNameAt(game);
    drawPanel(ctx, 4, known, LOGICAL_W - 8, 40);
    drawText(ctx, N.label, 12, known + 4, { color: COLORS.dim });
    drawText(ctx, next === null ? N.renown(renownOf(game)) : N.towards(renownOf(game), next), LOGICAL_W - 12, known + 4, { align: 'right', color: COLORS.dim });
    drawText(ctx, rank > 0 ? N.names[rank - 1].toUpperCase() : N.none, 12, known + 15, { color: rank > 0 ? COLORS.accent : COLORS.dim });
    if (rank > 0) drawText(ctx, N.notes[rank - 1], 12, known + 26);
  }
}
