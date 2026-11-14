import { MenuList, type ListItem } from '../../src/ui/menuList';

const items = (n: number): ListItem[] => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, label: `Item ${i}`, enabled: true }));

test('the cursor wraps in both directions', () => {
  const list = new MenuList(items(3));
  list.move(-1);
  expect(list.selected?.id).toBe('i2');
  list.move(1);
  expect(list.selected?.id).toBe('i0');
});

test('an empty list has no selection and ignores movement', () => {
  const list = new MenuList([]);
  list.move(1);
  expect(list.selected).toBeUndefined();
  expect(list.cursor).toBe(0);
  expect(list.visible(5)).toEqual({ items: [], offset: 0 });
});

test('a starting cursor outside the list is clamped', () => {
  expect(new MenuList(items(3), 9).cursor).toBe(2);
});

test('replacing the items keeps the cursor on the same entry when it survives', () => {
  const list = new MenuList(items(5), 3);
  list.setItems([items(5)[3], items(5)[0]]);
  expect(list.selected?.id).toBe('i3');
  expect(list.cursor).toBe(0);
});

test('replacing the items clamps the cursor when its entry is gone', () => {
  const list = new MenuList(items(5), 4);
  list.setItems(items(2));
  expect(list.cursor).toBe(1);
  list.setItems([]);
  expect(list.cursor).toBe(0);
});

test('the visible window follows the cursor through a long list', () => {
  const list = new MenuList(items(12));
  expect(list.visible(5)).toMatchObject({ offset: 0 });
  expect(list.visible(5).items.map((i) => i.id)).toEqual(['i0', 'i1', 'i2', 'i3', 'i4']);
  list.move(6);
  expect(list.visible(5).offset).toBe(4);
  list.move(5);
  expect(list.cursor).toBe(11);
  expect(list.visible(5).offset).toBe(7);
  expect(list.visible(5).items.at(-1)?.id).toBe('i11');
});

test('a short list is shown whole', () => {
  expect(new MenuList(items(3), 2).visible(5)).toMatchObject({ offset: 0, items: items(3) });
});
