import { impactOf } from '../core/build';
import type { Part } from '../core/types';
import { STRINGS } from '../content/strings';
import { wrap } from './widgets';

const I = STRINGS.partInfo;
const pct = (n: number): string => String(Math.round(n * 100));
const signed = (n: number): string => (n >= 0 ? `+${n}` : String(n));
/** The widest line the garage and shop panels can show. */
export const PART_LINE_CHARS = 28;

/** A part's statistics as short lines of text, for the garage and the shop. */
export function partLines(part: Part): string[] {
  switch (part.kind) {
    case 'weapon':
      return [
        `${I.types[part.damageType]}  ${I.damage} ${part.damage}  ${I.accuracy} ${part.accuracy}`,
        `${I.energy} ${part.energy}  ${I.heat} ${part.heat}  ${I.impact} ${impactOf(part)}`,
        part.ammo === null
          ? `${I.weight} ${part.weight}  ${I.ammo} ${I.unlimited}`
          : `${I.weight} ${part.weight}  ${I.ammo} ${part.ammo}  ${part.costPerShot}${I.perShot}`,
        ...(part.trait ? [I.traits[part.trait](part.traitPower ?? 0)] : []),
        ...(part.charge ? [I.charge] : []),
        ...(part.melee ? [I.melee] : []),
      ];
    case 'generator':
      return [`${I.output} ${part.output}`, `${I.cooling} ${part.cooling}  ${I.weight} ${part.weight}`];
    case 'booster':
      return [`${I.thrust} ${part.thrust}  ${I.boostCost} ${pct(part.cost)}%`, `${I.weight} ${part.weight}  ${I.drain} ${part.drain}`];
    case 'fcs':
      return [
        `${I.aimByType} ${signed(part.aim.kinetic)}/${signed(part.aim.energy)}/${signed(part.aim.explosive)}`,
        `${I.focus} ${pct(part.focus)}%  ${I.weight} ${part.weight}  ${I.drain} ${part.drain}`,
      ];
    case 'module':
      return [
        ...wrap(I.modules[part.effect](part.power), PART_LINE_CHARS),
        `${I.uses} ${part.uses}  ${I.weight} ${part.weight}  ${I.drain} ${part.drain}`,
      ];
    case 'shield':
      return [I.guard(100 - Math.round(part.guard * 100)), `${I.weight} ${part.weight}`];
    default: {
      const extra = [
        part.aim !== undefined ? `${I.aim} +${part.aim}` : '',
        part.capacity !== undefined ? `${I.capacity} ${part.capacity}` : '',
        part.mobility !== undefined ? `${I.mobility} ${part.mobility}` : '',
      ].filter(Boolean).join('  ');
      const legs = part.legType ? I.legTypes[part.legType] : '';
      return [
        `${I.ap} ${part.ap}  ${I.weight} ${part.weight}  ${I.drain} ${part.drain}`,
        `${I.resist} ${pct(part.resist.kinetic)}/${pct(part.resist.energy)}/${pct(part.resist.explosive)}`,
        ...(extra ? [extra] : []),
        ...(legs ? [legs] : []),
      ];
    }
  }
}
