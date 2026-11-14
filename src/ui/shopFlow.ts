import { buy, checkBuy, checkSell, sell, type GameState } from '../core/game';
import type { Catalog, Part } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import { MenuList, type ListItem } from './menuList';

export type ShopTab = 'head' | 'core' | 'arms' | 'legs' | 'generator' | 'booster' | 'fcs' | 'module' | 'hand' | 'shoulder';
export const SHOP_TABS: ShopTab[] = ['head', 'core', 'arms', 'legs', 'generator', 'booster', 'fcs', 'module', 'hand', 'shoulder'];

const S = STRINGS.shop;
const EMPTY = '(empty)';
/** Weapons are sold by mount; a shield is carried in a hand. */
const tabOf = (part: Part): ShopTab => (part.kind === 'weapon' ? part.mount : part.kind === 'shield' ? 'hand' : part.kind);

/**
 * The shop without any drawing: ten categories, a buy list and a sell list.
 * The game it is given is never changed; `game` holds the result.
 */
export class ShopFlow {
  game: GameState;
  tab: ShopTab = 'head';
  mode: 'buy' | 'sell' = 'buy';
  list = new MenuList();
  message = '';

  /** `stock` is what is for sale now; `everything` is every part that exists, so anything owned can be sold. */
  constructor(game: GameState, private catalog: Catalog, private stock: Part[], private everything: Part[] = stock) {
    this.game = game;
    this.list = new MenuList(this.items());
  }

  private items(): ListItem[] {
    if (this.mode === 'buy') {
      return this.stock.filter((part) => tabOf(part) === this.tab).map((part) => {
        const owned = this.game.inventory[part.id] ?? 0;
        return {
          id: part.id, label: owned > 0 ? `${part.name} (${owned})` : part.name,
          enabled: checkBuy(this.game, part.id, this.catalog) === null, note: String(part.price),
        };
      });
    }
    const parts = this.everything.filter((part) => tabOf(part) === this.tab);
    const owned = parts.filter((part) => (this.game.inventory[part.id] ?? 0) > 0).map((part) => {
      const refusal = checkSell(this.game, part.id, this.catalog);
      const note = refusal === null ? `+${part.price}` : refusal === 'lastWeapon' ? S.lastWeapon : S.inUse;
      return { id: part.id, label: part.name, enabled: refusal === null, note };
    });
    return owned.length > 0 ? owned : [{ id: EMPTY, label: S.nothingToSell, enabled: false }];
  }

  /** The part under the cursor, if the list has one. */
  get selected(): Part | undefined {
    const id = this.list.selected?.id;
    return id && id !== EMPTY ? this.catalog[id] : undefined;
  }

  private reset(): void {
    this.list = new MenuList(this.items());
    this.message = '';
  }

  onInput(action: InputAction): 'stay' | 'changed' | 'exit' {
    switch (action) {
      case 'cancel': return 'exit';
      case 'up': this.list.move(-1); this.message = ''; return 'stay';
      case 'down': this.list.move(1); this.message = ''; return 'stay';
      case 'prev':
      case 'next': {
        const n = SHOP_TABS.length;
        this.tab = SHOP_TABS[(SHOP_TABS.indexOf(this.tab) + (action === 'next' ? 1 : n - 1)) % n];
        this.reset();
        return 'stay';
      }
      case 'left':
      case 'right':
        this.mode = this.mode === 'buy' ? 'sell' : 'buy';
        this.reset();
        return 'stay';
      case 'confirm': {
        const part = this.selected;
        if (!part) return 'stay';
        if (this.mode === 'buy') {
          if (checkBuy(this.game, part.id, this.catalog) !== null) { this.message = S.cannotAfford; return 'stay'; }
          this.game = buy(this.game, part.id, this.catalog);
          this.message = S.bought(part.name);
        } else {
          const refusal = checkSell(this.game, part.id, this.catalog);
          if (refusal !== null) { this.message = refusal === 'lastWeapon' ? S.needWeapon : S.inUse; return 'stay'; }
          this.game = sell(this.game, part.id, this.catalog);
          this.message = S.sold(part.name, part.price);
        }
        this.list.setItems(this.items());
        return 'changed';
      }
      default: return 'stay';
    }
  }
}
