import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * One end-to-end pass over the whole feature set against the real server and its JSON
 * store: formation choice, both ways of assigning a player, a keyboard swap, a custom
 * kit, saving, and a full page reload to prove the data survived.
 */

const slot = (page: Page, id: string) => page.getByTestId(`slot-${id}`);

/** Assigns a player by clicking the position and searching, the way most users will. */
async function assignViaModal(page: Page, slotId: string, query: string, playerId: string) {
  await slot(page, slotId).getByRole('button').first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Search by player or club').fill(query);
  await dialog.getByTestId(`result-${playerId}`).click();

  await expect(dialog).toBeHidden();
  await expect(slot(page, slotId)).toHaveAttribute('data-filled', 'true');
}

/**
 * dnd-kit's pointer sensor needs intermediate moves; a single jump is ignored.
 *
 * `page.mouse` works in viewport coordinates and does no scrolling of its own, so both ends
 * must be on screen before we read their boxes — otherwise the pointer lands nowhere.
 */
async function dragOnto(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('drag source or target is not visible');

  const viewport = page.viewportSize();
  if (viewport) {
    for (const [name, box] of [
      ['source', from],
      ['target', to],
    ] as const) {
      if (box.y < 0 || box.y + box.height > viewport.height) {
        throw new Error(`drag ${name} is outside the viewport; widen it or move the element`);
      }
    }
  }

  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // Several steps so the 6px activation constraint is crossed and dnd-kit tracks the move.
  const steps = 10;
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(
      start.x + ((end.x - start.x) * step) / steps,
      start.y + ((end.y - start.y) * step) / steps,
    );
  }
  await page.mouse.up();

  // dnd-kit suppresses the click that ends a drag with a document-level capture listener,
  // and tears it down 50ms after pointerup. Automation clicks faster than that, so without
  // this wait the next click is swallowed. A real user cannot move and click that quickly.
  await page.waitForTimeout(120);
}

async function playerNameIn(cell: Locator): Promise<string> {
  return (await cell.locator('.slot-name').innerText()).trim();
}

/** dnd-kit's keyboard sensor moves the dragged item 25px per arrow press. */
const KEYBOARD_STEP = 25;

/**
 * Swaps two positions using only the keyboard: focus the source handle, pick up with Space,
 * arrow across, drop with Space. The press count comes from the real geometry so the test
 * does not depend on the pitch being a particular size.
 */
async function keyboardDrag(page: Page, handle: Locator, target: Locator) {
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('keyboard drag source or target is not visible');

  await handle.focus();
  await expect(handle).toBeFocused();

  // Space picks the player up. The source slot dims while it is being carried, which is how
  // we know the sensor actually engaged before sending arrow keys.
  await page.keyboard.press('Space');
  const sourceSlot = page.locator('.slot', { has: handle });
  await expect(sourceSlot).toHaveAttribute('data-dragging', 'true');

  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const horizontal = Math.abs(dx) >= Math.abs(dy);

  const alongMainAxis = horizontal
    ? dx > 0
      ? 'ArrowRight'
      : 'ArrowLeft'
    : dy > 0
      ? 'ArrowDown'
      : 'ArrowUp';
  const alongCrossAxis = horizontal
    ? dy > 0
      ? 'ArrowDown'
      : 'ArrowUp'
    : dx > 0
      ? 'ArrowRight'
      : 'ArrowLeft';

  const crossSteps = Math.round(Math.abs(horizontal ? dy : dx) / KEYBOARD_STEP);
  for (let i = 0; i < crossSteps; i++) {
    await page.keyboard.press(alongCrossAxis);
  }

  // Step along the main axis until the intended position becomes the drop target. dnd-kit
  // auto-scrolls while dragging, so a press count computed up front is not reliable; asking
  // the page after each press is.
  const maxPresses = 80;
  for (let i = 0; i < maxPresses; i++) {
    if ((await target.getAttribute('data-over')) === 'true') break;
    await page.keyboard.press(alongMainAxis);
  }

  // Confirm we really are over the intended position before dropping. Without this a
  // mis-aimed drag would silently swap the wrong pair and fail somewhere less obvious.
  await expect(target).toHaveAttribute('data-over', 'true');

  await page.keyboard.press('Space');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Start from a clean slate so a leftover store from an earlier run cannot mask a bug.
  await page.getByRole('button', { name: 'New' }).click();
});

test('builds, themes, saves and reloads a lineup', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Lineups' })).toBeVisible();

  // 1. Pick a formation.
  await page.getByLabel('Formation').selectOption('4-3-3');
  await expect(page.getByTestId('lineup-counter')).toHaveText(/0 \/ 11 picked/);
  await expect(page.locator('[data-testid^="slot-"]')).toHaveCount(11);

  // 2. Assign by clicking a position and searching in the modal.
  await assignViaModal(page, 'gk', 'alisson', 'liv-alisson');
  await expect(page.getByTestId('lineup-counter')).toHaveText(/1 \/ 11 picked/);

  // 3. Assign by dragging a player from the pool onto a position.
  const haaland = page.getByTestId('pool-mci-haaland');
  await page.getByLabel('Search available players').fill('haaland');
  await expect(haaland).toBeVisible();

  await dragOnto(page, haaland, slot(page, 'st1'));
  await expect(slot(page, 'st1')).toHaveAttribute('data-filled', 'true');
  await expect(slot(page, 'st1')).toContainText('Haaland');
  await expect(page.getByTestId('lineup-counter')).toHaveText(/2 \/ 11 picked/);

  // A player on the pitch is no longer offered in the pool.
  await expect(haaland).toBeHidden();

  // 4. Swap two players with the keyboard, via the drag handles.
  await assignViaModal(page, 'lw', 'kvara', 'psg-kvaratskhelia');
  await assignViaModal(page, 'rw', 'salah', 'liv-salah');

  const before = {
    lw: await playerNameIn(slot(page, 'lw')),
    rw: await playerNameIn(slot(page, 'rw')),
  };
  expect(before.lw).toBe('Kvaratskhelia');
  expect(before.rw).toBe('Salah');

  await keyboardDrag(page, page.getByTestId('drag-lw'), slot(page, 'rw'));

  await expect(slot(page, 'lw')).toContainText('Salah');
  await expect(slot(page, 'rw')).toContainText('Kvaratskhelia');
  // A swap moves players around; it must never change how many are on the pitch.
  await expect(page.getByTestId('lineup-counter')).toHaveText(/4 \/ 11 picked/);

  // 5. Club kits by default: Liverpool red differs from Man City sky blue.
  const shirt = (slotId: string) => slot(page, slotId).locator('[data-kit-shirt]');
  await expect(shirt('gk')).toHaveAttribute('data-kit-shirt', '#c8102e');
  await expect(shirt('st1')).toHaveAttribute('data-kit-shirt', '#6cabdd');

  // 6. Switch the whole team to a custom theme.
  await page.getByRole('button', { name: 'Apply Monochrome kit' }).click();
  for (const slotId of ['gk', 'st1', 'lw', 'rw']) {
    await expect(shirt(slotId), `${slotId} should wear the theme`).toHaveAttribute(
      'data-kit-shirt',
      '#18181b',
    );
  }

  // 7. Name it and save.
  await page.getByLabel('Lineup name').fill('E2E Dream XI');
  await page.getByRole('button', { name: /^Save/ }).click();
  await expect(page.getByRole('button', { name: /^E2E Dream XI/ })).toBeVisible();

  // 8. Reload: the lineup must come back from disk exactly as saved.
  await page.reload();
  await page.getByRole('button', { name: /^E2E Dream XI/ }).click();

  await expect(page.getByLabel('Lineup name')).toHaveValue('E2E Dream XI');
  await expect(page.getByLabel('Formation')).toHaveValue('4-3-3');
  await expect(page.getByTestId('lineup-counter')).toHaveText(/4 \/ 11 picked/);

  await expect(slot(page, 'gk')).toContainText('Alisson');
  await expect(slot(page, 'st1')).toContainText('Haaland');
  await expect(slot(page, 'lw')).toContainText('Salah');
  await expect(slot(page, 'rw')).toContainText('Kvaratskhelia');

  // The custom kit survived too.
  await expect(page.getByRole('radio', { name: 'Custom theme' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(shirt('gk')).toHaveAttribute('data-kit-shirt', '#18181b');
});

test('keeps compatible players when the formation changes', async ({ page }) => {
  await page.getByLabel('Formation').selectOption('4-3-3');
  await assignViaModal(page, 'gk', 'alisson', 'liv-alisson');
  await assignViaModal(page, 'cb1', 'van dijk', 'liv-vandijk');

  await page.getByLabel('Formation').selectOption('4-4-2');

  await expect(slot(page, 'gk')).toContainText('Alisson');
  await expect(slot(page, 'cb1')).toContainText('van Dijk');
  await expect(page.getByTestId('lineup-counter')).toHaveText(/2 \/ 11 picked/);
});

test('drags a player off the pitch back into the pool', async ({ page }) => {
  await assignViaModal(page, 'gk', 'alisson', 'liv-alisson');
  await expect(page.getByTestId('lineup-counter')).toHaveText(/1 \/ 11 picked/);

  await dragOnto(page, page.getByTestId('drag-gk'), page.getByTestId('player-pool'));

  await expect(slot(page, 'gk')).toHaveAttribute('data-filled', 'false');
  await expect(page.getByTestId('lineup-counter')).toHaveText(/0 \/ 11 picked/);
});

test('will not save an unnamed lineup', async ({ page }) => {
  await assignViaModal(page, 'gk', 'alisson', 'liv-alisson');
  await expect(page.getByRole('button', { name: /Save lineup/ })).toBeDisabled();

  await page.getByLabel('Lineup name').fill('Now Named');
  await expect(page.getByRole('button', { name: /^Save/ })).toBeEnabled();
});

test('deletes a saved lineup', async ({ page }) => {
  await page.getByLabel('Lineup name').fill('Temporary XI');
  await page.getByRole('button', { name: /^Save/ }).click();

  const entry = page.getByRole('button', { name: /^Temporary XI/ });
  await expect(entry).toBeVisible();

  await page.getByRole('button', { name: 'Delete Temporary XI' }).click();
  await expect(entry).toBeHidden();
});
