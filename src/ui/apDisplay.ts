import type { BattleEvent, UnitState } from '../core/battle';
import type { FrameSlot } from '../core/types';

type Change = { due: number; unit: string; part: FrameSlot; delta: number };

/**
 * The armour values the screen shows. The rules apply a whole action at once, but the player
 * should see a bar drop when the shot lands, not when it is fired; this lags the display to match.
 */
export class ApDisplay {
  private shown = new Map<string, Partial<Record<FrameSlot, { ap: number; maxAp: number }>>>();
  private pending: Change[] = [];
  private now = 0;

  constructor(units: UnitState[]) {
    this.copy(units);
  }

  private copy(units: UnitState[]): void {
    for (const unit of units) this.shown.set(unit.id, structuredClone(unit.parts));
  }

  /** Queues the armour change an event causes, to appear after `delayMs`. Events without one are ignored. */
  schedule(event: BattleEvent, delayMs: number): void {
    if (event.type === 'shot' && event.hit) {
      this.pending.push({ due: this.now + delayMs, unit: event.target, part: event.appliedTo, delta: -event.damage });
    } else if (event.type === 'repair') {
      this.pending.push({ due: this.now + delayMs, unit: event.unit, part: event.part, delta: event.amount });
    }
  }

  update(dtMs: number): void {
    this.now += dtMs;
    this.pending = this.pending.filter((change) => {
      if (this.now < change.due) return true;
      const part = this.shown.get(change.unit)?.[change.part];
      if (part) part.ap = Math.max(0, Math.min(part.maxAp, part.ap + change.delta));
      return false;
    });
  }

  /** Adopts the real values once nothing is waiting, so the display can never drift for long. */
  sync(units: UnitState[]): void {
    if (this.pending.length === 0) this.copy(units);
  }

  ap(unitId: string, part: FrameSlot): number {
    return this.shown.get(unitId)?.[part]?.ap ?? 0;
  }
}
