export const LOGICAL_W = 310;
export const LOGICAL_H = 270;

/** Largest whole-number scale at which the logical screen fits the viewport. */
export function computeScale(viewW: number, viewH: number): number {
  return Math.max(1, Math.floor(Math.min(viewW / LOGICAL_W, viewH / LOGICAL_H)));
}

/** Sizes the canvas backing store to an integer multiple of the logical screen. */
export function fitCanvas(canvas: HTMLCanvasElement, viewW: number, viewH: number, dpr: number): number {
  const scale = computeScale(viewW * dpr, viewH * dpr);
  canvas.width = LOGICAL_W * scale;
  canvas.height = LOGICAL_H * scale;
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
  return scale;
}
