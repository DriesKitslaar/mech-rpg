import { shotsOf } from '../core/battle';
import { impactOf } from '../core/build';
import type { Build, Catalog, Part } from '../core/types';
import { STRINGS } from '../content/strings';
import { wrap } from './widgets';

const I = STRINGS.partInfo;
const pct = (n: number): string => String(Math.round(n * 100));
const signed = (n: number): string => (n >= 0 ? `+${n}` : String(n));
/** The widest line the garage and shop panels can show. */
export const PART_LINE_CHARS = 28;
/** The widest row of comparison chips: one character short of a full line, so the last chip never touches the screen edge. */
export const COMPARE_LINE_CHARS = PART_LINE_CHARS - 1;

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

/** One difference between two parts: "DMG +47", and whether it is for the better. */
export interface DiffChip { text: string; good: boolean }

/** [label, value on the new part, value on the fitted part, whether more is better, unit]. */
type Fact = [string, number, number, boolean, string?];

function facts(part: Part, fitted: Part): Fact[] {
  const D = STRINGS.partInfo;
  if (part.kind === 'weapon' && fitted.kind === 'weapon') {
    // Damage and push are compared by the pull of the trigger: three shots of 20 are more than one of 38.
    return [
      [D.damage, part.damage * shotsOf(part), fitted.damage * shotsOf(fitted), true], [D.accuracy, part.accuracy, fitted.accuracy, true],
      [D.energy, part.energy, fitted.energy, false], [D.heat, part.heat, fitted.heat, false],
      [D.impact, impactOf(part) * shotsOf(part), impactOf(fitted) * shotsOf(fitted), true], [D.weight, part.weight, fitted.weight, false],
    ];
  }
  if (part.kind === 'generator' && fitted.kind === 'generator') {
    return [[D.output, part.output, fitted.output, true], [D.cooling, part.cooling, fitted.cooling, true], [D.weight, part.weight, fitted.weight, false]];
  }
  if (part.kind === 'booster' && fitted.kind === 'booster') {
    return [
      [D.thrust, part.thrust, fitted.thrust, true], [D.boostCost, Math.round(part.cost * 100), Math.round(fitted.cost * 100), false, '%'],
      [D.weight, part.weight, fitted.weight, false], [D.drain, part.drain, fitted.drain, false],
    ];
  }
  if (part.kind === 'fcs' && fitted.kind === 'fcs') {
    return [
      [`${D.aim} K`, part.aim.kinetic, fitted.aim.kinetic, true], [`${D.aim} E`, part.aim.energy, fitted.aim.energy, true],
      [`${D.aim} X`, part.aim.explosive, fitted.aim.explosive, true],
      [D.focus, Math.round(part.focus * 100), Math.round(fitted.focus * 100), true, '%'],
      [D.weight, part.weight, fitted.weight, false], [D.drain, part.drain, fitted.drain, false],
    ];
  }
  if (part.kind === 'module' && fitted.kind === 'module') {
    // Modules do different things; only what they cost the build can be set side by side.
    return [[D.weight, part.weight, fitted.weight, false], [D.drain, part.drain, fitted.drain, false]];
  }
  if (part.kind === 'shield' && fitted.kind === 'shield') {
    // Shown as what the shield blocks, so that more is better.
    return [[D.guardShort, 100 - Math.round(part.guard * 100), 100 - Math.round(fitted.guard * 100), true, '%'], [D.weight, part.weight, fitted.weight, false]];
  }
  if ('resist' in part && 'resist' in fitted && part.kind === fitted.kind) {
    return [
      [D.ap, part.ap, fitted.ap, true], [D.weight, part.weight, fitted.weight, false], [D.drain, part.drain, fitted.drain, false],
      [D.aim, part.aim ?? 0, fitted.aim ?? 0, true], [D.capacity, part.capacity ?? 0, fitted.capacity ?? 0, true],
      [D.mobility, part.mobility ?? 0, fitted.mobility ?? 0, true],
    ];
  }
  return [];
}

/**
 * How a part differs from the one now fitted, as rows of short chips that fit the panel.
 * Only numbers that differ are listed; parts of different kinds give nothing.
 */
export function compareParts(part: Part, fitted: Part): DiffChip[][] {
  const chips = facts(part, fitted).flatMap(([label, mine, theirs, moreIsBetter, unit = '']): DiffChip[] => {
    const delta = mine - theirs;
    return delta === 0 ? [] : [{ text: `${label} ${delta > 0 ? '+' : ''}${delta}${unit}`, good: delta > 0 === moreIsBetter }];
  });
  const rows: DiffChip[][] = [];
  for (const chip of chips) {
    const row = rows.at(-1);
    const width = row ? row.reduce((sum, c) => sum + c.text.length + 2, 0) + chip.text.length : Infinity;
    if (row && width <= COMPARE_LINE_CHARS) row.push(chip);
    else rows.push([chip]);
  }
  return rows;
}

/** The fitted part a new part would replace: same slot, and for a hand weapon the right hand before the left. */
export function fittedFor(part: Part, build: Build, catalog: Catalog): Part | undefined {
  const at = (id: string | undefined): Part | undefined => (id !== undefined && Object.hasOwn(catalog, id) ? catalog[id] : undefined);
  if (part.kind === 'weapon') {
    if (part.mount === 'shoulder') return at(build.shoulder);
    return [at(build.rightHand), at(build.leftHand)].find((p) => p?.kind === 'weapon');
  }
  if (part.kind === 'shield') {
    const left = at(build.leftHand);
    return left?.kind === 'shield' ? left : undefined;
  }
  return at(build[part.kind]);
}
