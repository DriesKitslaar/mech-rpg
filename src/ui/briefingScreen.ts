import type { Mission } from '../core/campaign';
import { ENEMIES } from '../content/enemies';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawText, wrap } from './widgets';

const B = STRINGS.briefing;

/** One line per kind of enemy across all of a contract's battles: "Recon Drone x3". */
export function hostiles(mission: Mission): string[] {
  const counts = new Map<string, number>();
  for (const battle of mission.battles) for (const id of battle.enemies) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]) => `${ENEMIES[id]?.name ?? id}${n > 1 ? ` x${n}` : ''}`);
}

/** A contract's briefing: who is asking, what they say, what to expect, and whether to take it. */
export class BriefingScreen implements Screen {
  private list = new MenuList([
    { id: 'accept', label: B.accept, enabled: true },
    { id: 'back', label: B.back, enabled: true },
  ]);

  constructor(private app: App, private mission: Mission) {}

  update(): void {}

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.app.openHub(true);
    else if (action === 'confirm') {
      if (this.list.selected?.id === 'accept') this.app.startMission(this.mission.id);
      else this.app.openHub(true); // back to the list the briefing was opened from
    }
  }

  view(): ScreenView {
    return { menu: { items: this.list.items, cursor: this.list.cursor }, briefing: { mission: this.mission.id } };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { mission } = this;
    const { sprites } = this.app.deps;
    const bg = sprites.get(mission.battles[0].background, { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.72)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Header: portrait (or a plain terminal mark for the dispatcher), title and client.
    drawPanel(ctx, 4, 4, LOGICAL_W - 8, 64);
    if (mission.portrait) {
      const p = sprites.get(mission.portrait, { w: 56, h: 56, label: '' });
      ctx.drawImage(p.image, 8, 8, 56, 56);
    } else {
      ctx.fillStyle = COLORS.empty;
      ctx.fillRect(8, 8, 56, 56);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? COLORS.energy : COLORS.accent; ctx.fillRect(16, 18 + i * 8, 40 - i * 5, 3); }
    }
    drawText(ctx, mission.title.toUpperCase(), 72, 8, { size: 16, color: COLORS.accent });
    drawText(ctx, mission.client, 72, 26, { color: COLORS.text });
    const tag = mission.phase === 'choice' ? B.exclusive : mission.phase === 'finale' ? B.finale : mission.phase === 'patrol' ? B.repeatable : '';
    wrap(tag, charsFor(LOGICAL_W - 80, 10)).slice(0, 2).forEach((line, i) =>
      drawText(ctx, line, 72, 40 + i * 9, { size: 10, color: mission.phase === 'choice' ? COLORS.danger : COLORS.dim }));

    // Body.
    drawPanel(ctx, 4, 72, LOGICAL_W - 8, 122);
    let y = 78;
    for (const paragraph of mission.briefing) {
      for (const line of wrap(paragraph, charsFor(LOGICAL_W - 24))) {
        if (y > 180) break;
        drawText(ctx, line, 12, y);
        y += LINE;
      }
      y += 4;
    }

    // Footer: what to expect, what it pays, and the choice.
    drawPanel(ctx, 4, 198, LOGICAL_W - 8, 68);
    drawText(ctx, B.engagements(mission.battles.length), 12, 203, { color: COLORS.dim });
    drawText(ctx, `${B.reward} ${mission.reward}`, 12, 215, { size: 16, color: COLORS.armor });
    drawText(ctx, B.hostiles, 120, 203, { color: COLORS.dim });
    hostiles(mission).slice(0, 5).forEach((line, i) => drawText(ctx, line, 120, 213 + i * 9, { size: 10 }));
    drawList(ctx, this.list, 236, 216, 56, 2);
  }
}
