import { LOGICAL_H, LOGICAL_W, fitCanvas } from './ui/display';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let scale = 1;

function resize(): void {
  scale = fitCanvas(canvas, window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
}

function frame(): void {
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.strokeStyle = '#e08a2c';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, LOGICAL_W - 1, LOGICAL_H - 1);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
