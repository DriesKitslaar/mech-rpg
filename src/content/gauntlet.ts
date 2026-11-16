import type { GauntletText } from '../core/gauntlet';
import type { Build } from '../core/types';
import { STARTER_BUILD } from './parts';
import { STRINGS } from './strings';

const G = STRINGS.gauntlet;

/**
 * The frame every run starts in: the stock frame with an arc pistol in the other hand. The pistol
 * needs no ammunition, so a run is never left facing a floor with nothing to fire.
 */
export const GAUNTLET_BUILD: Build = { ...STARTER_BUILD, leftHand: 'wpn-arc-pistol' };

/** The words and places of the Gauntlet's floors. The places come round in this order. */
export const GAUNTLET_TEXT: GauntletText = {
  // Each is read where it is used, so that a floor is briefed in whatever language is set then.
  get client() { return G.client; }, title: (floor) => G.title(floor), floor: (floor) => G.floor(floor), warden: (name) => G.warden(name),
  get debrief() { return G.debrief; },
  backgrounds: ['bg-undercity', 'bg-sluice', 'bg-foundry', 'bg-vault', 'bg-mine'],
};
