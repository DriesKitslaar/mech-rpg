import { TOAST_MS } from '../../src/ui/app';
import { accept, done, finishMission, inHub, press, select, snap, strong } from '../helpers/app';
import { record } from '../helpers/canvas';

/**
 * Where an announcement (a medal, a name, new pages in the database) is shown. It is a strip at the
 * foot of the screen, and on most screens the foot holds something: a line of button hints, the last
 * row of figures, the last line of a text. There it waits, and is shown where the foot is free.
 */

type AppOf = ReturnType<typeof inHub>['app'];
/** A pilot past the introductions who has just come into the hub: something is announced there. */
const arrived = () => {
  const made = inHub(strong(done('intro-1', 'intro-2')));
  made.app.update(16);
  const due = snap(made.app).toast;
  expect(due).not.toBeNull();
  return { ...made, due: due! };
};
/** What is written in the strip of the screen an announcement takes. */
const foot = (app: AppOf): string[] => record((ctx) => app.draw(ctx)).texts.filter((t) => t.y >= 238).map((t) => t.text);

describe('an announcement', () => {
  test('is shown in the hub, at the foot of the screen, for as long as it is up', () => {
    const { app, due } = arrived();
    const shown = foot(app);
    // Its small heading and what it announces.
    expect(shown.length).toBeGreaterThanOrEqual(2);
    app.update(TOAST_MS / 2);
    expect(snap(app).toast).toBe(due);
    expect(foot(app)).toEqual(shown);
  });

  test.each(['garage', 'shop', 'pilot', 'messages', 'database', 'training', 'arena', 'gauntlet'])(
    'waits while the pilot is in the %s, where it would lie over what is written at the foot, and is shown again in the hub', (room) => {
      const { app, due } = arrived();
      const shown = foot(app);
      select(app, room);
      expect(snap(app).screen).toBe(room);
      app.update(16);
      // It has stepped aside, to the head of what is waiting.
      expect(snap(app).toast).toBeNull();
      expect(snap(app).toasts[0]).toBe(due);
      // However long the pilot stays there it is neither shown nor lost, and nothing of it is drawn.
      app.update(TOAST_MS * 3);
      expect(snap(app).toast).toBeNull();
      expect(snap(app).toasts[0]).toBe(due);
      for (const text of shown) expect(foot(app), text).not.toContain(text);
      press(app, 'cancel');
      expect(snap(app).screen).toBe('hub');
      app.update(16);
      expect(snap(app).toast).toBe(due);
      expect(foot(app)).toEqual(shown);
    },
  );

  test('waits on a briefing, where it would lie over what the contract is expected to bring', () => {
    const { app, due } = arrived();
    const shown = foot(app);
    select(app, 'contracts');
    select(app, 'patrol');
    expect(snap(app).screen).toBe('briefing');
    app.update(16);
    expect(snap(app).toast).toBeNull();
    expect(snap(app).toasts[0]).toBe(due);
    for (const text of shown) expect(foot(app), text).not.toContain(text);
    // Back at the list of contracts, which is the hub's: there it is shown.
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
    app.update(16);
    expect(snap(app).toast).toBe(due);
  });

  test('is shown in the options, whose panel leaves the foot free', () => {
    const { app, due } = arrived();
    select(app, 'options');
    expect(snap(app).screen).toBe('options');
    app.update(16);
    expect(snap(app).toast).toBe(due);
  });

  test('is shown on a settlement: what a contract earned is said with its bill', () => {
    const { app, due } = arrived();
    accept(app, 'patrol');
    app.update(16);
    expect(snap(app)).toMatchObject({ screen: 'battle', toast: null });
    finishMission(app);
    app.update(16);
    expect(snap(app).screen).toBe('settlement');
    expect(snap(app).toast).toBe(due);
  });

  test('that is waiting is not used up by the wait: each one still gets its full time once there is room', () => {
    const { app, due } = arrived();
    select(app, 'garage');
    app.update(TOAST_MS * 2);
    press(app, 'cancel');
    app.update(16);
    expect(snap(app).toast).toBe(due);
    // Nearly its whole time later it is still up; a moment after that it has gone.
    app.update(TOAST_MS - 100);
    expect(snap(app).toast).toBe(due);
    app.update(200);
    expect(snap(app).toast).not.toBe(due);
  });
});
