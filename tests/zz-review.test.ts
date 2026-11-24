// REVIEW PROBE: to be removed. Not part of the suite.
import type { Mission } from '../src/core/campaign';
import type { Settlement } from '../src/core/economy';
import type { GameState } from '../src/core/game';
import { bondFor } from '../src/core/stakes';
import { TERMS_WAIT_MS } from '../src/ui/briefingScreen';
import type { App } from '../src/ui/app';
import { JUGGERNAUT, done, finishMission, inHub, makeApp, press, retreat, savedGame, select, snap, strong } from './helpers/app';

const pilot = (more: Partial<GameState> = {}): GameState => ({
  ...strong(done('intro-1', 'intro-2')), scenes: ['act-1', 'talk-kite'], choices: { kite: 'pass' }, battlesWon: 33, credits: 60_000, ...more,
});
const open = (app: App): Mission[] => app.missions().filter((mission) => mission.id.startsWith('open-'));
const light = (app: App): Mission => open(app)[0];
const bill = (app: App): Settlement & { won: boolean } => snap(app).settlement as unknown as Settlement;
interface Briefed { mission: string; reward: number; terms: { level: number; fee: number; bond: number; held: boolean; waiting: boolean } | null; odds: { played: number; won: number; done: boolean } | null; near: string | null; wingman: { id: string | null } | null; build: { slot: number | null } | null }
const brief = (app: App): Briefed => snap(app).briefing as unknown as Briefed;
const toRow = (app: App, id: string): void => {
  for (let i = 0; i < 8 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
};
function reading(saved: GameState, pick: (app: App) => string): App {
  const { app } = makeApp(saved, undefined, { fast: false });
  press(app, 'confirm');
  for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { app.update(600); press(app, 'confirm'); }
  expect(snap(app).screen).toBe('hub');
  const id = pick(app);
  select(app, 'contracts');
  select(app, id);
  expect(snap(app).screen).toBe('briefing');
  return app;
}

describe('REVIEW PROBES', () => {
  test('A: the wait is not begun again when the wingman is turned on raised terms', () => {
    const app = reading(pilot(), (a) => open(a)[2].id);
    toRow(app, 'terms');
    press(app, 'right', 'right'); // Severe
    expect(brief(app).terms).toMatchObject({ level: 2, waiting: true });
    // A slow machine: a second a frame, one go of the count a frame.
    let frames = 0;
    while (brief(app).terms!.waiting && frames < 100) { app.update(1000); frames += 1; }
    console.log('A: frames of 1000 ms until Accept is taken on Severe:', frames, 'odds', JSON.stringify(brief(app).odds));
    // The valve has opened (or the count is done). Now another wingman: a count of its own, from nothing.
    toRow(app, 'wingman');
    press(app, 'right');
    console.log('A: after turning the wingman:', JSON.stringify({ wingman: brief(app).wingman, odds: brief(app).odds, terms: brief(app).terms, accept: snap(app).menu.items[0] }));
    toRow(app, 'accept');
    press(app, 'confirm');
    console.log('A: screen after A on Accept:', snap(app).screen, 'atStake', app.game!.atStake);
  });

  test('A2: at sixty frames a second: how long each count takes with one go a frame, and the wait adds up over builds', () => {
    const saved = pilot({ loadouts: [{ ...JUGGERNAUT, rightHand: 'wpn-pulse-carbine', leftHand: 'wpn-lance-emitter' }, null, null, null, null, null, null] });
    const app = reading(saved, (a) => open(a)[2].id);
    toRow(app, 'terms');
    press(app, 'right', 'right', 'right'); // Ruinous
    const screen = (app as unknown as { current: { waited: number } }).current;
    let frames = 0;
    while (brief(app).terms!.waiting && frames < 100000) { app.update(16); frames += 1; }
    console.log('A2: frames of 16 ms until Ruinous counted on the floor build:', frames, 'waited', screen.waited, JSON.stringify(brief(app).odds));
    const rows = snap(app).menu.items.map((item) => item.id);
    console.log('A2: rows', rows.join(','));
    if (rows.includes('build')) {
      toRow(app, 'build');
      press(app, 'right');
      console.log('A2: after turning the build:', JSON.stringify({ build: brief(app).build, odds: brief(app).odds, waiting: brief(app).terms!.waiting, waited: screen.waited }));
      frames = 0;
      while (brief(app).terms!.waiting && frames < 100000) { app.update(16); frames += 1; }
      console.log('A2: frames until Accept is taken on the second build:', frames, 'waited', screen.waited, JSON.stringify(brief(app).odds), 'limit', TERMS_WAIT_MS);
    }
  });

  test('B: a wingman whose share changes whether the bond is held', () => {
    const probe = inHub(pilot());
    const row = light(probe.app);
    const [wingman] = probe.app.wingmen(row);
    const withWing = probe.app.stakes(row, wingman.id)[3].bond;
    const alone = probe.app.stakes(row, null)[3].bond;
    console.log('B: bonds at Ruinous: alone', alone, 'with', wingman.id, withWing);
    // Holds the bond with the wingman, not alone.
    const { app, store } = inHub(pilot({ credits: withWing }));
    expect(app.stakes(row, null)[3].refusal).toBe('bond');
    expect(app.stakes(row, wingman.id)[3].refusal).toBeNull();
    select(app, 'contracts');
    select(app, row.id);
    toRow(app, 'terms');
    press(app, 'left'); // Ruinous, round the other way
    console.log('B: alone:', JSON.stringify({ terms: brief(app).terms, accept: snap(app).menu.items[0] }));
    toRow(app, 'wingman');
    press(app, 'right');
    console.log('B: with wingman:', JSON.stringify({ terms: brief(app).terms, accept: snap(app).menu.items[0], reward: brief(app).reward }));
    toRow(app, 'accept');
    press(app, 'confirm');
    console.log('B: screen', snap(app).screen, 'atStake', savedGame(store).atStake, 'scale', snap(app).battle?.enemyScale);
    // And asked for alone, by the app's own way in, it is flown at Standard.
    const other = inHub(pilot({ credits: withWing }));
    other.app.startMission(row.id, false, null, false, null, 3);
    console.log('B: alone by startMission: atStake', savedGame(other.store).atStake, 'scale', snap(other.app).battle?.enemyScale);
  });

  test('C: a haggler: what the briefing says it pays and what the bill pays', () => {
    const { app, store } = inHub(pilot({ perks: { haggler: 3 }, battlesWon: 5 }));
    const row = light(app);
    select(app, 'contracts');
    select(app, row.id);
    toRow(app, 'terms');
    press(app, 'right', 'right');
    const pays = brief(app).reward;
    const before = savedGame(store);
    toRow(app, 'accept');
    press(app, 'confirm');
    finishMission(app);
    const settled = bill(app);
    const after = savedGame(store);
    console.log('C: fee', row.reward, 'briefing PAYS', pays, 'bill reward', settled.reward, 'hazard', JSON.stringify(settled.hazard), 'bonus', settled.bonus, 'net', settled.net,
      'earned stat +', after.stats.earned - before.stats.earned, 'credits +', after.credits - before.credits, 'medals', after.medals.filter((id) => !before.medals.includes(id)).join(','));
  });

  test('D: lost with the bond exactly held: the debt limit and the bill', () => {
    const probe = inHub(pilot());
    const row = light(probe.app);
    const bond = bondFor(row.reward, 3);
    const { app, store } = inHub(pilot({ credits: bond, medals: ['stake-1'] }));
    const before = savedGame(store);
    app.startMission(row.id, false, null, false, null, 3);
    retreat(app);
    const settled = bill(app);
    const after = savedGame(store);
    console.log('D: credits', before.credits, '->', after.credits, 'net', settled.net, 'relief', (settled as { relief?: number }).relief, 'bond', JSON.stringify(settled.bond), 'medals', after.medals.filter((id) => !before.medals.includes(id)).join(','));
  });
});
