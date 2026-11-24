import { archetypeOf, wonAs, type Archetype } from '../core/archetype';
import { isSwarm } from '../core/board';
import { computeBuildStats } from '../core/build';
import { MIRROR_ID } from '../core/arena';
import type { Mission } from '../core/campaign';
import { ODDS_GOOD, advance, counted, neared, nearness, newCount, type Count, type Forecast, type Nearness } from '../core/forecast';
import { groundFor } from '../core/ground';
import { askBonus, crownHeld, isMaster } from '../core/masters';
import { isSeat } from '../core/seat';
import type { Fight } from '../core/mission';
import type { Grounded, Sortie } from '../core/sortie';
import { isRange, parseSpar } from '../core/range';
import { earnsStripes, nextStripeAt, stripesOf } from '../core/stripes';
import { isDrill } from '../core/training';
import { tunedCatalog } from '../core/tuning';
import type { BuildSlot } from '../core/game';
import { feeAfter, takesWingman, type Wingman } from '../core/wingman';
import { ALL_ENEMIES } from '../content/arena';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { briefingTrack } from './soundtrack';
import { Typewriter } from './typewriter';
import { CHAR_W, COLORS, LINE, STRIPES_W, STRIPE_COLOR, charsFor, drawList, drawPanel, drawPortrait, drawStripes, drawText, wrap } from './widgets';

const B = STRINGS.briefing;
const C = STRINGS.classes;
const G = STRINGS.garage;
const S = STRINGS.stripes;
/** How wide a letter of the small print is. */
const SMALL_W = 4;
/** Where the footer's menu starts, by how many rows it has: half a line higher for each row more, and no higher than the footer has room. */
const MENU_TOP = [216, 216, 210, 204, 202];
/** What a build carries, as the page about it lists it: what it fights with, and its module. */
const CARRIED: BuildSlot[] = ['rightHand', 'leftHand', 'shoulder', 'module'];
/** The share of its flights a build has to win for its odds to be written as fair; under that they are poor. (`ODDS_GOOD` is the count's own: see forecast.ts.) */
export const ODDS_FAIR = 0.4;
/**
 * How long the count of the odds may work in one frame, where the time can be told: a quarter of a frame
 * at sixty a second. It always works one go; on a machine with time to spare it works more, up to `ODDS_GOES`.
 */
export const ODDS_BUDGET_MS = 4;
export const ODDS_GOES = 8;
/**
 * How long a briefing that has just opened does not take A, as a line of talk does not: the cursor stands on Accept,
 * and a press meant for the list of contracts would launch one. Short enough that hub to launch stays three presses.
 */
export const BRIEFING_HOLD_MS = 250;
/**
 * How long the row that takes a contract waits for the odds of raised terms before it is taken with the
 * count as far as it has come: nobody is held for ever by a machine too slow to count.
 */
export const TERMS_WAIT_MS = 8000;

/** The colour odds are written in once they are counted: good, fair or poor. */
export const oddsColor = (odds: Forecast): string =>
  odds.won >= odds.played * ODDS_GOOD ? COLORS.armor : odds.won >= odds.played * ODDS_FAIR ? COLORS.heat : COLORS.danger;

/** One line per kind of enemy across all of a contract's battles: "Recon Drone x3". */
export function hostiles(mission: Mission): string[] {
  const counts = new Map<string, number>();
  for (const battle of mission.battles) for (const id of [...battle.enemies, ...(battle.reserve ?? [])]) counts.set(id, (counts.get(id) ?? 0) + 1);
  // The mirror, and a saved build that is sparred with, are machines made on the spot: each goes by what the game calls it.
  const spar = parseSpar(mission.id);
  // And one the contract itself has a name for goes by that.
  const name = (id: string): string =>
    mission.names?.[id] ?? (id === 'mirror' ? STRINGS.arena.mirror.name : spar !== null ? STRINGS.training.spar(spar + 1) : ALL_ENEMIES[id]?.name ?? id);
  return [...counts].map(([id, n]) => `${name(id)}${n > 1 ? ` x${n}` : ''}`);
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
    const name = o && 'target' in o ? (mission.names?.[battle.enemies[o.target]] ?? ALL_ENEMIES[battle.enemies[o.target]]?.name ?? '') : '';
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
/** The room left under each paragraph of what the client says, in pixels: so a briefing of several holds less than its rows. */
export const BRIEFING_GAP = 4;
/**
 * How many of a briefing's lines the page draws, wrapped as it wraps them: all of them, where it fits. A line is
 * drawn while it starts no lower than the last row the contract leaves for the client, and each paragraph is
 * followed by a gap.
 */
export function briefingShown(mission: Mission): { lines: number; shown: number } {
  const lastRow = (briefingRows(mission) - 1) * LINE;
  let y = 0;
  let lines = 0;
  let shown = 0;
  for (const paragraph of mission.briefing) {
    for (const _line of wrap(paragraph, BRIEFING_CHARS)) {
      lines += 1;
      if (y <= lastRow) shown += 1;
      y += LINE;
    }
    y += BRIEFING_GAP;
  }
  return { lines, shown };
}
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
  /**
   * What the contract can be taken in, the build on the floor first, and which of them is chosen. Empty for a
   * contract that is flown in a mech that is lent: the patrol of a pilot whose own cannot deploy, and every drill.
   */
  private builds: Sortie[];
  /** The saved builds that cannot be flown now: the page of builds says so, where it would otherwise not name them at all. */
  private grounded: Grounded[];
  private chosen = 0;
  /**
   * The odds of what has been shown, by offer, build and wingman: the contract as accepting would start it,
   * what it would be fought with, and the count as it stands. A count is moved on a little each frame while
   * it is the one showing, and kept once it is done. Null where no odds are given.
   */
  private counts = new Map<string, { mission: Mission; fight: Fight; count: Count } | null>();

  /** What is left of the moment in which A is not taken: see `BRIEFING_HOLD_MS`. */
  private held: number;
  /** The terms the contract would be taken on, where it takes any: 0 is Standard (see core/stakes.ts). Chosen afresh in every briefing. */
  private level = 0;
  /** How long the terms showing have been waited on for their odds: see `TERMS_WAIT_MS`. */
  private waited = 0;

  constructor(private app: App, private first: Mission) {
    this.held = app.deps.fast ? 0 : BRIEFING_HOLD_MS;
    this.other = app.otherOffer(first);
    // A pilot still in the introductions is told the contract and nothing else: what class a build is, how the
    // odds stand and what a stripe is are for once the board opens, and each has its chapter in the manual.
    this.builds = first.loaner === undefined && !app.newcomer ? app.sorties() : [];
    this.grounded = first.loaner === undefined && !app.newcomer ? app.grounded() : [];
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
    this.level = 0;
    this.waited = 0;
    const items = [
      { id: 'accept', label: B.accept, enabled: true },
      // An open contract can be taken on harder terms: the row for them stands right under the one that takes it.
      ...(this.app.stakes(mission, null).length > 0 ? [{ id: 'terms', label: B.terms, enabled: true }] : []),
      ...(this.builds.length > 0 ? [{ id: 'build', label: B.build, enabled: true }] : []),
      ...(this.hires.length > 0 ? [{ id: 'wingman', label: B.wingman, enabled: true }] : []),
      ...(this.other ? [{ id: 'other', label: mission === this.other ? B.firstOffer : B.otherOffer, enabled: true }] : []),
      { id: 'back', label: B.back, enabled: true },
    ];
    this.list = new MenuList(items, Math.max(0, items.findIndex((item) => item.id === cursor)));
  }

  private get wingman(): Wingman | undefined { return this.hires[this.hired]; }

  /** What the contract pays the pilot: the fee, less the share of whoever was hired, and with what the terms showing add to it. */
  private get fee(): number {
    const fee = this.wingman ? feeAfter(this.mission.reward, this.wingman) : this.mission.reward;
    return fee + (this.terms?.bond ?? 0);
  }

  /** The terms there are for this contract with whoever is hired, Standard first; none where it takes no terms. */
  private get stakes(): ReturnType<App['stakes']> { return this.app.stakes(this.mission, this.wingman?.id ?? null); }

  /** The terms showing: what they multiply, what they stake, and whether this pilot holds that. Null where the contract takes none. */
  private get terms(): ReturnType<App['stakes']>[number] | null { return this.stakes[this.level] ?? null; }

  /** Walks through the terms there are, round and round. The wait for their odds begins again with each. */
  private turnTerms(step: number): void {
    const count = this.stakes.length;
    if (count === 0) return;
    this.level = (this.level + step + count) % count;
    this.waited = 0;
  }

  /**
   * True while the contract is not taken because the odds of the raised terms showing are still being counted:
   * a bet is read before it is made. Never at Standard, and never for longer than `TERMS_WAIT_MS` on the same terms.
   */
  private get waiting(): boolean {
    const counting = this.level > 0 ? this.counting : null;
    return !!counting && !counted(counting.count) && this.waited < TERMS_WAIT_MS;
  }

  /**
   * The row that takes the contract, as it stands now: it says that the odds are being counted while it waits
   * for them, and cannot be chosen then, nor on terms whose bond this pilot does not hold.
   */
  private refresh(): void {
    const accept = this.list.items.find((item) => item.id === 'accept');
    if (!accept) return;
    const unheld = this.terms?.refusal === 'bond';
    const waiting = !unheld && this.waiting;
    accept.label = waiting ? B.counting : B.accept;
    accept.enabled = !unheld && !waiting;
  }

  /** Walks through nobody and everyone for hire, round and round. */
  private choose(step: number): void {
    const count = this.hires.length + 1;
    this.hired = ((this.hired + 1 + step + count) % count) - 1;
  }

  /** The build the contract will be taken in, when it is taken in one of the pilot's. */
  private get sortie(): Sortie | undefined { return this.builds[this.chosen]; }

  /** What kind of machine that build is. */
  private get kind(): Archetype | null {
    return this.sortie ? archetypeOf(this.sortie.build, this.app.deps.catalog) : null;
  }

  /**
   * How near the class of that build is to its next stripe: the stripes it has given, the contracts
   * won as it, and how many its next stripe asks (null once it has given all three). Null where a
   * win would count for no class: the simulator's fights, and a rematch in the arena.
   */
  private get stripe(): { kind: Archetype; held: number; won: number; next: number | null } | null {
    const game = this.app.game;
    const kind = this.kind;
    if (!game || !kind || !earnsStripes(this.mission)) return null;
    return { kind, held: stripesOf(game, kind), won: wonAs(game, kind), next: nextStripeAt(game, kind) };
  }

  /**
   * The first of the pilot's saved builds that is of the class the contract asks for, by its slot: the one
   * to turn to for what the contract pays more. Null when it asks for nothing, or nothing saved is of it.
   */
  private get fits(): number | null {
    const asks = this.mission.asks ?? this.mission.crown;
    const found = asks ? this.builds.find((sortie) => sortie.slot !== null && archetypeOf(sortie.build, this.app.deps.catalog) === asks) : undefined;
    return found?.slot ?? null;
  }

  /** Walks through the builds there are to take, round and round. */
  private turnBuild(step: number): void {
    const count = this.builds.length;
    if (count > 0) this.chosen = (this.chosen + step + count) % count;
  }

  /**
   * The count for what is showing, begun the first time it is asked for. Nothing in the hurried mode, where
   * nobody is reading; nothing for a contract flown in a lent mech, or in a build that may not deploy.
   */
  private get counting(): { mission: Mission; fight: Fight; count: Count } | null { return this.countFor(this.level); }

  /** The count for what is showing as it would be on the terms of a level: each has its own, and keeps it. */
  private countFor(level: number): { mission: Mission; fight: Fight; count: Count } | null {
    if (this.app.deps.fast || !this.sortie) return null;
    const key = `${this.mission === this.other ? 'other' : 'first'}/${this.sortie.slot ?? 'floor'}/${this.wingman?.id ?? 'alone'}/${level}`;
    if (!this.counts.has(key)) {
      const prospect = this.app.prospect(this.mission, this.wingman?.id ?? null, this.sortie.slot, level);
      this.counts.set(key, prospect ? { ...prospect, count: newCount() } : null);
    }
    return this.counts.get(key) ?? null;
  }

  /** How near the lost flights of the count showing were, once that is worked out and where the odds are not good. */
  private get near(): Nearness | null {
    const counting = this.counting;
    return counting ? nearness(counting.count) : null;
  }

  /** The odds as far as they are counted, and whether that is all of them. */
  private get odds(): (Forecast & { done: boolean }) | null {
    const counting = this.counting;
    return counting ? { ...counting.count.tally, done: counted(counting.count) } : null;
  }

  update(dtMs: number): void {
    this.writer.update(dtMs);
    this.held = Math.max(0, this.held - dtMs);
    // The wait for the odds of raised terms is time spent on those terms.
    const waiting = this.waiting;
    if (waiting) this.waited += dtMs;
    // A few actions of a flight a frame: the briefing goes on writing itself out while the odds are counted. The
    // count showing first, to its last lost flight flown again; then, behind the page, the terms one step up, so
    // that a pilot who turns to them finds their odds standing.
    const showing = this.counting;
    const ahead = showing && neared(showing.count) && this.level + 1 < this.stakes.length ? this.countFor(this.level + 1) : null;
    const counting = showing && !neared(showing.count) ? showing : ahead && !neared(ahead.count) ? ahead : null;
    if (counting) {
      const { now, catalog } = this.app.deps;
      // A count the pilot is waiting for may take twice the share of the frame.
      const share = waiting ? 2 : 1;
      const until = now ? now() + share * ODDS_BUDGET_MS : 0;
      let goes = 0;
      do {
        counting.count = advance(counting.count, counting.fight, counting.mission, catalog);
        goes += 1;
      } while (now && goes < share * ODDS_GOES && !neared(counting.count) && now() < until);
    }
    this.refresh();
  }

  onInput(action: InputAction): void {
    this.refresh();
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.app.closeBriefing(this.first);
    else if (this.list.selected?.id === 'terms' && (action === 'left' || action === 'right' || action === 'confirm')) this.turnTerms(action === 'left' ? -1 : 1);
    else if (this.list.selected?.id === 'wingman' && (action === 'left' || action === 'right' || action === 'confirm')) this.choose(action === 'left' ? -1 : 1);
    else if (this.list.selected?.id === 'build' && (action === 'left' || action === 'right' || action === 'confirm')) this.turnBuild(action === 'left' ? -1 : 1);
    // A press that comes in the briefing's first moment was meant for the list before it: a contract is not launched by it.
    else if (action === 'confirm' && this.held > 0) return;
    else if (action === 'confirm') {
      const id = this.list.selected?.id;
      // Accepting fits the build that was chosen, if it is not the one on the floor already, and starts the contract in it,
      // on the terms showing. Not while their odds are still being counted, and not on terms whose bond is not held.
      if (id === 'accept') {
        if (!this.list.selected?.enabled) return;
        this.app.startMission(this.mission.id, !!this.mission.replay, this.wingman?.id ?? null, this.mission === this.other, this.sortie?.slot ?? null, this.level);
      }
      // The other side's offer and back: the cursor stays on the row that turns the page, and the song is the client's whose page it is.
      else if (id === 'other' && this.other) {
        this.turnTo(this.mission === this.other ? this.first : this.other, 'other');
        this.app.playTrack(briefingTrack(this.mission));
      }
      else this.app.closeBriefing(this.first); // back to the list the briefing was opened from
    }
  }

  view(): ScreenView {
    this.refresh();
    const terms = this.terms;
    return {
      menu: { items: this.list.items, cursor: this.list.cursor },
      // True while the briefing is still writing itself out.
      typing: !this.writer.done,
      // True for the moment in which a press is not taken: whoever drives the game waits it out.
      busy: this.held > 0,
      briefing: {
        mission: this.mission.id, replay: !!this.mission.replay, reward: this.fee, objectives: objectiveLines(this.mission), ground: groundLines(this.mission),
        wingman: this.hires.length === 0 ? null
          : { id: this.wingman?.id ?? null, name: this.wingman?.name ?? B.alone, share: Math.round((this.wingman?.share ?? 0) * 100), open: this.hires.length },
        lent: !isDrill(this.mission) && this.mission.loaner !== undefined,
        // The build it will be taken in: the slot it is saved in (null for the one on the floor), what kind of machine it is, and how many there are to turn through.
        build: this.sortie ? { slot: this.sortie.slot, kind: this.kind, choices: this.builds.length } : null,
        // How the contract is likely to go in it: flights won of those counted so far, and whether all are counted.
        odds: this.odds,
        // How near its lost flights were, once that is worked out and where the odds are not good.
        near: this.near,
        // The terms it would be taken on, where it takes any: what they multiply and stake, whether this pilot holds
        // the bond, and whether the row that takes it is waiting for their odds.
        terms: terms ? { level: terms.level, factor: terms.factor, fee: terms.fee, bond: terms.bond, held: terms.refusal === null, waiting: this.waiting } : null,
        // How near the class of that build is to its next stripe, where a win counts for a class.
        stripe: this.stripe,
        // The class the contract asks for, when it asks, and whether the build chosen is of it.
        // And the slot of the first saved build that is of it, for the pilot who would rather be paid for it.
        asks: this.mission.asks ? { kind: this.mission.asks, met: this.kind === this.mission.asks, fits: this.fits } : null,
        // The crown a master's duel is fought for: whether the build chosen is of its class, whether the pilot holds it already,
        // and the slot of the first saved build that is of it.
        crown: this.mission.crown
          ? { kind: this.mission.crown, met: this.kind === this.mission.crown, held: crownHeld(this.app.game!, this.mission.crown), fits: this.fits } : null,
        // How many offers there are for this contract, the client of the one showing, and whether that is the other side's.
        offers: this.other ? 2 : 1, client: this.mission.client, turned: this.mission === this.other,
      },
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.refresh();
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
    // Raised terms are named first, wherever the cursor is: what A accepts is always in view.
    const terms = this.terms;
    const raised = terms !== null && terms.level > 0;
    // A rematch says first that it is one: what it is a rematch of, its briefing goes on to say.
    const tag = raised ? B.termsTag(STRINGS.stakes.names[terms.level], terms.factor)
      : mission.rematch ? STRINGS.arena.rematchTag
      : isDrill(mission) ? STRINGS.training.tag
      : isRange(mission) ? STRINGS.training.rangeTag
      : mission.loaner !== undefined ? B.lent
      : mission.id.startsWith('cup-') ? STRINGS.arena.cups.tag
      : isSeat(mission) ? STRINGS.arena.seat.tag
      : isMaster(mission) ? STRINGS.arena.masters.tag
      : mission.arenaRank !== undefined || mission.id === MIRROR_ID ? STRINGS.arena.fight
      : mission.replay ? B.replay
      : isSwarm(mission) ? B.swarm
      : mission.job !== undefined ? B.jobs[mission.job]
      : mission.grudge !== undefined ? B.account
      : mission.id.startsWith('open-') ? (mission.elite ? B.openElite : B.open)
      : mission.phase === 'choice' ? B.exclusive : mission.phase === 'verdict' ? B.verdict
      : mission.phase === 'finale' ? B.finale : mission.phase === 'patrol' ? B.repeatable
      : this.other ? (mission === this.other ? B.otherTag : B.twoOffers) : '';
    const sortie = this.sortie;
    const kind = this.kind;
    wrap(tag, charsFor(LOGICAL_W - 84)).slice(0, 2).forEach((line, i) =>
      drawText(ctx, line, 72, 40 + i * 11, { color: raised ? COLORS.heat : decisive ? COLORS.danger : COLORS.dim }));
    // An open contract that asks for a class says so on the second line, which its one-line tag leaves free:
    // lit in the colour of pay when the build chosen is of that class; a notice otherwise, which then points
    // to the saved build that is, when there is one.
    if (mission.asks) {
      const met = kind === mission.asks;
      const fits = this.fits;
      // What it pays on top is the pilot's own figure: more for the holder of that class's crown.
      const wants = B.asks(B.wanted[mission.asks], Math.round(askBonus(this.app.game!, mission.asks) * 100));
      drawText(ctx, !met && fits !== null ? `${wants} ${B.asksBuild(fits + 1)}` : wants, 72, 51, { color: met ? COLORS.armor : COLORS.heat });
    }
    // A master's duel says on that line what the crown asks: a win as the master's own class. It is lit and
    // points to a saved build as the line above does; a pilot who holds the crown is told that instead.
    if (mission.crown) {
      const M = STRINGS.arena.masters;
      const held = crownHeld(this.app.game!, mission.crown);
      const met = kind === mission.crown;
      const fits = this.fits;
      const asked = M.crown(B.wanted[mission.crown]);
      drawText(ctx, held ? M.held : !met && fits !== null ? `${asked} ${B.asksBuild(fits + 1)}` : asked, 72, 51, { color: held || met ? COLORS.armor : COLORS.heat });
    }
    // What it will be taken in, in the corner the title leaves free: which build, and what kind of machine that is.
    // A saved build that was turned to stands out: it is not the one on the floor, and accepting will fit it.
    if (sortie && kind) {
      drawText(ctx, sortie.slot === null ? B.buildOnFloor : B.buildSaved(sortie.slot + 1), LOGICAL_W - 12, 9, { align: 'right', color: COLORS.dim, size: 10 });
      drawText(ctx, C.names[kind].toUpperCase(), LOGICAL_W - 12, 19, { align: 'right', color: sortie.slot === null ? COLORS.text : COLORS.accent });
    }
    // Under it, how the contract is likely to go in that build: dim while it is being counted, then in the colour of the odds.
    const odds = this.odds;
    const oddsText = odds ? (odds.played === 0 ? B.oddsWait : B.odds(odds.won, odds.played)) : '';
    const oddsShade = odds?.done ? oddsColor(odds) : COLORS.dim;
    if (odds) drawText(ctx, oddsText, LOGICAL_W - 12, 30, { align: 'right', color: oddsShade });

    // Body: what the client says, and under it what the contract asks for when that is more than a fight.
    drawPanel(ctx, 4, 72, LOGICAL_W - 8, 122);
    const objectives = objectiveLines(mission);
    const ground = groundLines(mission);
    const lastRow = 78 + (briefingRows(mission) - 1) * LINE;
    const onHire = this.list.selected?.id === 'wingman';
    const onBuild = this.list.selected?.id === 'build' && !!sortie && !!kind;
    const onTerms = this.list.selected?.id === 'terms' && terms !== null;
    // What the line of the odds ends in: what they are, or, where they are not good and that is worked out, how the lost flights were lost.
    const near = this.near;
    const oddsNote = `: ${near ? B.oddsNear[near] : B.oddsNote}`;
    const written = this.writer.visible();
    let at = 0;
    let y = 78;
    if (onTerms) {
      // On the row of the terms the client makes way for them: their name, what they multiply and pay, what is staked, and the odds.
      drawText(ctx, B.termsName(STRINGS.stakes.names[terms.level]), 12, y, { color: COLORS.accent });
      const lines = terms.level === 0 ? [{ text: B.termsStandard, color: COLORS.text }] : [
        { text: B.opposition(terms.factor), color: COLORS.text },
        { text: B.termsFee(terms.fee + terms.bond), color: COLORS.text },
        // A bond this pilot does not hold is said as that, with what is held: these terms cannot be taken.
        terms.refusal === 'bond' ? { text: B.termsNoBond(terms.bond, this.app.game!.credits), color: COLORS.danger } : { text: B.termsBond(terms.bond), color: COLORS.heat },
      ];
      lines.forEach((line, i) => drawText(ctx, line.text, 12, y + 15 + i * LINE, { color: line.color }));
      if (odds) {
        drawText(ctx, oddsText, 12, y + 21 + 6 * LINE, { color: oddsShade });
        drawText(ctx, oddsNote, 12 + Math.round(oddsText.length * CHAR_W), y + 21 + 6 * LINE, { color: COLORS.dim });
      }
      drawText(ctx, B.termsHint, 12, 191 - LINE, { color: COLORS.dim });
    }
    if (onHire) {
      // On the wingman's row the client makes way for a word about whoever is being considered.
      drawText(ctx, (this.wingman?.name ?? B.alone).toUpperCase(), 12, y, { color: COLORS.accent });
      wrap(this.wingman?.text ?? B.aloneText, BRIEFING_CHARS).forEach((line, i) => drawText(ctx, line, 12, y + 15 + i * LINE));
      if (this.wingman) drawText(ctx, B.wingmanTerms(this.wingman.damage, Math.round(this.wingman.share * 100)), 12, y + 15 + 3 * LINE, { color: COLORS.heat });
      drawText(ctx, B.wingmanHint, 12, 191 - LINE, { color: COLORS.dim });
    }
    if (onBuild) {
      // On the build's row the client makes way for the build: which it is, what kind of machine, its figures and what it carries.
      const catalog = tunedCatalog(this.app.deps.catalog, this.app.game?.tuning);
      const stats = computeBuildStats(sortie.build, catalog);
      const armour = (['head', 'core', 'arms', 'legs'] as const).reduce((sum, slot) => sum + (catalog[sortie.build[slot]!] as { ap: number }).ap, 0);
      drawText(ctx, sortie.slot === null ? B.buildOnFloor : B.buildSaved(sortie.slot + 1), 12, y, { color: COLORS.accent });
      // At the end of that row, the stripes of its class and how near the next is: lit when this contract, won, is the one that earns it.
      const stripe = this.stripe;
      if (stripe) {
        const last = stripe.next !== null && stripe.won + 1 >= stripe.next;
        const words = stripe.next === null ? S.allThree : last ? S.thisWin : S.towards(stripe.won, stripe.next);
        drawText(ctx, words, LOGICAL_W - 12, y + 1, { align: 'right', color: stripe.next === null || last ? STRIPE_COLOR : COLORS.dim, size: 10 });
        drawStripes(ctx, LOGICAL_W - 12 - words.length * SMALL_W - 4 - STRIPES_W, y + 2, stripe.held);
      }
      drawText(ctx, C.garage(C.names[kind], C.tags[kind]), 12, y + 15);
      drawText(ctx, `${G.armour} ${armour}   ${G.mobility} ${stats.mobility}   ${G.energy} ${stats.turnEnergy}`, 12, y + 15 + LINE, { color: COLORS.dim });
      CARRIED.forEach((slot, i) => {
        const id = sortie.build[slot];
        const row = y + 19 + (i + 2) * LINE;
        drawText(ctx, G.slotTags[slot], 12, row + 1, { color: COLORS.dim, size: 10 });
        drawText(ctx, id !== undefined && Object.hasOwn(catalog, id) ? catalog[id].name : '-', 46, row, { color: id === undefined ? COLORS.dim : COLORS.text });
      });
      // The odds again, with what they are: the game's own pilot flying the contract in this build.
      if (odds) {
        drawText(ctx, oddsText, 12, y + 21 + 6 * LINE, { color: oddsShade });
        drawText(ctx, oddsNote, 12 + Math.round(oddsText.length * CHAR_W), y + 21 + 6 * LINE, { color: COLORS.dim });
      }
      // With something to turn to, how; with nothing, where builds are saved. A saved build that cannot be flown
      // now is named with what it is short of: beside the hint, or where the page would say that none is saved.
      const [down] = this.grounded;
      const short = down === undefined ? null
        : down.part !== undefined ? B.buildShort(down.slot + 1, Object.hasOwn(catalog, down.part) ? catalog[down.part].name : down.part) : B.buildGrounded(down.slot + 1);
      if (this.builds.length > 1) {
        drawText(ctx, B.buildHint, 12, 191 - LINE, { color: COLORS.dim });
        if (short) drawText(ctx, short, LOGICAL_W - 12, 192 - LINE, { align: 'right', color: COLORS.heat, size: 10 });
      } else drawText(ctx, short ?? B.buildNone, 12, 191 - LINE, { color: short ? COLORS.heat : COLORS.dim });
    }
    for (const paragraph of onHire || onBuild || onTerms ? [] : this.rows) {
      for (const _full of paragraph) {
        const line = written[at++];
        if (y > lastRow) break;
        drawText(ctx, line, 12, y);
        y += LINE;
      }
      y += BRIEFING_GAP;
    }
    // What the contract asks for appears when the client has finished talking.
    // What the ground does comes last, in the colour of the weather.
    if (this.writer.done && !onHire && !onBuild && !onTerms) {
      const under = [...objectives.map((text) => ({ text, color: COLORS.heat })), ...ground.map((text) => ({ text, color: COLORS.energy }))];
      under.forEach((line, i) => drawText(ctx, line.text, 12, 191 - (under.length - i) * LINE, { color: line.color }));
    }

    // Footer: what to expect, what it pays, and the choice.
    drawPanel(ctx, 4, 198, LOGICAL_W - 8, 68);
    drawText(ctx, B.engagements(mission.battles.length), 12, 203, { color: COLORS.dim });
    // A fight on the range has no fee and no bill: it says so where a contract says what it pays.
    drawText(ctx, isRange(mission) ? STRINGS.training.rangePays : `${B.reward} ${this.fee}`, 12, 215, { size: 16, color: COLORS.armor });
    if (this.hires.length > 0) {
      drawText(ctx, B.wingman, 12, 233, { color: COLORS.dim });
      drawText(ctx, this.wingman?.name ?? B.alone, 12, 243, { color: this.wingman ? COLORS.accent : COLORS.text });
      if (this.wingman) drawText(ctx, B.wingmanShare(Math.round(this.wingman.share * 100)), 12, 253, { color: COLORS.dim });
    }
    drawText(ctx, B.hostiles, 104, 203, { color: COLORS.dim });
    hostiles(mission).slice(0, 5).forEach((line, i) => drawText(ctx, line, 104, 213 + i * 10));
    // Three rows as a rule (take it, the build, leave it); a contract with somebody for hire and a second offer has
    // five, and room for them: the block stays in the middle of the footer until it would reach the footer's edge.
    const rows = this.list.items.length;
    drawList(ctx, this.list, 236, MENU_TOP[Math.min(rows, MENU_TOP.length) - 1], 56, Math.max(3, rows));
  }
}
