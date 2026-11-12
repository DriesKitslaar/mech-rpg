import type { Perk } from '../core/pilot';

/** What a pilot can learn. One point per level; a point once spent stays spent. */
export const PERKS: Perk[] = [
  { id: 'marksman', name: 'Marksman', description: '+4 hit chance with every weapon.', maxRank: 3, perRank: { aim: 4 } },
  { id: 'reflexes', name: 'Reflexes', description: '+4 evasion while your legs work.', maxRank: 3, perRank: { evasion: 4 } },
  { id: 'capacitor', name: 'Capacitor Tuning', description: '+20 energy every turn.', maxRank: 3, perRank: { energy: 20 } },
  { id: 'heatsinks', name: 'Heat Sinks', description: '+5 heat shed every turn and when venting.', maxRank: 3, perRank: { cooling: 5 } },
  { id: 'fieldTech', name: 'Field Technician', description: '+1 field repair per contract.', maxRank: 2, perRank: { repairs: 1 } },
  { id: 'plating', name: 'Reinforced Plating', description: '+6% armour on every part.', maxRank: 3, perRank: { armour: 0.06 } },
  { id: 'haggler', name: 'Haggler', description: '+8% pay on every contract.', maxRank: 3, perRank: { payBonus: 0.08 } },
  { id: 'quartermaster', name: 'Quartermaster', description: '-15% ammunition and repair costs.', maxRank: 3, perRank: { costDiscount: 0.15 } },
];
