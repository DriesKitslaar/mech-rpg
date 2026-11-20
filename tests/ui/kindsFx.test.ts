import type { BattleEvent } from '../../src/core/battle';
import type { Weapon } from '../../src/core/types';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { BattleFx, PROJECTILE_MS, WORD_GAP, sizeAt, type Scene } from '../../src/ui/battleFx';
import { COLORS } from '../../src/ui/widgets';

type Shot = Extract<BattleEvent, { type: 'shot' }>;
/** A field of three: the pilot on the left, two machines on the right, one above the other. */
const AT: Record<string, { x: number; y: number }> = { player: { x: 80, y: 80 }, 'enemy-0': { x: 240, y: 60 }, 'enemy-1': { x: 250, y: 110 } };
const scene = (kind?: Weapon['trait']): Scene => ({
  muzzle: (unit) => ({ x: AT[unit].x + 20, y: AT[unit].y - 30 }),
  hitPoint: (unit) => AT[unit],
  centre: (unit) => AT[unit],
  facing: (unit) => (unit === 'player' ? 1 : -1),
  damageType: () => 'energy',
  isMelee: () => false,
  ...(kind ? { kind: () => kind } : {}),
});
const shot = (more: Partial<Shot> = {}): Shot => ({
  type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit: true, damage: 30, ...more,
});
/** The effects of one event, a moment after it began. */
const after = (event: BattleEvent, kind?: Weapon['trait'], ms = 20): BattleFx => {
  const fx = new BattleFx(scene(kind));
  fx.onEvent(event);
  fx.update(ms);
  return fx;
};

describe('what leaps on from a fork\'s hit', () => {
  const leap = shot({ target: 'enemy-1', via: 'enemy-0', damage: 15 });

  test('is drawn from where the hit landed to the second machine, not from the barrel', () => {
    expect(after(shot()).flights()).toEqual([{ from: { x: 100, y: 50 }, to: AT['enemy-0'], grow: [1, 1] }]);
    expect(after(leap).flights()).toEqual([{ from: AT['enemy-0'], to: AT['enemy-1'], grow: [1, 1] }]);
  });

  test('sets out from the middle of the machine the hit landed on, whatever part of the second it strikes', () => {
    const parts: Scene = { ...scene(), hitPoint: (unit, part) => (part === 'core' ? AT[unit] : { x: AT[unit].x, y: AT[unit].y + 20 }) };
    const fx = new BattleFx(parts);
    fx.onEvent({ ...leap, part: 'legs', appliedTo: 'legs' });
    fx.update(20);
    expect(fx.flights()).toEqual([{ from: AT['enemy-0'], to: { x: AT['enemy-1'].x, y: AT['enemy-1'].y + 20 }, grow: [1, 1] }]);
  });

  test('is as large where it sets out as the machine it sets out from is far off, not as the one who fired', () => {
    const DEPTH: Record<string, number> = { player: 0, 'enemy-0': 0.5, 'enemy-1': 1 };
    const deep = new BattleFx({ ...scene(), depth: (unit) => DEPTH[unit] });
    deep.onEvent(leap);
    deep.update(20);
    expect(deep.flights()[0].grow).toEqual([sizeAt(0.5), sizeAt(1)]);
    expect(sizeAt(0.5)).not.toBe(sizeAt(0));
  });

  test('is not fired: nothing flashes at the barrel and the one who fired does not kick back', () => {
    const fired = after(shot());
    expect(fired.kinds()).toEqual(expect.arrayContaining(['muzzle', 'recoil', 'projectile']));
    expect(fired.transform('player').dx).not.toBe(0);
    const leapt = after(leap);
    expect(leapt.kinds()).toContain('projectile');
    expect(leapt.kinds()).not.toContain('muzzle');
    expect(leapt.kinds()).not.toContain('recoil');
    expect(leapt.transform('player').dx).toBe(0);
  });

  test('lands like any hit: the second machine is struck and the figure is written over it', () => {
    const fx = after(leap, undefined, PROJECTILE_MS + 20);
    expect(fx.transform('enemy-1').flash).toBe(true);
    expect(fx.transform('enemy-0').flash).toBe(false);
    expect(fx.texts()).toEqual(['-15']);
  });
});

describe('the word for what a weapon\'s kind made of a hit', () => {
  afterEach(() => setLanguage('en'));
  const words = (event: BattleEvent, kind?: Weapon['trait'], ms = PROJECTILE_MS + 20): string[] => after(event, kind, ms).texts();

  test('a redline fired warm: what the heat added, over the one who fired, at once', () => {
    expect(words(shot({ lift: 148 }), 'redline', 20)).toEqual(['REDLINE +48%']);
    expect(words(shot({ lift: 148 }), 'redline').sort()).toEqual(['-30', 'REDLINE +48%']);
  });

  test('a surge: how many times what it is listed at, to a tenth', () => {
    expect(words(shot({ lift: 340 }), 'surge', 20)).toEqual(['SURGE x3.4']);
    expect(words(shot({ lift: 80 }), 'surge', 20)).toEqual(['SURGE x0.8']);
    expect(words(shot({ lift: 200 }), 'surge', 20)).toEqual(['SURGE x2.0']);
  });

  test('a punish on a reeling machine: the word over that machine, when the hit lands', () => {
    expect(words(shot({ lift: 200 }), 'punish', 20)).toEqual([]);
    expect(words(shot({ lift: 200 }), 'punish')).toEqual(['-30', 'PUNISH']);
  });

  test('nothing where the kind made nothing of it, where the shot missed, or where the scene does not say what the weapon is', () => {
    expect(words(shot(), 'redline')).toEqual(['-30']);
    expect(words(shot({ hit: false, damage: 0 }), 'redline')).toEqual(['MISS']);
    expect(words(shot({ lift: 148 }))).toEqual(['-30']);
    // A weapon of another kind says nothing of a number it should not have.
    expect(words(shot({ lift: 148 }), 'pierce')).toEqual(['-30']);
  });

  test('in Dutch', () => {
    setLanguage('nl');
    expect(words(shot({ lift: 148 }), 'redline', 20)).toEqual(['WITHEET +48%']);
    expect(words(shot({ lift: 340 }), 'surge', 20)).toEqual(['PIEK x3.4']);
    expect(words(shot({ lift: 200 }), 'punish')).toEqual(['-30', 'STRAF']);
  });

  test('a redline\'s word and a surge\'s are over the one who fired, each in the colour of what it is made of', () => {
    const over = { x: AT.player.x, y: AT.player.y - WORD_GAP - 10 };
    expect(after(shot({ lift: 148 }), 'redline').written()).toContainEqual({ text: 'REDLINE +48%', at: over, color: COLORS.heat });
    expect(after(shot({ lift: 340 }), 'surge').written()).toContainEqual({ text: 'SURGE x3.4', at: over, color: COLORS.energy });
  });

  test('a punish\'s word is over the machine it landed on, a line above the figure of the hit so that both can be read', () => {
    const written = after(shot({ lift: 200 }), 'punish', PROJECTILE_MS + 20).written();
    const figure = written.find((word) => word.text === '-30')!;
    expect(figure.at).toEqual({ x: AT['enemy-0'].x, y: AT['enemy-0'].y - 10 });
    expect(written).toContainEqual({ text: 'PUNISH', at: { x: figure.at.x, y: figure.at.y - WORD_GAP }, color: COLORS.accent });
    expect(WORD_GAP).toBeGreaterThanOrEqual(10);
  });
});
