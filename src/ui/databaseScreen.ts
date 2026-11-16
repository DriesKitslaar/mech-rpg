import { reached } from '../core/campaign';
import type { GameState } from '../core/game';
import { JUKEBOX, MANUAL, PEOPLE, UNITS, WORLD, type Person } from '../content/codex';
import { MISSIONS } from '../content/missions';
import { SONGS, type SongName } from '../content/songs';
import { songSeconds, type TrackName } from '../platform/music';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import { ALL_ENEMIES } from '../content/arena';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { unitPage } from './unitPage';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawPortrait, drawTabs, drawText, wrap } from './widgets';

const D = STRINGS.database;
export type DatabasePage = 'units' | 'people' | 'world' | 'manual' | 'music';
const PAGES: DatabasePage[] = ['units', 'people', 'world', 'manual', 'music'];

/**
 * Whether somebody's page has opened: the story has got as far as them, or they have been met in
 * battle. A story that starts over does not close the pages it opened: whoever it brings in is on
 * the way to its end, so a pilot in a later cycle has had to do with all of them.
 */
export function personKnown(game: GameState, person: Person): boolean {
  if ('met' in person.when) return game.met.includes(person.when.met);
  return game.cycle > 0 || reached(game, person.when.after, MISSIONS);
}
/** The list on the left and the page on the right. */
const LIST = { x: 4, y: 18, w: 106, h: 234 };
const PAGE = { x: 114, y: 18, w: LOGICAL_W - 118, h: 234 };
const ROWS = Math.floor((LIST.h - 10) / LINE);
/** Characters to a line of the page, and the box a unit's picture stands in. */
export const PAGE_CHARS = charsFor(PAGE.w - 12);
const PICTURE_H = 106;
/** A face is drawn at the size it was painted. */
const PORTRAIT = 56;

/** What the page on the right shows, as words: tests read it, and the screen draws it. */
interface Detail {
  title: string;
  lines: string[];
  /** A unit's picture and the three figures written beside it. */
  sprite?: string;
  stats?: { label: string; value: string }[];
  /** Somebody's face, and whom they work for, written beside it. */
  portrait?: string;
  role?: string;
}

/**
 * The database: every kind of enemy met, with what it is weak to and how to fight it; what has come
 * to light about Varn so far; how the game works; and the songs heard so far, to be played again.
 * Nothing here changes anything: it is for reading, and for listening.
 */
export class DatabaseScreen implements Screen {
  private page: DatabasePage = 'units';
  private lists: Record<DatabasePage, MenuList>;
  /** The song that is playing, if one is: the hub's own when the database is opened, until the jukebox plays another. */
  private playing: string | null;
  /** What is left, in milliseconds, of a song that plays once and is then over. One that goes round has no end. */
  private left = Infinity;

  constructor(private app: App) {
    const game = app.game!;
    this.playing = app.settings.music ? 'hub' : null;
    const met = (id: string): boolean => game.met.includes(id);
    this.lists = {
      // Every kind has its row from the start, so the pilot can see how many there are still to meet.
      units: new MenuList(UNITS.map((unit) => ({ id: unit.id, label: met(unit.id) ? this.unitTitle(unit.id) : D.unknown, enabled: met(unit.id) }))),
      // What has not come to light is not listed at all: a title would give it away.
      world: new MenuList(WORLD.filter((entry) => game.codex.includes(entry.id)).map((entry) => ({ id: entry.id, label: titleCase(entry.title), enabled: true }))),
      manual: new MenuList(MANUAL.map((topic) => ({ id: topic.id, label: titleCase(topic.title), enabled: true }))),
      // Everybody has a row, like every unit: somebody not come across yet keeps their name.
      people: new MenuList(PEOPLE.map((person) => {
        const known = personKnown(game, person);
        return { id: person.id, label: known ? person.name : D.unknown, enabled: known };
      })),
      // Every song has its row, like every unit: one not heard yet keeps its name to itself.
      music: new MenuList(JUKEBOX.map((song) => {
        const heard = app.heard().includes(song.id);
        return { id: song.id, label: heard ? titleCase(song.title) : D.unknown, enabled: heard };
      })),
    };
    // Open on the first unit there is something to read about.
    const first = this.lists.units.items.findIndex((item) => item.enabled);
    if (first > 0) this.lists.units.cursor = first;
  }

  private unitTitle(id: string): string {
    return UNITS.find((unit) => unit.id === id)?.title ?? ALL_ENEMIES[id]?.name ?? id;
  }

  private get list(): MenuList {
    return this.lists[this.page];
  }

  /** How much of the page there is to see. */
  private count(): string {
    if (this.page === 'units') return D.met(this.lists.units.items.filter((item) => item.enabled).length, UNITS.length);
    if (this.page === 'world') return D.entries(this.lists.world.items.length, WORLD.length);
    if (this.page === 'music') return D.heard(this.lists.music.items.filter((item) => item.enabled).length, JUKEBOX.length);
    if (this.page === 'people') return D.known(this.lists.people.items.filter((item) => item.enabled).length, PEOPLE.length);
    return D.topics(MANUAL.length);
  }

  private detail(): Detail | null {
    const selected = this.list.selected;
    if (!selected) return null;
    if (this.page === 'units') {
      const def = ALL_ENEMIES[selected.id];
      if (!selected.enabled || !def) return { title: D.unknown, lines: [D.notMet] };
      const text = unitPage(def, this.app.deps.catalog);
      const note = UNITS.find((unit) => unit.id === selected.id)?.note ?? '';
      return {
        title: this.unitTitle(selected.id).toUpperCase(), sprite: def.sprite, stats: text.stats,
        lines: [...text.weapons, ...text.abilities, '', ...wrap(note, PAGE_CHARS)],
      };
    }
    if (this.page === 'people') {
      const person = PEOPLE.find((p) => p.id === selected.id);
      if (!selected.enabled || !person) return { title: D.unknown, lines: [D.notMet] };
      // Somebody with a price on them is wanted until the notice has been collected on.
      const caught = !!person.bounty && this.app.game!.completed.includes(person.bounty);
      return { title: person.name.toUpperCase(), portrait: person.portrait, role: caught ? D.broughtIn : person.role, lines: wrap(person.text, PAGE_CHARS) };
    }
    if (this.page === 'music') {
      const song = JUKEBOX.find((s) => s.id === selected.id);
      if (!selected.enabled || !song) return { title: D.unknown, lines: [D.notHeard] };
      const seconds = Math.round(songSeconds(SONGS[song.id]));
      const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      const on = this.playing === song.id;
      return {
        title: song.title,
        lines: [
          ...wrap(song.text, PAGE_CHARS), '', D.length(time), D.tempo(SONGS[song.id].bpm), '',
          // With the music off there is nothing to hear and nothing to press: said, rather than leaving a button that seems dead.
          ...(this.app.settings.music ? (on ? [D.playing, D.stop] : [D.play]) : wrap(D.musicOff, PAGE_CHARS)),
        ],
      };
    }
    const entry = this.page === 'world' ? WORLD.find((e) => e.id === selected.id) : MANUAL.find((t) => t.id === selected.id);
    return entry ? { title: entry.title, lines: wrap(entry.text, PAGE_CHARS) } : null;
  }

  private turn(by: number): void {
    this.page = PAGES[(PAGES.indexOf(this.page) + by + PAGES.length) % PAGES.length];
  }

  update(dtMs: number): void {
    // A song that plays once is over when it is over: the page stops saying it plays, and the
    // player is told to be quiet, so that the same song starts afresh when it is asked for again.
    if (this.playing && (this.left -= dtMs) <= 0) {
      this.playing = null;
      this.app.stopMusic();
    }
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'next' || action === 'right') this.turn(1);
    else if (action === 'prev' || action === 'left') this.turn(-1);
    else if (action === 'cancel') this.app.go('hub');
    else if (action === 'confirm' && this.page === 'music' && this.list.selected?.enabled) this.toggle(this.list.selected.id);
  }

  /** Plays a song, or stops the one that is playing. Leaving the database brings the hub's own song back. */
  private toggle(id: string): void {
    if (!this.app.settings.music) return;
    if (this.playing === id) {
      this.playing = null;
      this.app.stopMusic();
    } else {
      this.playing = id;
      this.left = SONGS[id as SongName]?.loop === false ? songSeconds(SONGS[id as SongName]) * 1000 : Infinity;
      this.app.playTrack(id as TrackName);
    }
  }

  view(): ScreenView {
    return { menu: { items: this.list.items, cursor: this.list.cursor }, page: this.page, count: this.count(), detail: this.detail(), playing: this.playing };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { sprites } = this.app.deps;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.6)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, D.heading, 5, 1, { color: COLORS.accent });
    drawTabs(ctx, LOGICAL_W - 5, 1, PAGES.map((page) => D.pages[page]), PAGES.indexOf(this.page));

    drawPanel(ctx, LIST.x, LIST.y, LIST.w, LIST.h);
    drawList(ctx, this.list, LIST.x + 4, LIST.y + 5, LIST.w - 16, ROWS);

    drawPanel(ctx, PAGE.x, PAGE.y, PAGE.w, PAGE.h);
    const detail = this.detail();
    if (detail) this.drawDetail(ctx, detail);

    drawText(ctx, this.count(), 5, 255, { color: COLORS.dim });
    drawText(ctx, D.hint, LOGICAL_W - 5, 255, { align: 'right', color: COLORS.dim });
  }

  private drawDetail(ctx: CanvasRenderingContext2D, detail: Detail): void {
    const x = PAGE.x + 6;
    let y = PAGE.y + 4;
    drawText(ctx, detail.title, x, y, { color: COLORS.accent });
    y += LINE + 2;
    if (detail.sprite && detail.stats) {
      // The unit stands at the right of its box, its figures beside it. One too tall for the box is drawn smaller.
      const w = PAGE.w - 12;
      ctx.fillStyle = COLORS.empty;
      ctx.fillRect(x, y, w, PICTURE_H);
      const sprite = this.app.deps.sprites.get(detail.sprite, { w: 64, h: 64, label: '' });
      const scale = Math.min(1, (PICTURE_H - 4) / sprite.h);
      const sw = Math.round(sprite.w * scale);
      const sh = Math.round(sprite.h * scale);
      ctx.drawImage(sprite.image, x + w - sw - 2, y + PICTURE_H - sh - 2, sw, sh);
      detail.stats.forEach((stat, i) => {
        drawText(ctx, stat.label, x + 4, y + 4 + i * 2 * LINE, { color: COLORS.dim, size: 10 });
        drawText(ctx, stat.value, x + 4, y + 4 + i * 2 * LINE + 9);
      });
      y += PICTURE_H + 4;
    }
    if (detail.portrait) {
      // The face at its own size, and beside it whom they work for.
      drawPortrait(ctx, this.app.deps.sprites, detail.portrait, x, y, PORTRAIT);
      if (detail.role) drawText(ctx, detail.role.toUpperCase(), x + PORTRAIT + 6, y + 2, { color: COLORS.dim, size: 10 });
      y += PORTRAIT + 6;
    }
    const room = Math.floor((PAGE.y + PAGE.h - 4 - y) / LINE);
    detail.lines.slice(0, room).forEach((text, i) => drawText(ctx, text, x, y + i * LINE));
  }
}

/** "THE FLOODGATES" as it reads in a list: "The Floodgates". */
function titleCase(title: string): string {
  return title.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, gap: string, letter: string) => gap + letter.toUpperCase());
}
