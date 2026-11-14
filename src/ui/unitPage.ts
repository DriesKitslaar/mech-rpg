import { unitSheet } from '../core/codex';
import type { Catalog, EnemyDef } from '../core/types';
import { STRINGS } from '../content/strings';

const D = STRINGS.database;

/** What the database writes about a kind of enemy, read off its parts: three figures, its weapons and what it does. */
export interface UnitPageText {
  stats: { label: string; value: string }[];
  weapons: string[];
  abilities: string[];
}

export function unitPage(def: EnemyDef, catalog: Catalog): UnitPageText {
  const sheet = unitSheet(def, catalog);
  const type = (kind: typeof sheet.weak): string => (kind ? STRINGS.partInfo.types[kind] : D.none);
  const a = def.abilities ?? {};
  const phases = def.phases?.length ?? 0;
  return {
    stats: [
      { label: D.armour, value: String(sheet.armour) },
      { label: D.weak, value: type(sheet.weak) },
      { label: D.strong, value: type(sheet.strong) },
    ],
    weapons: sheet.weapons.map((weapon) => D.weapon(weapon.name, STRINGS.partInfo.types[weapon.type])),
    abilities: [
      ...(a.aegis !== undefined ? [D.aegis(Math.round((1 - a.aegis) * 100))] : []),
      ...(a.mend !== undefined ? [D.mend(Math.round(a.mend * 100))] : []),
      ...(a.jam !== undefined ? [D.jam(a.jam)] : []),
      ...(a.bomb ? [D.bomb(a.bomb.fuse, a.bomb.damage)] : []),
      ...(a.carrier ? [D.carrier(a.carrier.unit.name, a.carrier.every)] : []),
      ...(phases > 0 ? [D.phases(phases)] : []),
    ],
  };
}
