export const LOGICAL_W = 310;
export const LOGICAL_H = 270;

/** Largest whole-number scale at which the logical screen fits the viewport. */
export function computeScale(viewW: number, viewH: number): number {
  return Math.max(1, Math.floor(Math.min(viewW / LOGICAL_W, viewH / LOGICAL_H)));
}

/**
 * Sizes the canvas backing store to a whole multiple of the logical screen and places it.
 *
 * The viewport comes in whole CSS pixels. At a pixel ratio that is not a whole number that can be a
 * little less than the real screen (1240 device pixels reported as 450 CSS pixels at 2.75 is 1237.5),
 * so one CSS pixel each way is forgiven: without that the handheld's screen, which is the game times
 * four exactly, could be drawn at three times with a black border.
 */
export function fitCanvas(canvas: HTMLCanvasElement, viewW: number, viewH: number, dpr: number): number {
  const deviceW = viewW * dpr;
  const deviceH = viewH * dpr;
  const scale = computeScale(deviceW + dpr, deviceH + dpr);
  canvas.width = LOGICAL_W * scale;
  canvas.height = LOGICAL_H * scale;
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
  // In the middle, on whole device pixels. Where the report came up short the real screen has the room: start at the edge.
  canvas.style.left = `${Math.max(0, Math.round((deviceW - canvas.width) / 2)) / dpr}px`;
  canvas.style.top = `${Math.max(0, Math.round((deviceH - canvas.height) / 2)) / dpr}px`;
  return scale;
}
