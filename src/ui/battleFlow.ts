import { chooseAutoPlayerAction, chooseEnemyAction } from '../core/ai';
import {
  activeUnit, applyAction, checkAction, hardenedAgainst, objectiveTarget, previewShot, weaponNow, ROUND_LIMIT,
  type Action, type BattleEvent, type BattleState, type Refusal, type ShotPreview, type UnitState, ORDERS,
} from '../core/battle';
import { moduleOf, weaponIn } from '../core/build';
import { LESSONS, type Lesson, type LessonLine, type TalkLine } from '../core/campaign';
import { FRAME_SLOTS, WEAPON_SLOTS, type Catalog, type FrameSlot, type WeaponSlot } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';

export type BattlePhase =
  | 'action' | 'weapon' | 'target' | 'repairPart' | 'moduleTarget' | 'confirmRetreat' | 'animating' | 'talk' | 'result';

/** A line being said over the battle. */
export interface Spoken { who: string; portrait?: string; text: string }

/** What the battle asks for, as the screen shows it: a line, and a bar where there is something to count. */
export interface ObjectiveView {
  text: string;
  meter?: { value: number; max: number };
  /** The enemy the objective is about, if it names one. */
  target?: string;
}

export interface FlowOptions {
  /** Lines said at the start, at the start of a round, when one enemy is left, when the pilot is hurt, and after a win. */
  talk?: TalkLine[];
  /** The cycle of the game the battle is fought in: lines kept for a later cycle are said from that cycle on. The first, when absent. */
  cycle?: number;
  /** Nothing is said at all, a boss's own lines included. Tests play this way. */
  quiet?: boolean;
  /** What stands in the message bar as the battle opens, before anything has happened. */
  opening?: string;
  /** What this pilot has not been told yet: each line is said once, the first time its moment comes (see `Lesson`). */
  lessons?: Partial<Record<Lesson, LessonLine>>;
  /** The pilot let the machine fly the last turn of the battle before this one, in the same contract: see `flewItself`. */
  auto?: boolean;
}

const O = STRINGS.objectives;
/** What a unit calls one of its parts. */
export const partName = (unit: UnitState, slot: FrameSlot): string => unit.partNames?.[slot] ?? STRINGS.parts[slot];
/** `note` is a second line: what a weapon costs to fire, or why it cannot be fired. */
export interface MenuItem { id: string; label: string; enabled: boolean; note?: string }
export interface MenuView { items: MenuItem[]; cursor: number }

type ActionId = 'fire' | 'boost' | 'guard' | 'cool' | 'module' | 'repair' | 'order' | 'auto' | 'endTurn' | 'retreat';
const W = STRINGS.weaponMenu;

/**
 * The battle screen without any drawing: which menu is open, what is highlighted,
 * and which message is showing. Input and `advance()` are the only ways it changes.
 */
export class BattleFlow {
  state: BattleState;
  phase: BattlePhase = 'animating';
  menu: MenuView = { items: [], cursor: 0 };
  targetId: string | null = null;
  /** The enemy the pilot fired at last: the next weapon is aimed at the same one. */
  private lastTarget: string | null = null;
  targetPart: FrameSlot | null = null;
  preview: ShotPreview | null = null;
  /** True while targeting with a weapon whose shot would push heat past the limit. */
  overheatWarning = false;
  message = '';
  /** The event behind the current message, for the screen to animate. */
  lastEvent: BattleEvent | null = null;
  /** The line being said, while the phase is `talk`. */
  spoken: Spoken | null = null;
  /** Why the battle ended the way it did, when that is not plain to see. */
  resultNote = '';
  /** The lessons said in this battle, in the order they were said: whoever keeps the game remembers them. */
  readonly taught: Lesson[] = [];

  private shown = 0;
  private weapon: WeaponSlot | null = null;
  /** The row of the action menu to come back to, after something that leaves the turn going. */
  private keepCursor: number | null = null;
  /** The row of the menu a list was opened from (the weapons, the parts to repair, a question): B out of it comes back here. */
  private openedFrom: number | null = null;
  /** The weapon the pilot's last kill readied, while the run it belongs to goes on: the weapon menu opens on it. */
  private chained: WeaponSlot | null = null;
  /** The events, by their place in the battle's list, at which a kill readied a weapon for nothing: see `readiedForNothing`. */
  private idle = new Set<number>();
  /** Set by Auto Turn: the automatic player acts until this turn is over. */
  private autoTurn = false;
  /**
   * True from the turn the pilot hands to Auto Turn until they do something themselves: the menu then opens
   * on Auto Turn, so that a battle flown that way is one press a turn and not three.
   */
  flewItself = false;
  private waiting: Spoken[] = [];
  private afterTalk: () => void = () => {};
  /** The rounds whose lines have been said, and the moments (`last`, `hurt`) that have had theirs. */
  private roundsSaid = new Set<number>();
  private momentsSaid = new Set<'last' | 'hurt'>();
  /** How many enemies the battle began with. */
  private began: number;

  constructor(state: BattleState, private catalog: Catalog, private opts: FlowOptions = {}) {
    this.state = state;
    this.began = state.units.filter((u) => u.side === 'enemy').length;
    if (opts.opening) this.message = opts.opening;
    this.flewItself = opts.auto === true;
    this.say(this.lines('start'), () => { this.phase = 'animating'; });
  }

  /** The lines there are to say in this telling of the story: one kept for a later cycle is not among them before it. */
  private get talk(): TalkLine[] {
    return (this.opts.talk ?? []).filter((line) => (line.cycle ?? 0) <= (this.opts.cycle ?? 0));
  }

  private lines(at: TalkLine['at']): Spoken[] {
    return this.talk.filter((line) => line.at === at).map(({ who, portrait, text }) => ({ who, text, ...(portrait ? { portrait } : {}) }));
  }

  /**
   * The lines of a moment that has come and has not had them yet: one enemy left of several, the
   * pilot's core below half. Each moment has its say once in a battle. They are asked for whenever
   * the pilot is about to be handed the menu, so a moment that comes in the middle of a turn (the
   * shot that left one standing did not end it) is spoken of then, not a round later; a turn played
   * by Auto Turn hands over no menu, and says it at the next one. A battle that is over is never
   * asked: what is said then is what is said of a win.
   */
  private moments(): Spoken[] {
    const core = this.player.parts.core;
    const come: Record<'last' | 'hurt', boolean> = {
      last: this.began > 1 && this.livingEnemies().length === 1,
      hurt: !!core && core.ap * 2 < core.maxAp,
    };
    return (['last', 'hurt'] as const).flatMap((moment) => {
      if (!come[moment] || this.momentsSaid.has(moment)) return [];
      this.momentsSaid.add(moment);
      return this.lines(moment);
    });
  }

  /**
   * The lessons whose moment this is and which this pilot has not had. A lesson is about what the
   * pilot is looking at as the menu is handed over: the weapon a kill has just readied, the machine
   * that has just lost its nerve and still stands. A moment that went by without a menu (a turn
   * played by Auto Turn, a volley that ended the battle) has no line; the next one will.
   */
  private lessons(come: Record<Lesson, boolean>): Spoken[] {
    if (this.opts.quiet) return [];
    return LESSONS.flatMap((id) => {
      const line = this.opts.lessons?.[id];
      if (!line || !come[id] || this.taught.includes(id)) return [];
      this.taught.push(id);
      return [{ who: line.who, text: line.text, ...(line.portrait ? { portrait: line.portrait } : {}) }];
    });
  }

  /** Says the lines one confirm at a time, then carries on with `then`. With nothing to say, or when quiet, at once. */
  private say(lines: Spoken[], then: () => void): void {
    if (lines.length === 0 || this.opts.quiet) return then();
    this.waiting = lines.slice(1);
    this.spoken = lines[0];
    this.afterTalk = then;
    this.phase = 'talk';
    this.menu = { items: [], cursor: 0 };
  }

  private nextLine(): void {
    const next = this.waiting.shift();
    if (next) { this.spoken = next; return; }
    this.spoken = null;
    this.afterTalk();
  }

  /** What a boss says as the phase an event announces begins, if it says anything. */
  private phaseLine(event: BattleEvent): Spoken | null {
    if (event.type !== 'phase') return null;
    const unit = this.state.units.find((u) => u.id === event.unit);
    const text = unit?.phases[event.phase - 1]?.line;
    return unit && text ? { who: unit.name, text, ...(unit.portrait ? { portrait: unit.portrait } : {}) } : null;
  }

  /** The objective as the screen shows it; null for a plain fight to the end. */
  private get asked(): ObjectiveView | null {
    const { objective, asset, round } = this.state;
    const target = objectiveTarget(this.state);
    switch (objective.type) {
      case 'destroy': return null;
      case 'survive': return { text: O.survive(Math.min(round, objective.rounds), objective.rounds), meter: { value: Math.min(round, objective.rounds), max: objective.rounds } };
      case 'protect': {
        const left = this.assetLeft;
        return asset && left !== null ? { text: O.protect(asset.name, left, asset.maxHp), meter: { value: left, max: asset.maxHp } } : null;
      }
      case 'leader': return target ? { text: O.leader(target.name), target: target.id } : null;
      case 'disable': return target ? { text: O.disable(target.name), target: target.id } : null;
      case 'driveOff': {
        if (!target) return null;
        const core = target.parts.core!;
        const floor = objective.share * core.maxAp;
        return { text: O.driveOff(target.name), target: target.id, meter: { value: Math.max(0, core.ap - floor), max: core.maxAp - floor } };
      }
    }
  }

  /**
   * What is left of what the battle is fought to keep alive, as far as has been said; null where there is nothing to
   * keep. The rules take a round's toll from it as the last machine of the round acts, and it is not taken on the
   * screen (the strip that counts it, the picture on the field) until the message bar has said so.
   */
  get assetLeft(): number | null {
    const asset = this.state.asset;
    if (!asset) return null;
    let left = asset.hp;
    for (let i = this.shown; i < this.state.events.length; i++) {
      const event = this.state.events[i];
      if (event.type === 'asset') left += event.lost;
    }
    return left;
  }

  /**
   * What the battle asks for, as the strip under the message bar says it. Machines still to come are
   * counted with it, or in its place where the battle asks for nothing but everything destroyed.
   * They are counted as far as has been said: the rules bring on all a round has room for at once,
   * and a machine is still to come until the message bar has said it is here.
   */
  get objective(): ObjectiveView | null {
    const asked = this.asked;
    let more = this.state.reserve.length;
    for (let i = this.shown; i < this.state.events.length; i++) if (this.state.events[i].type === 'arrive') more++;
    if (more === 0) return asked;
    return asked ? { ...asked, text: `${asked.text}  ${O.more(more)}` } : { text: O.reserve(more) };
  }

  /** Why the battle ended as it did, where the objective decided it. */
  private noteFor(): string {
    const { objective, outcome, asset, round } = this.state;
    const target = objectiveTarget(this.state);
    if (outcome === 'victory') {
      switch (objective.type) {
        case 'survive': return O.won.survive;
        case 'protect': return O.won.protect(objective.name);
        // One that stood there alone was nobody's leader: it is said by its name.
        case 'leader': return target && this.state.units.filter((unit) => unit.side === 'enemy').length === 1 ? O.won.down(target.name) : O.won.leader;
        case 'disable': return O.won.disable;
        case 'driveOff': return target ? O.won.driveOff(target.name) : '';
        case 'destroy': return '';
      }
    }
    if (this.player.destroyed) return '';
    if (asset && asset.hp <= 0) return O.lost.asset(asset.name);
    if (objective.type === 'disable' && target?.destroyed) return O.lost.target;
    return round >= ROUND_LIMIT ? O.lost.time : '';
  }

  /** How many of the state's events have been turned into messages so far. */
  get eventsShown(): number {
    return this.shown;
  }

  private get player(): UnitState {
    return this.state.units[0];
  }

  private unitName(id: string): string {
    return this.state.units.find((u) => u.id === id)?.name ?? id;
  }

  /**
   * Whether R1 would set the Overdrive off right now: `ready` when it would, `wait` when the meter is
   * full but a Second Wind has nothing to give back yet, and null when there is nothing to say.
   */
  get overdrive(): 'ready' | 'wait' | null {
    if (this.phase !== 'action') return null;
    const refusal = checkAction(this.state, { type: 'overdrive' }, this.catalog);
    return refusal === null ? 'ready' : refusal === 'nothingSpent' ? 'wait' : null;
  }

  private can(action: Action): boolean {
    return checkAction(this.state, action, this.catalog) === null;
  }

  private livingEnemies(): UnitState[] {
    return this.state.units.filter((u) => u.side === 'enemy' && !u.destroyed);
  }

  /** The living enemies a weapon may be fired at, in the order they stand. */
  private targetsOf(slot: WeaponSlot): UnitState[] {
    return this.livingEnemies().filter((e) => this.can({ type: 'fire', weapon: slot, target: e.id, part: 'core' }));
  }

  /**
   * The enemy a weapon is aimed at when its list opens, if there is one: the enemy the pilot fired at
   * last (their own choice holds), else the one the contract names, else the first standing.
   */
  private firstTarget(slot: WeaponSlot): UnitState | undefined {
    const open = this.targetsOf(slot);
    const named = objectiveTarget(this.state);
    return open.find((e) => e.id === this.lastTarget) ?? open.find((e) => e.id === named?.id) ?? open[0];
  }

  /** True while the weapon in hand is one the machine under the sights is hardened against: it does half to it (see `HARDENED`). */
  get halved(): boolean {
    const weapon = this.weapon ? weaponIn(this.player.build, this.weapon, this.catalog) : undefined;
    const target = this.state.units.find((unit) => unit.id === this.targetId);
    return !!weapon && !!target && hardenedAgainst(target, weapon);
  }

  /** Which of the enemies the weapon in hand can reach is under the sights, counted from one, and how many there are. */
  get targetChoice(): { at: number; of: number } {
    const open = this.weapon ? this.targetsOf(this.weapon) : [];
    return { at: Math.max(0, open.findIndex((e) => e.id === this.targetId)) + 1, of: open.length };
  }

  /** Why a weapon can neither be fired nor charged right now; null when it can. */
  private weaponRefusal(slot: WeaponSlot): Refusal | null {
    if (this.firstTarget(slot) || this.can({ type: 'charge', weapon: slot })) return null;
    // Charged this turn: it fires from the next turn on, which reads better than "fired".
    if (this.player.charged.includes(slot) && this.player.fired.includes(slot)) return 'alreadyUsed';
    const enemy = this.livingEnemies()[0];
    const fire = enemy ? checkAction(this.state, { type: 'fire', weapon: slot, target: enemy.id, part: 'core' }, this.catalog) : 'invalidTarget';
    // A charge weapon that is not charged is refused for whatever stops it from charging.
    return fire === 'notCharged' ? checkAction(this.state, { type: 'charge', weapon: slot }, this.catalog) : fire;
  }

  private fittedWeapons(): WeaponSlot[] {
    return WEAPON_SLOTS.filter((slot) => weaponIn(this.player.build, slot, this.catalog));
  }

  private repairableParts(): FrameSlot[] {
    return FRAME_SLOTS.filter((part) => this.can({ type: 'repair', part }));
  }

  /**
   * What the weapon a kill readied is good for, as the battle stands: to fire again, to charge again, or
   * nothing (its last round went with the kill, a blade wants another Boost, nothing is left standing to
   * fire at, or something else stops it).
   */
  readied(slot: WeaponSlot): 'ready' | 'charge' | 'empty' | 'boost' | 'clear' | 'none' {
    if (this.livingEnemies().length === 0) return 'clear';
    const refusal = this.weaponRefusal(slot);
    if (refusal === 'noAmmo') return 'empty';
    if (refusal === 'needsBoost') return 'boost';
    if (refusal !== null) return 'none';
    const weapon = weaponIn(this.player.build, slot, this.catalog);
    return weapon?.charge && !this.player.charged.includes(slot) ? 'charge' : 'ready';
  }

  /** True of a `momentum` event, by its place in the battle's list, that readied a weapon the pilot could not fire or charge: as it stood when it was said. */
  readiedForNothing(index: number): boolean {
    return this.idle.has(index);
  }

  /**
   * What the message bar says of an event. `group` is how many events of its kind came together and are
   * said in the one line, and `last` is the last of them.
   */
  private describe(event: BattleEvent, group = 1, last: BattleEvent = event): string | null {
    const name = (id: string) => this.unitName(id);
    const part = (id: string, slot: FrameSlot) => {
      const unit = this.state.units.find((u) => u.id === id);
      return unit ? partName(unit, slot) : STRINGS.parts[slot];
    };
    switch (event.type) {
      case 'shot': {
        const attacker = this.state.units.find((u) => u.id === event.unit)!;
        const fired = weaponIn(attacker.build, event.weapon, this.catalog)?.name ?? event.weapon;
        // A shot that is not the pilot's says whose it was: the weapon alone is a name nobody on the field goes by.
        const weapon = attacker.side === 'enemy' ? `${fired} (${attacker.name})` : fired;
        if (!event.hit) return STRINGS.miss(weapon, name(event.target));
        if (event.shatter) return STRINGS.shatter(weapon, name(event.target));
        // What leapt on from a fork's hit is said as that, unless a barrier took all of it.
        if (event.via && event.damage > 0) return STRINGS.leap(name(event.target), part(event.target, event.appliedTo), event.damage);
        // A hit the barrier took whole shows what the barrier lost instead of armour.
        return event.damage === 0 && event.absorbed
          ? STRINGS.barrierHit(weapon, name(event.target), event.absorbed)
          : STRINGS.hit(weapon, name(event.target), part(event.target, event.appliedTo), event.damage);
      }
      case 'partDestroyed':
        return event.part === 'core' ? null : STRINGS.partDestroyed(name(event.unit), part(event.unit, event.part));
      case 'unitDestroyed': return STRINGS.unitDestroyed(name(event.unit));
      case 'momentum': {
        const M = STRINGS.momentum;
        const weapon = weaponIn(this.player.build, event.weapon, this.catalog)?.name ?? event.weapon;
        // Said as it is of use: a weapon is not called ready that the pilot cannot fire.
        const of = this.readied(event.weapon);
        const what = of === 'clear' ? M.clear : of === 'none' ? '' : M[of](weapon);
        return event.chain > 1 ? M.run(event.chain, what) : what || null;
      }
      case 'arrive': return group > 1 ? STRINGS.arriveMany(group, last.type === 'arrive' ? last.left : 0) : STRINGS.arrive(name(event.unit), event.left);
      case 'shaken': return STRINGS.shaken(name(event.unit));
      case 'rout': return event.fixed ? STRINGS.shutdown(name(event.unit)) : STRINGS.rout(name(event.unit));
      case 'boost': return STRINGS.boost(name(event.unit));
      case 'guard': return STRINGS.guard(name(event.unit));
      case 'stagger': return STRINGS.stagger(name(event.unit));
      case 'recover': return STRINGS.recover(name(event.unit));
      case 'fieldDown': return STRINGS.fieldDown(name(event.unit));
      case 'fieldUp': return STRINGS.fieldUp(name(event.unit));
      case 'hardeningGone': return STRINGS.hardeningGone(name(event.unit));
      case 'charge': {
        const unit = this.state.units.find((u) => u.id === event.unit)!;
        return STRINGS.charge(name(event.unit), weaponIn(unit.build, event.weapon, this.catalog)?.name ?? event.weapon);
      }
      case 'module':
        return STRINGS.module[event.effect](name(event.unit), event.amount, event.target ? name(event.target) : '');
      case 'cool': return STRINGS.cool(name(event.unit), event.amount);
      case 'repair': return STRINGS.repair(name(event.unit), part(event.unit, event.part), event.amount);
      case 'overheat': return event.unit === 'player' ? STRINGS.overheatPlayer : STRINGS.overheat(name(event.unit));
      case 'turnSkipped': return STRINGS.turnSkipped(name(event.unit));
      case 'mend': return STRINGS.mend(name(event.unit), name(event.target), part(event.target, event.part), event.amount);
      case 'fuse': return STRINGS.fuse(name(event.unit), event.left);
      case 'blast': return STRINGS.blast(name(event.unit), name(event.target), event.damage);
      case 'launch': return STRINGS.launch(name(event.unit), name(event.spawned));
      case 'phase': return STRINGS.phase(name(event.unit));
      case 'support': return STRINGS.support(event.name, name(event.target), event.damage);
      case 'order': return STRINGS.orders.told(event.name, event.order);
      case 'overdrive': return STRINGS.overdrive.used(STRINGS.overdrive.names[event.kind]);
      // A round that began with nobody standing against it took nothing from it: there is nothing to say.
      case 'asset': return event.lost > 0 ? STRINGS.asset(this.state.asset?.name ?? '', event.hp, event.lost) : null;
      case 'turnStart':
      case 'outcome':
        return null;
    }
  }

  /** Shows the next queued event; with none left, runs the next enemy action or hands over to the player. */
  advance(): void {
    if (this.phase !== 'animating') return;
    // What a kill gave back, where that is the last thing this step has to say: it is said as the pilot is handed
    // the turn again by this very step, in place of the turn's own line. A step that goes on to something else
    // (the automatic player's next action) says nothing of it: the word over the mech and the sound have.
    let standing: string | null = null;
    /** True where that line says of a weapon that it is ready again, and it is. */
    let readied = false;
    while (this.shown < this.state.events.length) {
      const event = this.state.events[this.shown++];
      // Machines that come on together are said in one line and shown at once. (A field holds three: after two
      // have fallen in a turn there is one left to lose its nerve, so that is always one line as it is.)
      let group = 1;
      if (event.type === 'arrive') {
        for (; this.shown < this.state.events.length && this.state.events[this.shown].type === 'arrive'; this.shown++) group++;
      }
      const text = this.describe(event, group, this.state.events[this.shown - 1]);
      if (event.type === 'momentum' && event.unit === this.player.id) {
        this.chained = event.weapon;
        // Whether the weapon was of any use is settled here, as it is said: a step later the automatic player may have fired it again.
        if (!['ready', 'charge'].includes(this.readied(event.weapon))) this.idle.add(this.shown - 1);
        // What a kill gave back is the last thing a volley says. Nothing waits for it: it is said as the turn is
        // handed back, and stands in the bar while the pilot chooses what to do with it.
        if (this.shown === this.state.events.length && this.state.outcome === 'ongoing') {
          standing = text;
          readied = this.readied(event.weapon) === 'ready';
          continue;
        }
      }
      if (text !== null) {
        this.message = text;
        this.lastEvent = event;
        // A boss has something to say as it changes; the battle waits for it.
        const line = this.phaseLine(event);
        if (line) this.say([line], () => { this.phase = 'animating'; });
        return;
      }
    }
    this.lastEvent = null;
    if (this.state.outcome !== 'ongoing') {
      this.autoTurn = false;
      const result = (): void => {
        this.phase = 'result';
        this.menu = { items: [], cursor: 0 };
        this.message = this.state.outcome === 'victory' ? STRINGS.victory : STRINGS.defeat;
        this.resultNote = this.noteFor();
      };
      return this.say(this.state.outcome === 'victory' ? this.lines('win') : [], result);
    }
    if (activeUnit(this.state).side === 'enemy') {
      this.autoTurn = false;
      this.state = applyAction(this.state, chooseEnemyAction(this.state, this.catalog), this.catalog);
      return;
    }
    if (this.autoTurn) {
      const action = chooseAutoPlayerAction(this.state, this.catalog);
      // Ending the turn and a field repair both hand the turn over: the automatic player stops there.
      if (action.type === 'endTurn' || action.type === 'repair') this.autoTurn = false;
      this.state = applyAction(this.state, action, this.catalog);
      return;
    }
    // The player's turn: whatever was to be said by this round and has not been is said first, once.
    // A round the pilot sat out (a turn lost to heat) keeps its line for the next turn they do get; a
    // battle that ends before there is one never says it, so what must be heard is written for the win.
    const due = [...new Set(this.talk.flatMap((line) => (typeof line.at === 'number' ? [line.at] : [])))]
      .filter((round) => round <= this.state.round && !this.roundsSaid.has(round))
      .sort((a, b) => a - b);
    for (const round of due) this.roundsSaid.add(round);
    // Heat is explained when it is true: the first time the menu comes with the machine at half its limit or hotter.
    const hot = this.player.heat * 2 >= this.player.heatLimit;
    const lessons = this.lessons({ momentum: readied, rout: this.livingEnemies().some((unit) => unit.shaken), heat: hot });
    this.say([...lessons, ...due.flatMap((round) => this.lines(round)), ...this.moments()], () => this.openActionMenu(standing));
  }

  /** Hands the pilot the menu. `standing` is what the bar says in place of the turn's own line, where the step that got here had something to say. */
  private openActionMenu(standing: string | null = null): void {
    const module = moduleOf(this.player.build, this.catalog);
    const fire = this.fittedWeapons().some((slot) => this.weaponRefusal(slot) === null);
    // The painter needs someone to mark; every other module is checked by the rules as it is.
    const moduleReady = !!module && (module.effect === 'painter'
      ? this.livingEnemies().some((e) => this.can({ type: 'module', target: e.id }))
      : this.can({ type: 'module' }));
    const entries: [ActionId, string, boolean][] = [
      ['fire', STRINGS.actions.fire, fire],
      ['boost', STRINGS.actions.boost, this.can({ type: 'boost' })],
      ['guard', STRINGS.actions.guard, this.can({ type: 'guard' })],
      ['cool', STRINGS.actions.cool, this.can({ type: 'cool' })],
      ...(module ? [['module', `${module.name} x${this.player.moduleUses}`, moduleReady] as [ActionId, string, boolean]] : []),
      ['repair', STRINGS.actions.repair, this.repairableParts().length > 0],
      // A hired wingman takes orders: the row says what they are doing now, and choosing it tells them the next thing.
      ...(this.state.support?.orders ? [['order', STRINGS.orders.item(this.state.support.order ?? 'strongest'), true] as [ActionId, string, boolean]] : []),
      ['endTurn', STRINGS.actions.endTurn, true],
      ['auto', STRINGS.actions.auto, true],
      ['retreat', STRINGS.actions.retreat, true],
    ];
    // A row that cannot be chosen says why, beside it.
    const items: MenuItem[] = entries.map(([id, label, enabled]) => ({ id, label, enabled, note: enabled ? undefined : this.shut(id) }));
    this.phase = 'action';
    // After an Overdrive the turn goes on where it was: the cursor comes back to the row it was on.
    const kept = this.keepCursor !== null && items[this.keepCursor] ? this.keepCursor : null;
    this.keepCursor = null;
    this.menu = { items, cursor: kept ?? this.restingRow(items) };
    this.message = standing ?? STRINGS.yourTurn(this.state.round);
    // A run is over with the turn it was made in.
    if (this.player.chain === 0) this.chained = null;
    this.weapon = null;
    this.targetId = null;
    this.targetPart = null;
    this.preview = null;
    this.overheatWarning = false;
  }

  /**
   * Back from a list the pilot opened and left again without choosing: the cursor is on the row it was
   * opened from, and not wherever the menu would rest of itself. (A pilot who lets the machine fly has
   * the menu rest on Auto Turn: one press too many there would fly the turn.)
   */
  private backToActions(): void {
    const row = this.openedFrom;
    this.openActionMenu();
    if (row !== null && this.menu.items[row]) this.menu.cursor = row;
  }

  /** The row the cursor rests on as the menu is handed over. */
  private restingRow(items: MenuItem[]): number {
    const at = (id: ActionId): number => items.findIndex((item) => item.id === id);
    // A pilot who let the machine fly the turn before is offered that again.
    if (this.flewItself) return at('auto');
    if (items[at('fire')].enabled) return at('fire');
    // A blade waits for a boost. Anything else that cannot fire has nothing left to do but end the turn: the
    // cursor does not rest on a row that spends energy, under a press that was meant for something else.
    const waiting = this.fittedWeapons().some((slot) => this.weaponRefusal(slot) === 'needsBoost');
    return waiting && items[at('boost')].enabled ? at('boost') : at('endTurn');
  }

  /** Why a row of the menu cannot be chosen, in a word or two for beside it. Nothing where the row's own count says it. */
  private shut(id: ActionId): string | undefined {
    const N = STRINGS.actionNotes;
    const unit = this.player;
    const short = (refusal: Refusal | null): string | undefined => (refusal === 'noEnergy' ? N.noEnergy
      : refusal === 'legsDisabled' ? N.legs : refusal === 'cannotBoost' ? N.tracks : refusal === 'staggered' ? N.staggered : undefined);
    switch (id) {
      case 'fire': {
        const refusals = this.fittedWeapons().map((slot) => this.weaponRefusal(slot));
        // What stops a weapon that has not fired says more than that the others have.
        const reason = refusals.find((refusal) => refusal !== 'alreadyFired' && refusal !== 'alreadyUsed')
          ?? refusals.find((refusal) => refusal === 'alreadyFired') ?? refusals[0];
        return reason ? W.reasons[reason as keyof typeof W.reasons] : undefined;
      }
      case 'boost':
      case 'guard':
        // One of the two a turn: the row says which of them the machine is doing.
        if (unit.usedBoost) return N.boosting;
        if (unit.usedGuard) return N.guarding;
        return short(checkAction(this.state, { type: id }, this.catalog));
      case 'cool':
        return unit.usedCool ? N.vented : short(checkAction(this.state, { type: 'cool' }, this.catalog));
      case 'module': {
        const refusal = checkAction(this.state, { type: 'module' }, this.catalog);
        return refusal === 'alreadyUsed' ? N.used : refusal === 'invalidTarget' ? N.noTarget : undefined;
      }
      case 'repair':
        if (unit.repairsLeft <= 0) return N.spent;
        // With repairs in hand and nothing to patch: nothing is damaged, or what is damaged is past patching.
        return FRAME_SLOTS.some((part) => unit.parts[part] && unit.parts[part]!.ap <= 0) ? N.late : N.whole;
      default:
        return undefined;
    }
  }

  /** A weapon's menu entry: its name with the shots left, and under it the cost of firing or the reason it cannot. */
  private weaponItem(slot: WeaponSlot): MenuItem {
    const weapon = weaponIn(this.player.build, slot, this.catalog)!;
    const ammo = this.player.ammo[slot];
    const label = `${weapon.name}${typeof ammo === 'number' ? ` x${ammo}` : ''}`;
    const refusal = this.weaponRefusal(slot);
    if (refusal) return { id: slot, label, enabled: false, note: W.reasons[refusal as keyof typeof W.reasons] ?? refusal };
    const { energy, heat } = STRINGS.meters;
    // What the weapon's kind makes of this turn is said with what it costs: all the energy a surge would take, the
    // shots a spool has wound up to, what a redline's heat adds as the machine stands.
    const now = weaponNow(this.state, this.player.id, slot, this.catalog);
    const cost = weapon.trait === 'surge' ? `${energy} ${W.all} ${now.energy}` : `${energy} ${weapon.energy}`;
    const kind = weapon.trait === 'spool' ? `  ${W.shots(now.shots)}` : weapon.trait === 'redline' && now.lift > 100 ? `  +${now.lift - 100}%` : '';
    let note = `${cost}  ${heat} ${weapon.heat}${kind}`;
    if (weapon.charge) {
      note = this.player.charged.includes(slot) ? `${W.ready}  ${heat} ${weapon.heat}` : `${W.charge}  ${energy} ${weapon.energy}`;
    }
    return { id: slot, label, enabled: true, note };
  }

  private openWeaponMenu(): void {
    const items = this.fittedWeapons().map((slot) => this.weaponItem(slot));
    this.phase = 'weapon';
    // On the weapon the last kill readied, while it can be fired: a run is one button pressed again.
    const again = items.findIndex((i) => i.id === this.chained && i.enabled);
    this.menu = { items, cursor: again >= 0 ? again : Math.max(0, items.findIndex((i) => i.enabled)) };
    this.targetId = null;
    this.targetPart = null;
    this.preview = null;
    this.overheatWarning = false;
  }

  private openTarget(targetId: string): void {
    const target = this.state.units.find((u) => u.id === targetId)!;
    // A part that is already destroyed can still be aimed at: the shot goes on to the core, for half. Its row says so.
    const gone = (part: FrameSlot): boolean => part !== 'core' && target.parts[part]!.ap <= 0;
    const items = FRAME_SLOTS.filter((part) => target.parts[part])
      .map((part) => ({ id: part, label: gone(part) ? STRINGS.preview.passedOn(partName(target, part)) : partName(target, part), enabled: true }));
    this.phase = 'target';
    // A machine the client wants in one piece is aimed at by what has to come off it, never first by its core.
    const wanted = this.state.objective.type === 'disable' && objectiveTarget(this.state)?.id === targetId;
    const limb = wanted ? items.findIndex((item) => (item.id === 'legs' || item.id === 'arms') && target.parts[item.id]!.ap > 0) : -1;
    this.menu = { items, cursor: Math.max(0, limb) };
    this.targetId = targetId;
    this.syncTarget();
  }

  private syncTarget(): void {
    this.targetPart = this.menu.items[this.menu.cursor].id as FrameSlot;
    this.preview = previewShot(this.state, 'player', this.weapon!, this.targetId!, this.targetPart, this.catalog);
    const weapon = weaponIn(this.player.build, this.weapon!, this.catalog)!;
    this.overheatWarning = this.player.heat + weapon.heat > this.player.heatLimit;
    this.message = this.overheatWarning ? STRINGS.overheatWarning : STRINGS.yourTurn(this.state.round);
  }

  private openRepairMenu(): void {
    const items = this.repairableParts().map((part) => {
      const p = this.player.parts[part]!;
      return { id: part, label: `${STRINGS.parts[part]}  ${p.ap}/${p.maxAp}`, enabled: true };
    });
    this.phase = 'repairPart';
    this.menu = { items, cursor: 0 };
  }

  private openModuleTargets(): void {
    const items = this.livingEnemies()
      .filter((e) => this.can({ type: 'module', target: e.id }))
      .map((e) => ({ id: e.id, label: e.name, enabled: true }));
    this.phase = 'moduleTarget';
    this.menu = { items, cursor: 0 };
    this.targetId = items[0]?.id ?? null;
  }

  private act(action: Action): void {
    // Whatever the pilot does themselves ends a run of turns the machine flew. An Overdrive is not a row of the menu.
    if (action.type !== 'overdrive') this.flewItself = false;
    this.state = applyAction(this.state, action, this.catalog);
    this.resume();
  }

  /** Back to playing out events, from whichever menu was open. */
  private resume(): void {
    this.phase = 'animating';
    this.menu = { items: [], cursor: 0 };
    this.preview = null;
    this.overheatWarning = false;
    this.advance();
  }

  private moveCursor(delta: number): void {
    const n = this.menu.items.length;
    if (n > 0) this.menu = { ...this.menu, cursor: (this.menu.cursor + delta + n) % n };
  }

  private cycleTarget(delta: number): void {
    const enemies = this.targetsOf(this.weapon!);
    // With one enemy there is nobody to switch to, and the part aimed at stays as it was chosen.
    if (enemies.length < 2) return;
    const index = enemies.findIndex((e) => e.id === this.targetId);
    this.openTarget(enemies[(index + delta + enemies.length) % enemies.length].id);
  }

  onInput(input: InputAction): void {
    if (this.phase === 'animating' || this.phase === 'result') return;
    if (this.phase === 'talk') {
      if (input === 'confirm') this.nextLine();
      return;
    }
    // What was said about a Second Wind that could not be taken is an answer to that press, and goes with the next one.
    if (this.phase === 'action' && input !== 'next' && this.message === STRINGS.overdrive.spendFirst) this.message = STRINGS.yourTurn(this.state.round);
    if (input === 'up' || input === 'down') {
      this.moveCursor(input === 'up' ? -1 : 1);
      if (this.phase === 'target') this.syncTarget();
      if (this.phase === 'moduleTarget') this.targetId = this.menu.items[this.menu.cursor].id;
      return;
    }
    const item = this.menu.items[this.menu.cursor];
    switch (this.phase) {
      case 'action':
        // The Overdrive has a button of its own: R1, on the pilot's turn, once the meter is full.
        if (input === 'next') {
          const refusal = checkAction(this.state, { type: 'overdrive' }, this.catalog);
          if (refusal === null) {
            // Iron Skin and Deadeye change nothing about what can be chosen, so the cursor stays where it was.
            // A Second Wind starts the turn over: the cursor goes back to the top with it, and not on
            // the row that ends the turn, where a turn fired empty had left it.
            if (this.state.units[0].overdrive !== 'second-wind') this.keepCursor = this.menu.cursor;
            return this.act({ type: 'overdrive' });
          }
          // A Second Wind with nothing to give back is not thrown away: the pilot is told why nothing happened.
          if (refusal === 'nothingSpent') this.message = STRINGS.overdrive.spendFirst;
          return;
        }
        if (input !== 'confirm' || !item?.enabled) return;
        this.openedFrom = this.menu.cursor;
        switch (item.id as ActionId) {
          case 'fire': return this.openWeaponMenu();
          case 'repair': return this.openRepairMenu();
          case 'module':
            if (moduleOf(this.player.build, this.catalog)?.effect === 'painter') return this.openModuleTargets();
            return this.act({ type: 'module' });
          case 'order': {
            // Free, and the turn goes on: the menu comes back with the cursor where it was.
            const now = this.state.support?.order ?? 'strongest';
            this.state = applyAction(this.state, { type: 'order', order: ORDERS[(ORDERS.indexOf(now) + 1) % ORDERS.length] }, this.catalog);
            this.shown = this.state.events.length;
            const at = this.menu.cursor;
            this.openActionMenu();
            this.menu.cursor = at;
            this.message = STRINGS.orders.told(this.state.support!.name, this.state.support!.order!);
            return;
          }
          case 'auto':
            this.autoTurn = true;
            this.flewItself = true;
            return this.resume();
          case 'retreat':
            // Giving up loses the contract, so it asks first, with "No" under the cursor.
            this.phase = 'confirmRetreat';
            this.menu = { items: [{ id: 'no', label: STRINGS.retreat.no, enabled: true }, { id: 'yes', label: STRINGS.retreat.yes, enabled: true }], cursor: 0 };
            this.message = STRINGS.retreat.question;
            return;
          default: return this.act({ type: item.id as 'boost' | 'guard' | 'cool' | 'endTurn' });
        }
      case 'confirmRetreat':
        if (input === 'cancel' || (input === 'confirm' && item.id === 'no')) return this.backToActions();
        if (input === 'confirm') this.act({ type: 'retreat' });
        return;
      case 'weapon': {
        if (input === 'cancel') return this.backToActions();
        if (input !== 'confirm' || !item?.enabled) return;
        const slot = item.id as WeaponSlot;
        const target = this.firstTarget(slot);
        // A charge weapon that is not ready yet is charged instead of aimed.
        if (!target) return this.act({ type: 'charge', weapon: slot });
        this.weapon = slot;
        return this.openTarget(target.id);
      }
      case 'target':
        if (input === 'cancel') return this.openWeaponMenu();
        if (input === 'prev') return this.cycleTarget(-1);
        if (input === 'next') return this.cycleTarget(1);
        if (input === 'confirm') {
          this.lastTarget = this.targetId;
          this.act({ type: 'fire', weapon: this.weapon!, target: this.targetId!, part: this.targetPart! });
        }
        return;
      case 'repairPart':
        if (input === 'cancel') return this.backToActions();
        if (input === 'confirm') this.act({ type: 'repair', part: item.id as FrameSlot });
        return;
      case 'moduleTarget':
        if (input === 'cancel') return this.backToActions();
        if (input === 'confirm' && item) this.act({ type: 'module', target: item.id });
        return;
    }
  }
}
