import type { GauntletText } from '../core/gauntlet';
import { STRINGS } from './strings';

const G = STRINGS.gauntlet;

/** The words and places of the Gauntlet's floors. The places come round in this order. */
export const GAUNTLET_TEXT: GauntletText = {
  client: G.client, title: G.title, floor: G.floor, warden: G.warden, debrief: G.debrief,
  backgrounds: ['bg-undercity', 'bg-sluice', 'bg-foundry', 'bg-vault', 'bg-mine'],
};
