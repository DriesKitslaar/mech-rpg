import { MAX_PARTICLES, Particles } from '../../src/ui/particles';

const at = { x: 100, y: 100 };

test('nothing is in the air until something is emitted, and what is emitted dies out', () => {
  const p = new Particles(1);
  expect(p.count).toBe(0);
  p.emit('sparks', at, 1);
  p.update(1);
  expect(p.count).toBeGreaterThanOrEqual(6);
  for (let i = 0; i < 200; i++) p.update(16);
  expect(p.count).toBe(0);
});

test('a delayed burst waits its turn', () => {
  const p = new Particles(1);
  p.emit('debris', at, 1, 200);
  p.update(100);
  expect(p.count).toBe(0);
  p.update(120);
  expect(p.count).toBeGreaterThanOrEqual(10);
});

test('a casing is thrown up and back from the gun, falls, and comes to rest on the ground', () => {
  const p = new Particles(3);
  p.emit('casing', at, 1, 0, 140);
  p.update(1);
  const [casing] = p.all();
  expect(casing.vx).toBeLessThan(0);
  expect(casing.vy).toBeLessThan(0);
  let lowest = 0;
  for (let i = 0; i < 60 && p.count > 0; i++) { p.update(16); if (p.count > 0) lowest = Math.max(lowest, p.all()[0].y); }
  expect(lowest).toBeLessThanOrEqual(140);
  expect(lowest).toBeGreaterThan(120);
  // Fired the other way, it is thrown the other way.
  const q = new Particles(3);
  q.emit('casing', at, -1);
  q.update(1);
  expect(q.all()[0].vx).toBeGreaterThan(0);
});

test('smoke rises and grows; debris falls', () => {
  const p = new Particles(5);
  p.emit('smoke', at, 1);
  p.update(1);
  const before = p.all().map((s) => ({ y: s.y, size: s.size }));
  p.update(300);
  p.all().forEach((s, i) => { expect(s.y).toBeLessThan(before[i].y); expect(s.size).toBeGreaterThan(before[i].size); });
  const d = new Particles(5);
  d.emit('debris', at, 1);
  d.update(1);
  d.update(500);
  expect(d.all().some((chunk) => chunk.vy > 0)).toBe(true);
});

test('the same seed gives the same burst; another seed another', () => {
  const run = (seed: number) => { const p = new Particles(seed); p.emit('sparks', at, 1); p.update(50); return JSON.stringify(p.all()); };
  expect(run(7)).toBe(run(7));
  expect(run(7)).not.toBe(run(8));
});

test('there is a limit to what is in the air at once', () => {
  const p = new Particles(1);
  for (let i = 0; i < 100; i++) p.emit('debris', at, 1);
  p.update(1);
  expect(p.count).toBeLessThanOrEqual(MAX_PARTICLES);
});

test('with motion off nothing is ever emitted', () => {
  const p = new Particles(1, false);
  p.emit('debris', at, 1);
  p.update(16);
  expect(p.count).toBe(0);
});

test('drawing paints one small square a particle, on whole pixels', () => {
  const p = new Particles(2);
  p.emit('sparks', at, 1);
  p.update(30);
  const rects: number[][] = [];
  const ctx = { fillStyle: '', globalAlpha: 1, fillRect: (...args: number[]) => { rects.push(args); } } as unknown as CanvasRenderingContext2D;
  p.draw(ctx);
  expect(rects).toHaveLength(p.count);
  for (const rect of rects) for (const n of rect) expect(Number.isInteger(n)).toBe(true);
});
