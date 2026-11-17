import { EYES } from '../../src/ui/eyes';
import type { Drawn, Glowed } from './canvas';

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
