import { reached } from '../core/campaign';
import { checksHeld, type Find } from '../core/codex';
import type { GameState } from '../core/game';
import { grudgeFace, ledger } from '../core/grudge';
import { BOARD_TEXT, ledgerText } from '../content/board';
import { JUKEBOX, MANUAL, PEOPLE, UNITS, WORLD, type Person } from '../content/codex';
import { FINDS } from '../content/finds';
import { MISSIONS } from '../content/missions';
import { SONGS, type SongName } from '../content/songs';
import { songSeconds, type TrackName } from '../platform/music';
import { STRINGS } from '../content/strings';
import { listTitle } from '../content/titles';
import type { InputAction } from '../platform/input';
import { ALL_ENEMIES } from '../content/arena';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { unitPage } from './unitPage';
import { CHAR_W, COLORS, LINE, charsFor, clip, drawList, drawPanel, drawPortrait, drawTabs, drawText, wrap } from './widgets';

const D = STRINGS.database;
export type DatabasePage = 'units' | 'people' | 'world' | 'finds' | 'manual' | 'music';
const PAGES: DatabasePage[] = ['units', 'people', 'world', 'finds', 'manual', 'music'];

/**
 * A find's row in the list: a paper by its number and its name, a check by what is stamped on it.
 * One that is not found keeps its name to itself; a paper still shows its number, so the gaps can be seen.
 */
export function findLabel(find: Find, found: boolean): string {
  if (find.kind === 'check') return found ? listTitle(find.title) : `${D.check} ${D.unknown}`;
  return `${String(find.no).padStart(2, '0')} ${found ? listTitle(find.title) : D.unknown}`;
}

/**
 * Whether somebody's page has opened: the story has got as far as them, or they have been met in
 * battle. A story that starts over does not close the pages it opened: whoever it brings in is on
 * the way to its end, so a pilot in a later cycle has had to do with all of them.
 */
export function personKnown(game: GameState, person: Person): boolean {
  if ('met' in person.when) return game.met.includes(person.when.met);
  return game.cycle > 0 || reached(game, person.when.after, MISSIONS);
}
/** The list on the left and the page on the right. A row's name in the list begins twelve pixels into its panel and must end inside it. */
export const LIST = { x: 4, y: 18, w: 106, h: 234 };
const PAGE = { x: 114, y: 18, w: LOGICAL_W - 118, h: 234 };
const ROWS = Math.floor((LIST.h - 10) / LINE);
/** Characters to a line of the page, and the box a unit's picture stands in. */
export const PAGE_CHARS = charsFor(PAGE.w - 12);
const PICTURE_H = 106;
/** A face is drawn at the size it was painted. */
const PORTRAIT = 56;
/** The lines there are for what is said of somebody, under their name and their face. */
export const PERSON_LINES = Math.floor((PAGE.h - 4 - (4 + LINE + 2 + PORTRAIT + 6)) / LINE);
/** The row of an account in the list of people: by its callsign, which is nobody else's id. */
const ACCOUNT = 'account:';
/**
 * The letters of a callsign its row has room for, beside the word that says what the account is. The game's own
 * callsigns are shorter; one from a file made elsewhere may not be, and is cut (its page has it whole).
 */
export const ROW_NAME = 10;
/**
 * The letters a row of a list has room for, clear of the mark at its right that says the list goes on: a name
 * that is longer is cut in the list, and stands whole at the head of its page.
 */
export const ROW_CHARS = Math.round((LIST.w - 20) / CHAR_W);
const row = (label: string): string => clip(label, ROW_CHARS);
/** The most lines a find's text may take on its page, and its clue: both stand under a name and a line about where it comes from. */
export const FIND_TEXT_LINES = 12;
export const FIND_CLUE_LINES = 3;
/** The side of a find's picture: it is drawn at the size it was made, as a face is. */
export const FIND_PICTURE = 56;
/** Characters to a line beside that picture, where a find's page says where it comes from. */
export const FIND_SOURCE_CHARS = charsFor(PAGE.w - 12 - FIND_PICTURE - 6);
/** A check's number as the game stamps it on the brass: the cut dark, with the light catching its lower edge. */
const STAMP = { size: 16, top: 22, cut: '#2b1a08', edge: '#f4d98c' };

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
  /** Where a find comes from: beside its picture once it is found, and under the three marks until then. */
  source?: string;
  /** A find's picture, once it is found; and on a check, the number the page stamps on the brass. */
  picture?: string;
  stamp?: string;
}

/**
 * The database: every kind of enemy met, with what it is weak to and how to fight it; what has come
 * to light about Varn so far; what has been found; how the game works; and the songs heard so far,
 * to be played again. Nothing here changes anything: it is for reading, and for listening.
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
      units: new MenuList(UNITS.map((unit) => ({ id: unit.id, label: met(unit.id) ? row(this.unitTitle(unit.id)) : D.unknown, enabled: met(unit.id) }))),
      // What has not come to light is not listed at all: a title would give it away.
      world: new MenuList(WORLD.filter((entry) => game.codex.includes(entry.id)).map((entry) => ({ id: entry.id, label: row(listTitle(entry.title)), enabled: true }))),
      // Every find has its row from the start, a paper under its number: what is missing can be seen, and read about.
      finds: new MenuList(FINDS.map((find) => {
        const found = game.codex.includes(find.id);
        return { id: find.id, label: row(findLabel(find, found)), enabled: found };
      })),
      manual: new MenuList(MANUAL.map((topic) => ({ id: topic.id, label: row(listTitle(topic.title)), enabled: true }))),
      // First whoever has an account with the pilot: the one that is open, then those that are closed, each with a
      // word behind the callsign that says which. Nobody is listed there before an account with them begins. Then
      // everybody of the story, each with a row like every unit: somebody not come across yet keeps their name.
      people: new MenuList([
        ...ledger(game).map((entry) => ({ id: `${ACCOUNT}${entry.name}`, label: clip(entry.name, ROW_NAME), enabled: true, note: entry.open ? D.rowOpen : D.rowClosed })),
        ...PEOPLE.map((person) => {
          const known = personKnown(game, person);
          return { id: person.id, label: known ? row(person.name) : D.unknown, enabled: known };
        }),
      ]),
      // Every song has its row, like every unit: one not heard yet keeps its name to itself.
      music: new MenuList(JUKEBOX.map((song) => {
        const heard = app.heard().includes(song.id);
        return { id: song.id, label: heard ? row(listTitle(song.title, 'en')) : D.unknown, enabled: heard };
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
    if (this.page === 'finds') return `${D.found(this.lists.finds.items.filter((item) => item.enabled).length, FINDS.length)}   ${D.checks(checksHeld(this.app.game!))}`;
    if (this.page === 'music') return D.heard(this.lists.music.items.filter((item) => item.enabled).length, JUKEBOX.length);
    if (this.page === 'people') {
      // The people of the story the pilot has come across, of those there are; and beside it how many accounts there are to read about.
      const accounts = ledger(this.app.game!).length;
      const known = this.lists.people.items.filter((item) => item.enabled && !item.id.startsWith(ACCOUNT)).length;
      return accounts > 0 ? `${D.known(known, PEOPLE.length)}   ${D.accounts(accounts)}` : D.known(known, PEOPLE.length);
    }
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
    if (this.page === 'people' && selected.id.startsWith(ACCOUNT)) {
      const entry = ledger(this.app.game!).find((account) => `${ACCOUNT}${account.name}` === selected.id);
      if (!entry) return null;
      const role = entry.open ? D.accountOpen : D.accountClosed;
      const lines = wrap(ledgerText(entry, this.app.called()), PAGE_CHARS);
      const { portrait } = grudgeFace(BOARD_TEXT, entry.name);
      // A callsign that has no face has what it is to the pilot as its first line, where the face would have it beside it.
      return portrait ? { title: entry.name.toUpperCase(), portrait, role, lines } : { title: entry.name.toUpperCase(), lines: [role.toUpperCase(), '', ...lines] };
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
    if (this.page === 'finds') {
      const find = FINDS.find((f) => f.id === selected.id);
      if (!find) return null;
      // One that is not found says where it is, after its fashion, and nothing of what it is.
      if (!selected.enabled) return { title: D.unknown, source: D.notFound, lines: wrap(find.clue, PAGE_CHARS) };
      return {
        title: find.title, source: find.source, lines: wrap(find.text, PAGE_CHARS), picture: find.picture,
        ...(find.kind === 'check' ? { stamp: String(find.no) } : {}),
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
    if (detail.picture) {
      // What was found, the size of a face, and beside it where it comes from.
      drawPortrait(ctx, this.app.deps.sprites, detail.picture, x, y, FIND_PICTURE);
      if (detail.stamp) {
        const middle = x + FIND_PICTURE / 2;
        drawText(ctx, detail.stamp, middle + 1, y + STAMP.top + 1, { size: STAMP.size, align: 'center', color: STAMP.edge });
        drawText(ctx, detail.stamp, middle, y + STAMP.top, { size: STAMP.size, align: 'center', color: STAMP.cut });
      }
      wrap(detail.source ?? '', FIND_SOURCE_CHARS).forEach((line, i) => drawText(ctx, line, x + FIND_PICTURE + 6, y + 1 + i * LINE, { color: COLORS.dim }));
      y += FIND_PICTURE + 6;
    } else if (detail.source) {
      drawText(ctx, detail.source, x, y, { color: COLORS.dim });
      y += LINE + 4;
    }
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

