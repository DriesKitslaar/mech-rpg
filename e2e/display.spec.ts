import { expect, test } from '@playwright/test';

test('canvas is 4x at the handheld resolution', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('#game');
  await expect(canvas).toHaveAttribute('width', '1240');
  await expect(canvas).toHaveAttribute('height', '1080');
});

test('canvas letterboxes at an integer scale in a smaller viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/');
  const canvas = page.locator('#game');
  await expect(canvas).toHaveAttribute('width', '620');
  await expect(canvas).toHaveAttribute('height', '540');
  const box = (await canvas.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1000);
  expect(box.y + box.height).toBeLessThanOrEqual(700);
});
