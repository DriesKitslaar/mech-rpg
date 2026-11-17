import { HELPED, LATE_MS, LATE_SHARE, PAUSE_MS, Pace, SHORTER, SLOW_WINDOWS, WARM_UP, WARM_UP_MS, WINDOW, WINDOW_MS } from '../../src/ui/pace';

/** How well the handheld keeps up, judged from the time between frames, and what is done about it. */

const run = (pace: Pace, frames: number, gap: number): boolean => {
  let stepped = false;
  for (let i = 0; i < frames; i++) stepped = pace.frame(gap) || stepped;
  return stepped;
};
/** A pace that is past the first frames of a session, which are never judged. */
const warm = (start?: 0 | 1 | 2): Pace => {
  const pace = new Pace(start);
  run(pace, WARM_UP, 16.7);
  return pace;
};
/** How many frames of this length a window is: ninety, or as many as a second and a half holds. */
const fill = (gap: number): number => Math.min(WINDOW, Math.ceil(WINDOW_MS / gap));
/** So many whole windows of frames that all take this long. */
const windows = (pace: Pace, count: number, gap: number): boolean => run(pace, fill(gap) * count, gap);
/**
 * A window of ninety frames of which this share is late, as a screen that shows a hundred and
 * twenty a second has them: its frames are short enough for half of them to be late (25 ms) and
 * the ninety still to be over within the second and a half.
 */
const window = (pace: Pace, late: number): boolean => {
  let stepped = false;
  const slow = Math.round(WINDOW * late);
  expect(slow * 25 + (WINDOW - slow) * 8).toBeLessThan(WINDOW_MS);
  for (let i = 0; i < WINDOW; i++) stepped = pace.frame(i < slow ? 25 : 8) || stepped;
  return stepped;
};

describe('keeping pace', () => {
  test('the measures it is judged by', () => {
    expect([WINDOW, WINDOW_MS]).toEqual([90, 1500]);
    expect(LATE_MS).toBe(25);
    expect(LATE_SHARE).toBe(0.2);
    expect(SLOW_WINDOWS).toBe(3);
    expect(PAUSE_MS).toBe(250);
    expect([WARM_UP, WARM_UP_MS]).toEqual([120, 2000]);
    expect([HELPED, SHORTER]).toEqual([0.75, 0.85]);
  });

  test('a handheld that keeps up has all of its light, for as long as it is on', () => {
    const pace = new Pace();
    expect(pace.level).toBe(2);
    expect(run(pace, 60 * 60 * 10, 16.7)).toBe(false);
    expect(pace.level).toBe(2);
    // Twice as many frames a second, or frames that are a little uneven: all the same.
    expect(run(pace, 2000, 8.3)).toBe(false);
    for (let i = 0; i < 2000; i++) pace.frame(i % 2 ? 15 : 18.5);
    expect(pace.level).toBe(2);
  });

  test('one that does not keep up gives light up, a step at a time, after three windows in a row', () => {
    const pace = warm();
    // Twenty frames a second: a window is a second and a half of them, thirty frames.
    expect(run(pace, 30 * 2, 50)).toBe(false);
    expect(pace.level).toBe(2);
    // The frame the third slow window ends in is the one it steps down in, and it says so.
    expect(run(pace, 30 - 1, 50)).toBe(false);
    expect(pace.frame(50)).toBe(true);
    expect(pace.level).toBe(1);
    // Better, but still slow (forty-five frames to a window now): the count starts over, and after three more windows it gives up the rest.
    expect(run(pace, 45 * 3 - 1, 34)).toBe(false);
    expect(pace.level).toBe(1);
    expect(pace.frame(34)).toBe(true);
    expect(pace.level).toBe(0);
    // Without any light it keeps up, and that is where it stays.
    expect(run(pace, WINDOW * 30, 16.7)).toBe(false);
    expect(pace.level).toBe(0);
    // There is nothing left to give up: slow again later, and nothing happens but that it stops looking.
    expect(pace.judging).toBe(true);
    expect(windows(pace, 30, 34)).toBe(false);
    expect([pace.level, pace.judging]).toEqual([0, false]);
  });

  test('a slow handheld is not kept waiting for being slow: a window is ninety frames or a second and a half, whichever is over first', () => {
    // However long its frames take, it gives a step up in the frame its third window ends in: four and a half seconds, about.
    for (const [gap, frames] of [[25, 180], [34, 135], [50, 90], [100, 45], [250, 18]] as [number, number][]) {
      const pace = warm();
      expect(run(pace, frames - 1, gap), `${gap} ms`).toBe(false);
      expect(pace.frame(gap), `${gap} ms`).toBe(true);
      expect(frames * gap, `${gap} ms`).toBeLessThanOrEqual(SLOW_WINDOWS * (WINDOW_MS + gap));
    }
    // Where frames come faster than sixty a second a window is ninety of them, though it lasts less than the second and a half.
    const quick = warm();
    window(quick, 0.5);
    window(quick, 0.5);
    let stepped = false;
    for (let i = 0; i < WINDOW - 1; i++) stepped = quick.frame(i < 45 ? 25 : 8) || stepped;
    expect([stepped, quick.level]).toEqual([false, 2]);
    expect(quick.frame(8)).toBe(true);
    expect(quick.level).toBe(1);
  });

  test('what was given up is not taken back in the same session, however well things go afterwards', () => {
    const pace = warm();
    windows(pace, 3, 34);
    expect(pace.level).toBe(1);
    expect(run(pace, 60 * 60 * 5, 16.7)).toBe(false);
    expect(pace.level).toBe(1);
  });

  test('a window is slow when more than a fifth of its frames are late', () => {
    for (const [late, slow] of [[0, false], [0.1, false], [0.2, false], [19 / 90, true], [0.23, true], [0.5, true]] as [number, boolean][]) {
      const pace = warm();
      for (let n = 0; n < SLOW_WINDOWS; n++) window(pace, late);
      expect(pace.level, `${late} late`).toBe(slow ? 1 : 2);
    }
    // A frame is late from 25 ms on: 24.9 is on time.
    const near = warm();
    run(near, WINDOW * 5, 24.9);
    expect(near.level).toBe(2);
    const over = warm();
    windows(over, 3, 25.1);
    expect(over.level).toBe(1);
    // And one of exactly 25 is late.
    const exactly = warm();
    windows(exactly, 3, LATE_MS);
    expect(exactly.level).toBe(1);
  });

  test('the fifth is of the frames the window had, which are fewer than ninety when they are slow', () => {
    // Ten frames of a tenth of a second and twenty-one that are on time: thirty-one frames in a second and a half, a third of them late.
    const pace = warm();
    const one = (): boolean => {
      let stepped = false;
      for (let i = 0; i < 31; i++) stepped = pace.frame(i < 10 ? 100 : 24) || stepped;
      return stepped;
    };
    expect(one()).toBe(false);
    expect(one()).toBe(false);
    expect(one()).toBe(true);
    expect(pace.level).toBe(1);
  });

  test('the slow windows have to follow each other: a good one in between and the count starts again', () => {
    const pace = warm();
    for (let n = 0; n < 12; n++) {
      windows(pace, 2, 34);
      window(pace, 0);
    }
    expect(pace.level).toBe(2);
    windows(pace, 2, 34);
    expect(pace.level).toBe(2);
    windows(pace, 1, 34);
    expect(pace.level).toBe(1);
  });

  test('a pause is not a slow frame: it is left out, and the window it fell in starts again', () => {
    const pace = warm();
    // An app switch every second, for a minute.
    for (let n = 0; n < 60; n++) {
      run(pace, 59, 16.7);
      expect(pace.frame(2000)).toBe(false);
    }
    expect(pace.level).toBe(2);
    // Two slow windows and most of a third, a pause, and the rest of the third: no step, the third has to be whole.
    run(pace, 45 * 2 + 30, 34);
    pace.frame(PAUSE_MS + 1);
    run(pace, 15, 34);
    expect(pace.level).toBe(2);
    // The pause also broke the run of slow windows: it takes three whole ones again, frames and time both counted from the pause.
    run(pace, 30, 34);
    run(pace, 45 * 2 - 1, 34);
    expect(pace.level).toBe(2);
    expect(pace.frame(34)).toBe(true);
    // A gap of exactly the limit is a very late frame, not a pause.
    const edge = warm();
    windows(edge, 3, PAUSE_MS);
    expect(edge.level).toBe(1);
    // The late frames from before a pause are not counted in the window after it: that one kept up.
    const fresh = warm();
    run(fresh, 30, 34);
    fresh.frame(PAUSE_MS + 1);
    window(fresh, 0);
    windows(fresh, 2, 34);
    expect(fresh.level).toBe(2);
  });

  test('the first two seconds of a session are not judged: everything is still being got ready', () => {
    // Sixty frames a second: a hundred and twenty frames. From then on they are judged.
    const pace = new Pace();
    run(pace, WARM_UP, 16.7);
    expect(run(pace, 45 * 3 - 1, 34)).toBe(false);
    expect(pace.frame(34)).toBe(true);
    // Slow from the first frame on: two seconds of frames go by unjudged, and no more than that.
    for (const [gap, unjudged] of [[34, 59], [50, 40], [90, 23]] as [number, number][]) {
      const slow = new Pace();
      expect(run(slow, unjudged + fill(gap) * 3 - 1, gap), `${gap} ms`).toBe(false);
      expect(slow.frame(gap), `${gap} ms`).toBe(true);
      expect(slow.level).toBe(1);
    }
    // Faster than sixty a second: a hundred and twenty frames all the same, though that is only a second.
    const quick = new Pace();
    run(quick, WARM_UP, 8.3);
    expect(run(quick, 45 * 3 - 1, 34)).toBe(false);
    expect(quick.frame(34)).toBe(true);
  });

  test('a session can start where the last one ended', () => {
    expect(new Pace(1).level).toBe(1);
    expect(new Pace(0).level).toBe(0);
    const pace = warm(1);
    windows(pace, 3, 34);
    expect(pace.level).toBe(0);
    // One that starts without any light has nothing to give up, and one that is told not to judge does not.
    const bare = warm(0);
    expect(bare.judging).toBe(false);
    expect(run(bare, WINDOW * 30, 34)).toBe(false);
    expect(bare.level).toBe(0);
    const held = new Pace(2, false);
    expect(run(held, WARM_UP + WINDOW * 30, 34)).toBe(false);
    expect([held.level, held.judging]).toEqual([2, false]);
    expect(held.fps).toBe(29);
  });

  test('frames it is told not to judge are only counted, and break a run of slow windows as a pause does', () => {
    const pace = warm();
    for (let i = 0; i < WINDOW * 30; i++) expect(pace.frame(34, false)).toBe(false);
    expect(pace.level).toBe(2);
    expect(pace.fps).toBe(29);
    run(pace, 45 * 2 + 40, 34);
    pace.frame(34, false);
    run(pace, 45 * 3 - 1, 34);
    expect(pace.level).toBe(2);
    expect(pace.frame(34)).toBe(true);
    expect(pace.level).toBe(1);
  });

  test('a clock that stands still or runs backwards is not a frame at all', () => {
    const pace = warm();
    for (let i = 0; i < 5000; i++) { pace.frame(0); pace.frame(-16); pace.frame(Number.NaN); }
    expect(pace.level).toBe(2);
    windows(pace, 3, 34);
    expect(pace.level).toBe(1);
    // Mixed in with real frames they change nothing: they fill no window, and they are not counted in the frames a second.
    const mixed = warm();
    for (let i = 0; i < 45 * 2; i++) { mixed.frame(34); mixed.frame(0); mixed.frame(Number.NaN); mixed.frame(-5); }
    expect(mixed.level).toBe(2);
    expect(mixed.fps).toBe(29);
    for (let i = 0; i < 45 - 1; i++) { mixed.frame(34); mixed.frame(0); }
    expect(mixed.level).toBe(2);
    expect(mixed.frame(34)).toBe(true);
  });

  test('how many frames a second it is seeing, for whoever looks', () => {
    const pace = new Pace();
    expect(pace.fps).toBe(0);
    run(pace, 200, 16.7);
    expect(pace.fps).toBe(60);
    run(pace, 200, 33.4);
    expect(pace.fps).toBe(30);
  });
});

describe('giving light up has to help', () => {
  test('a handheld that is slow whatever is drawn gets its light back, once, and is left alone', () => {
    // Thirty frames a second with all of the light and with none: a screen, or a setting, that shows no more.
    const pace = warm();
    windows(pace, 3, 33.3);
    expect(pace.level).toBe(1);
    windows(pace, 3, 33.3);
    expect(pace.level).toBe(0);
    // Three windows without any light and nothing is different: the light was not what it is slow at.
    expect(run(pace, fill(33.3) * 3 - 1, 33.3)).toBe(false);
    expect([pace.level, pace.judging]).toEqual([0, true]);
    expect(pace.frame(33.3)).toBe(true);
    expect([pace.level, pace.judging]).toEqual([2, false]);
    // And that was the last of it: no going back and forth.
    expect(windows(pace, 60, 33.3)).toBe(false);
    expect(pace.level).toBe(2);
  });

  test('one that is still slow without light, but less so, keeps what it gained', () => {
    // Frames a third shorter (twenty a second became thirty), though every one of them is still late.
    const shorter = warm();
    windows(shorter, 6, 50);
    expect(shorter.level).toBe(0);
    expect(windows(shorter, 3, 33.3)).toBe(false);
    expect([shorter.level, shorter.judging]).toEqual([0, false]);
    // Late frames a good deal rarer (one in two became three in ten), though still too many.
    const rarer = warm();
    for (let n = 0; n < 6; n++) window(rarer, 0.5);
    expect(rarer.level).toBe(0);
    for (let n = 0; n < 3; n++) expect(window(rarer, 0.3)).toBe(false);
    expect([rarer.level, rarer.judging]).toEqual([0, false]);
  });

  test('helped is a quarter fewer late frames, or frames more than fifteen in a hundred shorter', () => {
    // Late frames: four in ten before. Three in ten is exactly a quarter fewer, and that is not fewer than a quarter.
    for (const [after, back] of [[0.3, true], [0.29, false]] as [number, boolean][]) {
      const pace = warm();
      for (let n = 0; n < 6; n++) window(pace, 0.4);
      expect(pace.level).toBe(0);
      let stepped = false;
      for (let n = 0; n < 3; n++) stepped = window(pace, after) || stepped;
      expect([stepped, pace.level, pace.judging], `${after} late`).toEqual([back, back ? 2 : 0, false]);
    }
    // Every frame late before and after: from fifty milliseconds to forty-three is not enough, to forty-two is.
    // Forty-two and a half is exactly fifteen in a hundred shorter, and that is not more than fifteen.
    for (const [after, back] of [[43, true], [42.5, true], [42, false]] as [number, boolean][]) {
      const pace = warm();
      windows(pace, 6, 50);
      expect(pace.level).toBe(0);
      expect([windows(pace, 3, after), pace.level, pace.judging], `${after} ms`).toEqual([back, back ? 2 : 0, false]);
    }
  });

  test('fewer is a smaller share of the frames there were, not a smaller number: shorter frames are more frames', () => {
    // Before: every other frame late, fifty frames to a window. After: twenty in fifty-seven, which is
    // rarer by more than a quarter though it is more late frames than three quarters of what there were.
    const pace = warm();
    const before = (): void => { for (let i = 0; i < 50; i++) pace.frame(i % 2 ? 20 : 40); };
    for (let n = 0; n < 6; n++) before();
    expect(pace.level).toBe(0);
    const after = (): boolean => {
      let stepped = false;
      for (let i = 0; i < 57; i++) stepped = pace.frame(i < 20 ? 38 : 20) || stepped;
      return stepped;
    };
    expect([after(), after(), after()]).toEqual([false, false, false]);
    expect([pace.level, pace.judging]).toEqual([0, false]);
    // And the other way about: every other frame late still, but longer ones, so that a window holds
    // half as many (thirteen in twenty-five). Fewer late frames were counted, and they are no rarer.
    const same = warm();
    for (let n = 0; n < 6; n++) for (let i = 0; i < 50; i++) same.frame(i % 2 ? 20 : 40);
    expect(same.level).toBe(0);
    let stepped = false;
    for (let n = 0; n < 3; n++) for (let i = 0; i < 25; i++) stepped = same.frame(i % 2 ? 20 : 100) || stepped;
    expect([stepped, same.level, same.judging]).toEqual([true, 2, false]);
  });

  test('what is held side by side is the whole of each spell, not its last window', () => {
    // Late frames. Before: one in two, one in two, one in four (a hundred and thirteen of them).
    // After: three in ten, which is rarer by more than a quarter than the whole of that, though not than its last window.
    const rarer = warm();
    window(rarer, 0.5);
    window(rarer, 0.5);
    window(rarer, 0.25);
    expect(rarer.level).toBe(1);
    for (let n = 0; n < 3; n++) window(rarer, 0.5);
    expect(rarer.level).toBe(0);
    for (let n = 0; n < 3; n++) expect(window(rarer, 0.3)).toBe(false);
    expect([rarer.level, rarer.judging]).toEqual([0, false]);
    // The time a frame took. Before: two windows of twenty frames a second and one of ninety quick
    // frames, twenty-seven milliseconds a frame over the three. After: every other frame late, twenty-two
    // and a half a frame, which is shorter by more than fifteen in a hundred, and no rarer.
    const shorter = warm();
    windows(shorter, 2, 50);
    window(shorter, 0.25);
    expect(shorter.level).toBe(1);
    windows(shorter, 3, 50);
    expect(shorter.level).toBe(0);
    let stepped = false;
    for (let n = 0; n < 3; n++) for (let i = 0; i < 67; i++) stepped = shorter.frame(i % 2 ? 20 : 25) || stepped;
    expect([stepped, shorter.level, shorter.judging]).toEqual([false, 0, false]);
  });

  test('it goes back to where it came down from, which is not always all of the light', () => {
    // A session that started with less light.
    const started = warm(1);
    windows(started, 3, 33.3);
    expect(started.level).toBe(0);
    expect(windows(started, 3, 33.3)).toBe(true);
    expect([started.level, started.judging]).toEqual([1, false]);
    // One that came down a step, kept up there for a while, and came down again later for something else.
    const later = warm();
    windows(later, 3, 50);
    expect(later.level).toBe(1);
    run(later, WINDOW * 40, 16.7);
    windows(later, 3, 33.3);
    expect(later.level).toBe(0);
    expect(windows(later, 3, 33.3)).toBe(true);
    expect([later.level, later.judging]).toEqual([1, false]);
  });

  test('a single window in which it kept up, and what it gave up stays given up', () => {
    const pace = warm();
    windows(pace, 6, 33.3);
    expect(pace.level).toBe(0);
    windows(pace, 1, 33.3);
    window(pace, 0);
    // Slow again afterwards: there is nothing to compare with any more, and nothing left to give up.
    expect(windows(pace, 9, 33.3)).toBe(false);
    expect([pace.level, pace.judging]).toEqual([0, false]);
  });

  test('a pause while it is looking at what it gained: the look starts over, with what it came down from kept in mind', () => {
    const pace = warm();
    windows(pace, 6, 33.3);
    expect(pace.level).toBe(0);
    run(pace, fill(33.3) * 2 + 30, 33.3);
    pace.frame(5000);
    expect(run(pace, fill(33.3) * 3 - 1, 33.3)).toBe(false);
    expect(pace.level).toBe(0);
    expect(pace.frame(33.3)).toBe(true);
    expect([pace.level, pace.judging]).toEqual([2, false]);
  });
});
