import { SEAT_ID, keeperEnemy, type Keeper } from '../core/seat';
import type { EnemyDef } from '../core/types';

const SOVEREIGN = { head: 'head-sovereign', core: 'core-sovereign', arms: 'arms-sovereign', legs: 'legs-sovereign' };

/**
 * Touchstone, who keeps the eighth seat, in the Sovereign: the frame that was built for whoever keeps
 * it. The machine fights three ways and changes as it is hurt, as a boss does: at range with a rail
 * that charges and a howler that knocks whoever is charging their own flat; then with light, one beam
 * of which drains; then with two blades. Each of the three is a machine a pilot could put together
 * from the Sovereign and parts the shop sells.
 *
 * How strong it is was set by measurement (`scripts/masters.ts`), as the masters were: against the
 * late build the game suggests for each class, flown on Auto Turn. With a veteran's six ranks of
 * perks the heavier builds and the ones that shoot from afar take the seat between a third and two
 * thirds of the time, the light ones seldom; with no perks nobody does but now and then; with every
 * perk the builds that suit it nearly always. The tests hold the measure as ranges.
 */
export const KEEPER: Keeper = {
  name: 'Touchstone', paint: 'touchstone', scale: 0.8,
  style: 'The Sovereign fights three ways, changing as it is hurt: a charging rail and a howler that knocks you flat, then light that drains you, then two blades.',
  taunt: 'Seven crowns. Let us see which of them is you.',
  concede: 'It was only ever kept warm. Sit down, pilot.',
  build: { ...SOVEREIGN, generator: 'gen-singularity', booster: 'bst-phase', fcs: 'fcs-omni', module: 'mod-oracle', rightHand: 'wpn-longbow', shoulder: 'wpn-howler' },
  phases: [
    {
      at: 0.66, ai: 'skirmisher', evasion: 6,
      refit: { rightHand: 'wpn-lance-emitter', leftHand: 'wpn-pulse-carbine', shoulder: 'wpn-null-beam', module: 'mod-cryo' },
      line: 'Range is answered. Now the light: mind your generator.',
    },
    {
      at: 0.33, ai: 'bruiser', damage: 1.1,
      refit: { rightHand: 'wpn-gavel', leftHand: 'wpn-arc-blade', shoulder: 'wpn-howler', module: 'mod-overclock' },
      line: 'Guns down. What is left is what you are.',
    },
  ],
};

/** The keeper as a battle fields them, by the id of the duel. */
export const SEAT_ENEMIES: Record<string, EnemyDef> = { [SEAT_ID]: keeperEnemy(KEEPER) };
