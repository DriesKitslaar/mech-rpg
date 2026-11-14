import { chooseAutoPlayerAction, chooseEnemyAction } from '../core/ai';
import {
  activeUnit, applyAction, checkAction, previewShot, HEAT_LIMIT,
  type Action, type BattleEvent, type BattleState, type Refusal, type ShotPreview, type UnitState,
} from '../core/battle';
import { moduleOf, weaponIn } from '../core/build';
import { FRAME_SLOTS, WEAPON_SLOTS, type Catalog, type FrameSlot, type WeaponSlot } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';

export type BattlePhase =
  | 'action' | 'weapon' | 'target' | 'repairPart' | 'moduleTarget' | 'confirmRetreat' | 'animating' | 'result';
/** `note` is a second line: what a weapon costs to fire, or why it cannot be fired. */
export interface MenuItem { id: string; label: string; enabled: boolean; note?: string }
export interface MenuView { items: MenuItem[]; cursor: number }

type ActionId = 'fire' | 'boost' | 'guard' | 'cool' | 'module' | 'repair' | 'auto' | 'endTurn' | 'retreat';
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
  targetPart: FrameSlot | null = null;
  preview: ShotPreview | null = null;
  /** True while targeting with a weapon whose shot would push heat past the limit. */
  overheatWarning = false;
  message = '';
  /** The event behind the current message, for the screen to animate. */
  lastEvent: BattleEvent | null = null;

  private shown = 0;
  private weapon: WeaponSlot | null = null;
  /** Set by Auto Turn: the automatic player acts until this turn is over. */
  private autoTurn = false;

  constructor(state: BattleState, private catalog: Catalog) {
    this.state = state;
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

  private can(action: Action): boolean {
    return checkAction(this.state, action, this.catalog) === null;
  }

  private livingEnemies(): UnitState[] {
    return this.state.units.filter((u) => u.side === 'enemy' && !u.destroyed);
  }

  /** The first living enemy a weapon may be fired at, if any. */
  private firstTarget(slot: WeaponSlot): UnitState | undefined {
    return this.livingEnemies().find((e) => this.can({ type: 'fire', weapon: slot, target: e.id, part: 'core' }));
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

  private describe(event: BattleEvent): string | null {
    const name = (id: string) => this.unitName(id);
    switch (event.type) {
      case 'shot': {
        const attacker = this.state.units.find((u) => u.id === event.unit)!;
        const weapon = weaponIn(attacker.build, event.weapon, this.catalog)?.name ?? event.weapon;
        if (!event.hit) return STRINGS.miss(weapon, name(event.target));
        // A hit the barrier took whole shows what the barrier lost instead of armour.
        return event.damage === 0 && event.absorbed
          ? STRINGS.barrierHit(weapon, name(event.target), event.absorbed)
          : STRINGS.hit(weapon, name(event.target), STRINGS.parts[event.appliedTo], event.damage);
      }
      case 'partDestroyed':
        return event.part === 'core' ? null : STRINGS.partDestroyed(name(event.unit), STRINGS.parts[event.part]);
      case 'unitDestroyed': return STRINGS.unitDestroyed(name(event.unit));
      case 'boost': return STRINGS.boost(name(event.unit));
      case 'guard': return STRINGS.guard(name(event.unit));
      case 'stagger': return STRINGS.stagger(name(event.unit));
      case 'recover': return STRINGS.recover(name(event.unit));
      case 'charge': {
        const unit = this.state.units.find((u) => u.id === event.unit)!;
        return STRINGS.charge(name(event.unit), weaponIn(unit.build, event.weapon, this.catalog)?.name ?? event.weapon);
      }
      case 'module':
        return STRINGS.module[event.effect](name(event.unit), event.amount, event.target ? name(event.target) : '');
      case 'cool': return STRINGS.cool(name(event.unit), event.amount);
      case 'repair': return STRINGS.repair(name(event.unit), STRINGS.parts[event.part], event.amount);
      case 'overheat': return event.unit === 'player' ? STRINGS.overheatPlayer : STRINGS.overheat(name(event.unit));
      case 'turnSkipped': return STRINGS.turnSkipped(name(event.unit));
      case 'mend': return STRINGS.mend(name(event.unit), name(event.target), STRINGS.parts[event.part], event.amount);
      case 'fuse': return STRINGS.fuse(name(event.unit), event.left);
      case 'blast': return STRINGS.blast(name(event.unit), name(event.target), event.damage);
      case 'launch': return STRINGS.launch(name(event.unit), name(event.spawned));
      case 'phase': return STRINGS.phase(name(event.unit));
      case 'support': return STRINGS.support(event.name, name(event.target), event.damage);
      case 'asset': return STRINGS.asset(this.state.asset?.name ?? '', event.hp, event.lost);
      case 'turnStart':
      case 'outcome':
        return null;
    }
  }

  /** Shows the next queued event; with none left, runs the next enemy action or hands over to the player. */
  advance(): void {
    if (this.phase !== 'animating') return;
    while (this.shown < this.state.events.length) {
      const event = this.state.events[this.shown++];
      const text = this.describe(event);
      if (text !== null) {
        this.message = text;
        this.lastEvent = event;
        return;
      }
    }
    this.lastEvent = null;
    if (this.state.outcome !== 'ongoing') {
      this.autoTurn = false;
      this.phase = 'result';
      this.menu = { items: [], cursor: 0 };
      this.message = this.state.outcome === 'victory' ? STRINGS.victory : STRINGS.defeat;
      return;
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
    this.openActionMenu();
  }

  private openActionMenu(): void {
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
      ['endTurn', STRINGS.actions.endTurn, true],
      ['auto', STRINGS.actions.auto, true],
      ['retreat', STRINGS.actions.retreat, true],
    ];
    const items = entries.map(([id, label, enabled]) => ({ id, label, enabled }));
    this.phase = 'action';
    this.menu = { items, cursor: items.findIndex((i) => i.enabled) };
    this.message = STRINGS.yourTurn(this.state.round);
    this.weapon = null;
    this.targetId = null;
    this.targetPart = null;
    this.preview = null;
    this.overheatWarning = false;
  }

  /** A weapon's menu entry: its name with the shots left, and under it the cost of firing or the reason it cannot. */
  private weaponItem(slot: WeaponSlot): MenuItem {
    const weapon = weaponIn(this.player.build, slot, this.catalog)!;
    const ammo = this.player.ammo[slot];
    const label = `${weapon.name}${typeof ammo === 'number' ? ` x${ammo}` : ''}`;
    const refusal = this.weaponRefusal(slot);
    if (refusal) return { id: slot, label, enabled: false, note: W.reasons[refusal as keyof typeof W.reasons] ?? refusal };
    const { energy, heat } = STRINGS.meters;
    let note = `${energy} ${weapon.energy}  ${heat} ${weapon.heat}`;
    if (weapon.charge) {
      note = this.player.charged.includes(slot) ? `${W.ready}  ${heat} ${weapon.heat}` : `${W.charge}  ${energy} ${weapon.energy}`;
    }
    return { id: slot, label, enabled: true, note };
  }

  private openWeaponMenu(): void {
    const items = this.fittedWeapons().map((slot) => this.weaponItem(slot));
    this.phase = 'weapon';
    this.menu = { items, cursor: Math.max(0, items.findIndex((i) => i.enabled)) };
    this.targetId = null;
    this.targetPart = null;
    this.preview = null;
    this.overheatWarning = false;
  }

  private openTarget(targetId: string): void {
    const target = this.state.units.find((u) => u.id === targetId)!;
    const items = FRAME_SLOTS.filter((part) => target.parts[part])
      .map((part) => ({ id: part, label: STRINGS.parts[part], enabled: true }));
    this.phase = 'target';
    this.menu = { items, cursor: 0 };
    this.targetId = targetId;
    this.syncTarget();
  }

  private syncTarget(): void {
    this.targetPart = this.menu.items[this.menu.cursor].id as FrameSlot;
    this.preview = previewShot(this.state, 'player', this.weapon!, this.targetId!, this.targetPart, this.catalog);
    const weapon = weaponIn(this.player.build, this.weapon!, this.catalog)!;
    this.overheatWarning = this.player.heat + weapon.heat > HEAT_LIMIT;
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
    const enemies = this.livingEnemies().filter((e) =>
      this.can({ type: 'fire', weapon: this.weapon!, target: e.id, part: 'core' }));
    const index = enemies.findIndex((e) => e.id === this.targetId);
    this.openTarget(enemies[(index + delta + enemies.length) % enemies.length].id);
  }

  onInput(input: InputAction): void {
    if (this.phase === 'animating' || this.phase === 'result') return;
    if (input === 'up' || input === 'down') {
      this.moveCursor(input === 'up' ? -1 : 1);
      if (this.phase === 'target') this.syncTarget();
      if (this.phase === 'moduleTarget') this.targetId = this.menu.items[this.menu.cursor].id;
      return;
    }
    const item = this.menu.items[this.menu.cursor];
    switch (this.phase) {
      case 'action':
        if (input !== 'confirm' || !item?.enabled) return;
        switch (item.id as ActionId) {
          case 'fire': return this.openWeaponMenu();
          case 'repair': return this.openRepairMenu();
          case 'module':
            if (moduleOf(this.player.build, this.catalog)?.effect === 'painter') return this.openModuleTargets();
            return this.act({ type: 'module' });
          case 'auto':
            this.autoTurn = true;
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
        if (input === 'cancel' || (input === 'confirm' && item.id === 'no')) return this.openActionMenu();
        if (input === 'confirm') this.act({ type: 'retreat' });
        return;
      case 'weapon': {
        if (input === 'cancel') return this.openActionMenu();
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
          this.act({ type: 'fire', weapon: this.weapon!, target: this.targetId!, part: this.targetPart! });
        }
        return;
      case 'repairPart':
        if (input === 'cancel') return this.openActionMenu();
        if (input === 'confirm') this.act({ type: 'repair', part: item.id as FrameSlot });
        return;
      case 'moduleTarget':
        if (input === 'cancel') return this.openActionMenu();
        if (input === 'confirm' && item) this.act({ type: 'module', target: item.id });
        return;
    }
  }
}
