import { GENERATOR } from '../../src/ui/battleScreen';
import { EYES } from '../../src/ui/eyes';
import type { Drawn, Glowed } from './canvas';

/**
 * The light of the generator on the back of the pilot's mech, in a drawing of the field as it
 * stands on the stage, or undefined where none was drawn. It is the pilot's mech's own small
 * light, as an eye is an enemy's: no larger than a blast's light ever is, and in a colour of its own
 * among lights that small. Like the eyes it is apart from the lights a battle counts.
 */
export function generatorIn(page: Drawn): Glowed | undefined {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(GENERATOR.color.slice(at, at + 2), 16));
  return page.glows.find((glow) => glow.blend === 'lighter' && glow.stops[0][1].startsWith(`rgba(${r}, ${g}, ${b},`)
    && glow.r >= GENERATOR.r - 0.01 && glow.r <= GENERATOR.r + 6.01);
}

/**
 * The lights in a drawing that are the eyes of machines: for each picture of a machine that was
 * drawn, the light of its eye's size that sits on its eye. They are apart from the lights a battle
 * counts: an eye is too small to be one of the sixteen.
 */
export function eyesIn(page: Drawn): Glowed[] {
  const eyes: Glowed[] = [];
  for (const image of page.images) {
    const id = (image.image as { id?: string }).id ?? '';
    if (!Object.hasOwn(EYES, id)) continue;
    const eye = EYES[id];
    const light = page.glows.find((g) => g.blend === 'lighter' && g.r === eye.r && Math.abs(g.x - (image.x + eye.x)) < 0.01 && Math.abs(g.y - (image.y + eye.y)) < 0.01);
    if (light && !eyes.includes(light)) eyes.push(light);
  }
  return eyes;
}
