import type { Build } from '../core/types';
import { STARTER_BUILD } from './parts';

/** One of the frames a new pilot can start in: what it is called, what kind of machine it is, and what it comes with. */
export interface Starter {
  id: string;
  name: string;
  /** What kind of machine it is, in two or three words. */
  role: string;
  /** What it is, for the pilot who is choosing: three lines of the panel it is read in. */
  text: string;
  build: Build;
  /** The credits the pilot has in hand beside it. What a frame comes with and these credits are worth the same for each. */
  credits: number;
}

const STOCK = { generator: 'gen-kd1', booster: 'bst-stock', fcs: 'fcs-stock' };

/**
 * The three frames on the lot, each salvage of one of the three powers. The first is the frame every
 * pilot used to start in, and is what a pilot who presses on without looking still gets.
 */
export const STARTERS: Starter[] = [
  {
    id: 'hauler', name: 'Hauler', role: 'The workhorse', build: STARTER_BUILD, credits: 1200,
    text: 'An Undertow dock frame, patched more often than painted. It does everything well enough and has room for three guns. It comes with a rifle.',
  },
  {
    id: 'courier', name: 'Courier', role: 'The runner', credits: 900,
    build: { head: 'head-courier', core: 'core-courier', arms: 'arms-courier', legs: 'legs-courier', ...STOCK, rightHand: 'wpn-arc-pistol' },
    text: 'What is left of a Lumen courier: quick on its feet, hard to hit, thin where it counts. It cannot carry much. It comes with a pistol that never runs dry.',
  },
  {
    id: 'dozer', name: 'Dozer', role: 'The wall', credits: 900,
    build: { head: 'head-dozer', core: 'core-dozer', arms: 'arms-dozer', legs: 'legs-dozer', ...STOCK, rightHand: 'wpn-rivet-rifle', leftHand: 'shd-plate' },
    text: 'A Hadron yard dozer with plate welded over the cab. Slow, hard to hurt, and it carries the most by far. It comes with a rifle and a plate to guard behind.',
  },
];

/** The starter of that name; the first of them for a name there is none of. */
export const starterOf = (id: string | undefined): Starter => STARTERS.find((starter) => starter.id === id) ?? STARTERS[0];
