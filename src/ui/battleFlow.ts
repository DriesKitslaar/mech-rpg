import { chooseEnemyAction } from '../core/ai';
import {
  activeUnit, applyAction, checkAction, previewShot,
  type Action, type BattleEvent, type BattleState, type UnitState,
} from '../core/battle';
import { weaponIn } from '../core/build';
import { FRAME_SLOTS, WEAPON_SLOTS, type Catalog, type FrameSlot, type WeaponSlot } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';

export type BattlePhase = 'action' | 'weapon' | 'target' | 'repairPart' | 'animating' | 'result';
export interface MenuItem { id: string; label: string; enabled: boolean }
export interface MenuView { items: MenuItem[]; cursor: number }

const ACTION_IDS = ['fire', 'boost', 'cool', 'repair', 'endTurn'] as const;
type ActionId = (typeof ACTION_IDS)[number];

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
  preview: { hitChance: number; damage: number } | null = null;
  message = '';
  /** The event behind the current message, for the screen to animate. */
  lastEvent: BattleEvent | null = null;

  private shown = 0;
  private weapon: WeaponSlot | null = null;

  constructor(state: BattleState, private catalog: Catalog) {
    this.state = state;
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

  /** Weapons that could be fired at some living enemy right now. */
  private fireableWeapons(): WeaponSlot[] {
    return WEAPON_SLOTS.filter((slot) =>
      this.livingEnemies().some((e) => this.can({ type: 'fire', weapon: slot, target: e.id, part: 'core' })));
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
        return event.hit
          ? STRINGS.hit(weapon, name(event.target), STRINGS.parts[event.part], event.damage)
          : STRINGS.miss(weapon, name(event.target));
      }
      case 'partDestroyed':
        return event.part === 'core' ? null : STRINGS.partDestroyed(name(event.unit), STRINGS.parts[event.part]);
      case 'unitDestroyed': return STRINGS.unitDestroyed(name(event.unit));
      case 'boost': return STRINGS.boost(name(event.unit));
      case 'cool': return STRINGS.cool(name(event.unit), event.amount);
      case 'repair': return STRINGS.repair(name(event.unit), STRINGS.parts[event.part], event.amount);
      case 'overheat': return event.unit === 'player' ? STRINGS.overheatPlayer : STRINGS.overheat(name(event.unit));
      case 'turnSkipped': return STRINGS.turnSkipped(name(event.unit));
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
      this.phase = 'result';
      this.menu = { items: [], cursor: 0 };
      this.message = this.state.outcome === 'victory' ? STRINGS.victory : STRINGS.defeat;
      return;
    }
    if (activeUnit(this.state).side === 'enemy') {
      this.state = applyAction(this.state, chooseEnemyAction(this.state, this.catalog), this.catalog);
      return;
    }
    this.openActionMenu();
    this.message = STRINGS.yourTurn(this.state.round);
  }

  private openActionMenu(): void {
    const enabled: Record<ActionId, boolean> = {
      fire: this.fireableWeapons().length > 0,
      boost: this.can({ type: 'boost' }),
      cool: this.can({ type: 'cool' }),
      repair: this.repairableParts().length > 0,
      endTurn: true,
    };
    const items = ACTION_IDS.map((id) => ({ id, label: STRINGS.actions[id], enabled: enabled[id] }));
    this.phase = 'action';
    this.menu = { items, cursor: items.findIndex((i) => i.enabled) };
    this.weapon = null;
    this.targetId = null;
    this.targetPart = null;
    this.preview = null;
  }

  private openWeaponMenu(): void {
    const items = this.fireableWeapons().map((slot) => {
      const weapon = weaponIn(this.player.build, slot, this.catalog)!;
      const ammo = this.player.ammo[slot];
      const ammoText = ammo === null || ammo === undefined ? STRINGS.meters.unlimited : String(ammo);
      return { id: slot, label: `${weapon.name}  ${STRINGS.meters.energy} ${weapon.energy}  ${STRINGS.meters.ammo} ${ammoText}`, enabled: true };
    });
    this.phase = 'weapon';
    this.menu = { items, cursor: 0 };
    this.targetId = null;
    this.targetPart = null;
    this.preview = null;
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
  }

  private openRepairMenu(): void {
    const items = this.repairableParts().map((part) => {
      const p = this.player.parts[part]!;
      return { id: part, label: `${STRINGS.parts[part]}  ${p.ap}/${p.maxAp}`, enabled: true };
    });
    this.phase = 'repairPart';
    this.menu = { items, cursor: 0 };
  }

  private act(action: Action): void {
    this.state = applyAction(this.state, action, this.catalog);
    this.phase = 'animating';
    this.menu = { items: [], cursor: 0 };
    this.preview = null;
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
      return;
    }
    const item = this.menu.items[this.menu.cursor];
    switch (this.phase) {
      case 'action':
        if (input !== 'confirm' || !item?.enabled) return;
        if (item.id === 'fire') this.openWeaponMenu();
        else if (item.id === 'repair') this.openRepairMenu();
        else this.act({ type: item.id as 'boost' | 'cool' | 'endTurn' });
        return;
      case 'weapon':
        if (input === 'cancel') return this.openActionMenu();
        if (input !== 'confirm') return;
        this.weapon = item.id as WeaponSlot;
        return this.openTarget(this.livingEnemies().find((e) =>
          this.can({ type: 'fire', weapon: this.weapon!, target: e.id, part: 'core' }))!.id);
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
    }
  }
}
