export interface ListItem {
  id: string;
  label: string;
  enabled: boolean;
  /** Short text shown at the right edge: a price, a count, or why the item is disabled. */
  note?: string;
}

/** A cursor over a list of items: the one list behaviour every screen shares. */
export class MenuList {
  items: ListItem[];
  cursor: number;

  constructor(items: ListItem[] = [], cursor = 0) {
    this.items = items;
    this.cursor = Math.max(0, Math.min(cursor, items.length - 1));
  }

  get selected(): ListItem | undefined {
    return this.items[this.cursor];
  }

  /** Moves the cursor, wrapping at both ends. */
  move(delta: number): void {
    const n = this.items.length;
    if (n > 0) this.cursor = (((this.cursor + delta) % n) + n) % n;
  }

  /** Replaces the items, keeping the cursor on the same entry when it still exists. */
  setItems(items: ListItem[]): void {
    const id = this.selected?.id;
    const index = id === undefined ? -1 : items.findIndex((item) => item.id === id);
    this.items = items;
    this.cursor = index >= 0 ? index : Math.max(0, Math.min(this.cursor, items.length - 1));
  }

  /** The window of `rows` items to draw, scrolled so the cursor stays in view. */
  visible(rows: number): { items: ListItem[]; offset: number } {
    const offset = Math.max(0, Math.min(this.cursor - Math.floor(rows / 2), this.items.length - rows));
    return { items: this.items.slice(offset, offset + rows), offset };
  }
}
