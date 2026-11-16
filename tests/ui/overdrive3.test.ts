import { createBattle, type BattleOptions, type BattleState } from '../../src/core/battle';
import { xpForLevel } from '../../src/core/pilot';
import type { EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { COLORS, charsFor, wrap } from '../../src/ui/widgets';
import { fresh, inHub, snap } from '../helpers/app';
import { overlap, record } from '../helpers/canvas';
import { ALL } from '../helpers/testParts';

/** What the last review of the Overdrive found on the screens. */

const turret = ENEMIES['gun-turret'];
const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const battle = (enemies: EnemyDef[], opts: BattleOptions = {}): BattleState => createBattle(DEMO_BUILD, enemies, ALL, 1, opts);
function settle(flow: BattleFlow): BattleFlow {
  let guard = 0;
  while (flow.phase === 'animating' && guard++ < 800) flow.advance();
  return flow;
}
const flowOf = (state: BattleState) => settle(new BattleFlow(state, ALL, {}));
const row = (flow: BattleFlow) => flow.menu.items[flow.menu.cursor];

describe('the cursor after an Overdrive', () => {
  test('after a Second Wind it is on the first thing that can be done again, not left on the row that ends the turn', () => {
    const flow = flowOf(battle([ENEMIES['heavy-mech']], { overdrive: 'second-wind', drive: 100 }));
    expect(row(flow).id).toBe('fire');
    // The turn is fired empty: A, A, A fires the first weapon that still can.
    for (let i = 0; i < 12 && row(flow).id === 'fire' && row(flow).enabled; i++) {
      flow.onInput('confirm');
      flow.onInput('confirm');
      flow.onInput('confirm');
      settle(flow);
    }
    expect(flow.phase).toBe('action');
    const fire = flow.menu.items.find((item) => item.id === 'fire')!;
    expect(fire.enabled).toBe(false);
    // The cursor has gone to the first row that can still be chosen, which is no shot.
    expect(row(flow).id).not.toBe('fire');
    const spent = flow.state.units[0].energy;
    expect(flow.overdrive).toBe('ready');
    flow.onInput('next');
    settle(flow);
    expect(flow.state.units[0].energy).toBeGreaterThan(spent);
    expect(row(flow)).toMatchObject({ id: 'fire', enabled: true });
    // So the press that follows goes on with the turn that was given back, and does not end it.
    const round = flow.state.round;
    flow.onInput('confirm');
    expect(flow.phase).toBe('weapon');
    expect(flow.state.round).toBe(round);
  });

  test.each(['iron-skin', 'deadeye'] as const)('after %s it stays on the row it was on: nothing about the turn has changed', (kind) => {
    const flow = flowOf(battle([turret], { overdrive: kind, drive: 100 }));
    flow.onInput('down');
    flow.onInput('down');
    const at = row(flow).id;
    expect(at).toBe('guard');
    flow.onInput('next');
    settle(flow);
    expect(row(flow).id).toBe(at);
  });
});

describe('the word about a Second Wind with nothing spent', () => {
  test('is gone as soon as the pilot does anything else: it does not hang over the list of weapons', () => {
    const flow = flowOf(battle([turret], { overdrive: 'second-wind', drive: 100 }));
    const usual = STRINGS.yourTurn(flow.state.round);
    flow.onInput('next');
    expect(flow.message).toBe(STRINGS.overdrive.spendFirst);
    // Moving the cursor takes it away,
    flow.onInput('down');
    expect(flow.message).toBe(usual);
    flow.onInput('up');
    flow.onInput('next');
    expect(flow.message).toBe(STRINGS.overdrive.spendFirst);
    // and so does opening a list.
    flow.onInput('confirm');
    expect(flow.phase).toBe('weapon');
    expect(flow.message).toBe(usual);
    flow.onInput('cancel');
    expect(flow.message).toBe(usual);
  });
});

describe('the right end of the message bar', () => {
  function bar(opts: { drive: number; kind?: 'second-wind' | 'iron-skin'; label?: string }) {
    const flow = new BattleFlow(battle([turret], { overdrive: opts.kind ?? 'iron-skin', drive: opts.drive }), ALL, { quiet: true });
    const screen = new BattleScreen(flow, sprites, ALL, { fast: true, ...(opts.label ? { label: opts.label } : {}) });
    for (let i = 0; i < 50 && flow.phase !== 'action'; i++) screen.update(16);
    expect(flow.phase).toBe('action');
    const { texts } = record((ctx) => screen.draw(ctx));
    return { flow, top: texts.filter((t) => t.y === 1) };
  }
  const LABEL = 'ENGAGEMENT 2/3';

  test('says R1: OVERDRIVE at the right edge, clear of the message, when the meter is full', () => {
    const { flow, top } = bar({ drive: 100 });
    const message = top.find((t) => t.text === flow.message)!;
    const r1 = top.find((t) => t.text === STRINGS.overdrive.ready)!;
    expect(message.left).toBe(5);
    expect(r1.align).toBe('right');
    expect(r1.right).toBe(305);
    expect(overlap(message, r1)).toBe(false);
    // Lit when the press would count.
    expect(r1.color).toBe('#ffffff');
  });

  test('stands dim while a Second Wind is still waiting for something of the turn to be spent', () => {
    const { flow, top } = bar({ drive: 100, kind: 'second-wind' });
    expect(flow.overdrive).toBe('wait');
    expect(top.find((t) => t.text === STRINGS.overdrive.ready)!.color).toBe(COLORS.dim);
  });

  test('which battle of the contract this is makes way for it: the two are never written on top of each other', () => {
    const full = bar({ drive: 100, label: LABEL });
    expect(full.top.map((t) => t.text)).toContain(STRINGS.overdrive.ready);
    expect(full.top.map((t) => t.text)).not.toContain(LABEL);
    // With the meter short of full the label has its place back.
    const short = bar({ drive: 40, label: LABEL });
    expect(short.top.map((t) => t.text)).not.toContain(STRINGS.overdrive.ready);
    const label = short.top.find((t) => t.text === LABEL)!;
    expect(label.right).toBe(305);
    expect(label.color).toBe(COLORS.dim);
  });
});

describe('an Overdrive that has just opened', () => {
  test('is announced by name under its own heading', () => {
    const { app } = inHub({ ...fresh(), scenes: ['act-1'] });
    for (let i = 0; i < 40 && (snap(app).toast || snap(app).toasts.length > 0); i++) app.update(6000);
    app.commit({ ...app.game!, xp: xpForLevel(3) });
    // Whatever else the level brought is let through until the Overdrive's own notice is up.
    for (let i = 0; i < 40 && snap(app).toast !== 'overdrive:second-wind'; i++) app.update(snap(app).toast ? 6000 : 16);
    expect(snap(app).toast).toBe('overdrive:second-wind');
    const said = record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
    expect(said).toContain(STRINGS.overdrive.opened);
    expect(said).toContain(STRINGS.overdrive.names['second-wind']);
  });
});

describe('what the pilot\'s page says about Second Wind', () => {
  test('is what the rule gives: weapons, the vent and the module again, a stance still up stays, and so does the heat', () => {
    const note = STRINGS.overdrive.notes['second-wind'];
    expect(note).toBe('Spend your turn first, then it starts over: energy back; weapons, Vent and Module ready again. A Boost or Guard still up stays up. So does the heat.');
    // It no longer promises every action: with a stance still up, Boost and Guard are both refused.
    expect(note).not.toMatch(/every weapon and action/);
  });

  test.each(['en', 'nl'] as const)('fits the four lines the page has for it (%s)', (language) => {
    setLanguage(language);
    try {
      for (const note of Object.values(STRINGS.overdrive.notes)) expect(wrap(note, charsFor(310 - 28)).length, note).toBeLessThanOrEqual(4);
      expect(wrap(STRINGS.overdrive.notes['second-wind'], charsFor(310 - 28)).length).toBe(3);
    } finally {
      setLanguage('en');
    }
  });
});
