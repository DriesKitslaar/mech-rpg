import type { Part } from '../core/types';
import { STRINGS } from '../content/strings';

const I = STRINGS.partInfo;
const pct = (n: number): string => String(Math.round(n * 100));

/** A part's statistics as short lines of text, for the garage and the shop. */
export function partLines(part: Part): string[] {
  if (part.kind === 'weapon') {
    return [
      `${I.types[part.damageType]}  ${I.damage} ${part.damage}  ${I.accuracy} ${part.accuracy}`,
      `${I.energy} ${part.energy}  ${I.heat} ${part.heat}  ${I.weight} ${part.weight}`,
      part.ammo === null ? `${I.ammo} ${I.unlimited}` : `${I.ammo} ${part.ammo}  ${part.costPerShot} ${I.perShot}`,
      ...(part.trait ? [I.traits[part.trait](part.traitPower ?? 0)] : []),
    ];
  }
  if (part.kind === 'generator') {
    return [`${I.output} ${part.output}`, `${I.cooling} ${part.cooling}  ${I.weight} ${part.weight}`];
  }
  const extra = [
    part.aim !== undefined ? `${I.aim} +${part.aim}` : '',
    part.capacity !== undefined ? `${I.capacity} ${part.capacity}` : '',
    part.mobility !== undefined ? `${I.mobility} ${part.mobility}` : '',
  ].filter(Boolean).join('  ');
  return [
    `${I.ap} ${part.ap}  ${I.weight} ${part.weight}  ${I.drain} ${part.drain}`,
    `${I.resist} ${pct(part.resist.kinetic)}/${pct(part.resist.energy)}/${pct(part.resist.explosive)}`,
    ...(extra ? [extra] : []),
  ];
}
