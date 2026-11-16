import { HELPED, LATE_MS, LATE_SHARE, PAUSE_MS, Pace, SHORTER, SLOW_WINDOWS, WARM_UP, WINDOW } from '../../src/ui/pace';

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
/** A window of frames of which this share is late. */
const window = (pace: Pace, late: number): boolean => {
  let stepped = false;
  const slow = Math.round(WINDOW * late);
  for (let i = 0; i < WINDOW; i++) stepped = pace.frame(i < slow ? 34 : 16.7) || stepped;
  return stepped;
};

describe('keeping pace', () => {
  test('the measures it is judged by', () => {
    expect(WINDOW).toBe(90);
    expect(LATE_MS).toBe(25);
    expect(LATE_SHARE).toBe(0.2);
    expect(SLOW_WINDOWS).toBe(3);
    expect(PAUSE_MS).toBe(250);
    expect(WARM_UP).toBe(120);
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
    expect(run(pace, WINDOW * 2, 50)).toBe(false);
    expect(pace.level).toBe(2);
    // The frame the third slow window ends in is the one it steps down in, and it says so.
    expect(run(pace, WINDOW - 1, 50)).toBe(false);
    expect(pace.frame(50)).toBe(true);
    expect(pace.level).toBe(1);
    // Better, but still slow: the count starts over, and after three more windows it gives up the rest.
    expect(run(pace, WINDOW * 3 - 1, 34)).toBe(false);
    expect(pace.level).toBe(1);
    expect(pace.frame(34)).toBe(true);
    expect(pace.level).toBe(0);
    // Without any light it keeps up, and that is where it stays.
    expect(run(pace, WINDOW * 30, 16.7)).toBe(false);
    expect(pace.level).toBe(0);
    // There is nothing left to give up: slow again later, and nothing happens but that it stops looking.
    expect(pace.judging).toBe(true);
    expect(run(pace, WINDOW * 30, 34)).toBe(false);
    expect([pace.level, pace.judging]).toEqual([0, false]);
  });

  test('what was given up is not taken back in the same session, however well things go afterwards', () => {
    const pace = warm();
    run(pace, WINDOW * 3, 34);
    expect(pace.level).toBe(1);
    expect(run(pace, 60 * 60 * 5, 16.7)).toBe(false);
    expect(pace.level).toBe(1);
  });

  test('a window is slow when more than a fifth of its frames are late', () => {
    for (const [late, slow] of [[0, false], [0.1, false], [0.2, false], [0.23, true], [0.5, true], [1, true]] as [number, boolean][]) {
      const pace = warm();
      for (let n = 0; n < SLOW_WINDOWS; n++) window(pace, late);
      expect(pace.level, `${late} late`).toBe(slow ? 1 : 2);
    }
    // A frame is late from 25 ms on: 24 is on time.
    const near = warm();
    run(near, WINDOW * 5, 24.9);
    expect(near.level).toBe(2);
    const over = warm();
    run(over, WINDOW * 3, 25.1);
    expect(over.level).toBe(1);
  });

  test('the slow windows have to follow each other: a good one in between and the count starts again', () => {
    const pace = warm();
    for (let n = 0; n < 12; n++) {
      window(pace, 1);
      window(pace, 1);
      window(pace, 0);
    }
    expect(pace.level).toBe(2);
    window(pace, 1);
    window(pace, 1);
    expect(pace.level).toBe(2);
    window(pace, 1);
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
    run(pace, WINDOW * 2 + 60, 34);
    pace.frame(PAUSE_MS + 1);
    run(pace, 30, 34);
    expect(pace.level).toBe(2);
    // The pause also broke the run of slow windows: it takes three whole ones again, counted from the pause.
    run(pace, 60, 34);
    run(pace, WINDOW * 2 - 1, 34);
    expect(pace.level).toBe(2);
    expect(pace.frame(34)).toBe(true);
    // A gap of exactly the limit is a very late frame, not a pause.
    const edge = warm();
    run(edge, WINDOW * 3, PAUSE_MS);
    expect(edge.level).toBe(1);
  });

  test('the first two seconds of a session are not judged: everything is still being got ready', () => {
    const pace = new Pace();
    run(pace, WARM_UP, 90);
    expect(pace.level).toBe(2);
    // From then on they are.
    run(pace, WINDOW * 3 - 1, 34);
    expect(pace.level).toBe(2);
    pace.frame(34);
    expect(pace.level).toBe(1);
  });

  test('a session can start where the last one ended', () => {
    expect(new Pace(1).level).toBe(1);
    expect(new Pace(0).level).toBe(0);
    const pace = warm(1);
    run(pace, WINDOW * 3, 34);
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
    run(pace, WINDOW * 2 + 80, 34);
    pace.frame(34, false);
    run(pace, WINDOW * 3 - 1, 34);
    expect(pace.level).toBe(2);
    expect(pace.frame(34)).toBe(true);
    expect(pace.level).toBe(1);
  });

  test('a clock that stands still or runs backwards is not a frame at all', () => {
    const pace = warm();
    for (let i = 0; i < 5000; i++) { pace.frame(0); pace.frame(-16); pace.frame(Number.NaN); }
    expect(pace.level).toBe(2);
    run(pace, WINDOW * 3, 34);
    expect(pace.level).toBe(1);
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
    run(pace, WINDOW * 3, 33.3);
    expect(pace.level).toBe(1);
    run(pace, WINDOW * 3, 33.3);
    expect(pace.level).toBe(0);
    // Three windows without any light and nothing is different: the light was not what it is slow at.
    expect(run(pace, WINDOW * 3 - 1, 33.3)).toBe(false);
    expect([pace.level, pace.judging]).toEqual([0, true]);
    expect(pace.frame(33.3)).toBe(true);
    expect([pace.level, pace.judging]).toEqual([2, false]);
    // And that was the last of it: no going back and forth.
    expect(run(pace, WINDOW * 60, 33.3)).toBe(false);
    expect(pace.level).toBe(2);
  });

  test('one that is still slow without light, but less so, keeps what it gained', () => {
    // Frames a third shorter (twenty a second became thirty), though every one of them is still late.
    const shorter = warm();
    run(shorter, WINDOW * 6, 50);
    expect(shorter.level).toBe(0);
    expect(run(shorter, WINDOW * 3, 33.3)).toBe(false);
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
    for (const [after, back] of [[43, true], [42, false]] as [number, boolean][]) {
      const pace = warm();
      run(pace, WINDOW * 6, 50);
      expect(pace.level).toBe(0);
      expect([run(pace, WINDOW * 3, after), pace.level, pace.judging], `${after} ms`).toEqual([back, back ? 2 : 0, false]);
    }
  });

  test('it goes back to where it came down from, which is not always all of the light', () => {
    // A session that started with less light.
    const started = warm(1);
    run(started, WINDOW * 3, 33.3);
    expect(started.level).toBe(0);
    expect(run(started, WINDOW * 3, 33.3)).toBe(true);
    expect([started.level, started.judging]).toEqual([1, false]);
    // One that came down a step, kept up there for a while, and came down again later for something else.
    const later = warm();
    run(later, WINDOW * 3, 50);
    expect(later.level).toBe(1);
    run(later, WINDOW * 40, 16.7);
    run(later, WINDOW * 3, 33.3);
    expect(later.level).toBe(0);
    expect(run(later, WINDOW * 3, 33.3)).toBe(true);
    expect([later.level, later.judging]).toEqual([1, false]);
  });

  test('a single window in which it kept up, and what it gave up stays given up', () => {
    const pace = warm();
    run(pace, WINDOW * 6, 33.3);
    expect(pace.level).toBe(0);
    window(pace, 1);
    window(pace, 0);
    // Slow again afterwards: there is nothing to compare with any more, and nothing left to give up.
    expect(run(pace, WINDOW * 9, 33.3)).toBe(false);
    expect([pace.level, pace.judging]).toEqual([0, false]);
  });

  test('a pause while it is looking at what it gained: the look starts over, with what it came down from kept in mind', () => {
    const pace = warm();
    run(pace, WINDOW * 6, 33.3);
    expect(pace.level).toBe(0);
    run(pace, WINDOW * 2 + 60, 33.3);
    pace.frame(5000);
    expect(run(pace, WINDOW * 3 - 1, 33.3)).toBe(false);
    expect(pace.level).toBe(0);
    expect(pace.frame(33.3)).toBe(true);
    expect([pace.level, pace.judging]).toEqual([2, false]);
  });
});
