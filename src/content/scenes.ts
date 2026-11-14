import type { Faction, Scene } from '../core/campaign';
import { ENDINGS } from './missions';

const BACKGROUND: Record<Faction, string> = { hadron: 'bg-mine', lumen: 'bg-plaza', undertow: 'bg-neon-district' };

const ending = (faction: Faction): Scene => ({
  id: `ending-${faction}`, title: ENDINGS[faction].title, lines: ENDINGS[faction].body, picture: BACKGROUND[faction],
  after: `finale-${faction}`, faction, ending: true,
});

/** The pages of story shown between contracts, in the order they would come up. */
export const SCENES: Scene[] = [ending('hadron'), ending('lumen'), ending('undertow')];
