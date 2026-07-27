import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lineup, LineupInput } from '../shared/types';
import { App } from './App';

/**
 * Drives the whole editor against an in-memory fake of the API, so these tests cover the
 * wiring between the toolbar, pitch, modal and kit panel without a server.
 */
function installFakeApi() {
  const lineups = new Map<string, Lineup>();
  let counter = 0;
  const created: LineupInput[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const json = (body: unknown, status = 200) =>
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (url === '/api/lineups' && method === 'GET') {
      return json(
        [...lineups.values()].map((l) => ({
          id: l.id,
          name: l.name,
          formationId: l.formationId,
          playerCount: Object.keys(l.assignments).length,
          updatedAt: l.updatedAt,
        })),
      );
    }

    if (url === '/api/lineups' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as LineupInput;
      created.push(body);
      const lineup: Lineup = {
        ...body,
        id: `lineup-${++counter}`,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      lineups.set(lineup.id, lineup);
      return json(lineup, 201);
    }

    const match = /^\/api\/lineups\/(.+)$/.exec(url);
    if (match) {
      const id = match[1]!;
      if (method === 'GET') {
        const found = lineups.get(id);
        return found ? json(found) : json({ error: 'Lineup not found' }, 404);
      }
      if (method === 'PUT') {
        const body = JSON.parse(String(init?.body)) as LineupInput;
        const existing = lineups.get(id);
        if (!existing) return json({ error: 'Lineup not found' }, 404);
        const updated: Lineup = { ...existing, ...body, updatedAt: '2026-02-02T00:00:00.000Z' };
        lineups.set(id, updated);
        return json(updated);
      }
      if (method === 'DELETE') {
        return lineups.delete(id) ? json(null, 204) : json({ error: 'Lineup not found' }, 404);
      }
    }

    return json({ error: `Unhandled ${method} ${url}` }, 500);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { lineups, created, fetchMock };
}

let fake: ReturnType<typeof installFakeApi>;

beforeEach(() => {
  fake = installFakeApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Assigns a player to a slot through the search modal, the way a user would. */
async function assignViaModal(
  user: ReturnType<typeof userEvent.setup>,
  slotLabel: RegExp,
  search: string,
  playerName: string,
) {
  await user.click(screen.getByRole('button', { name: slotLabel }));
  await user.type(screen.getByLabelText('Search by player or club'), search);
  const results = screen.getByRole('list', { name: 'Search results' });
  await user.click(within(results).getByText(playerName));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

describe('App', () => {
  it('starts on the default formation with an empty pitch', async () => {
    render(<App />);

    expect(await screen.findByLabelText('Formation')).toHaveValue('4-3-3');
    expect(screen.getByTestId('lineup-counter')).toHaveTextContent('0 / 11 picked');
    expect(screen.getAllByTestId(/^slot-/)).toHaveLength(11);
  });

  it('assigns a player through the search modal', async () => {
    const user = userEvent.setup();
    render(<App />);

    await assignViaModal(user, /Empty GK/, 'alisson', 'Alisson');

    expect(screen.getByTestId('slot-gk')).toHaveAttribute('data-filled', 'true');
    expect(screen.getByTestId('lineup-counter')).toHaveTextContent('1 / 11 picked');
  });

  it('removes a player from the pitch', async () => {
    const user = userEvent.setup();
    render(<App />);

    await assignViaModal(user, /Empty GK/, 'alisson', 'Alisson');
    await user.click(screen.getByRole('button', { name: /Remove Alisson from GK/ }));

    expect(screen.getByTestId('slot-gk')).toHaveAttribute('data-filled', 'false');
    expect(screen.getByTestId('lineup-counter')).toHaveTextContent('0 / 11 picked');
  });

  it('moves a player rather than duplicating them', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Raphinha is listed for both wings, so he is eligible for either slot.
    await assignViaModal(user, /Empty LW/, 'raphinha', 'Raphinha');
    await assignViaModal(user, /Empty RW/, 'raphinha', 'Raphinha');

    expect(screen.getByTestId('slot-lw')).toHaveAttribute('data-filled', 'false');
    expect(screen.getByTestId('slot-rw')).toHaveAttribute('data-filled', 'true');
    expect(screen.getByTestId('lineup-counter')).toHaveTextContent('1 / 11 picked');
  });

  it('keeps compatible players when the formation changes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await assignViaModal(user, /Empty GK/, 'alisson', 'Alisson');
    await user.selectOptions(screen.getByLabelText('Formation'), '4-4-2');

    expect(screen.getByTestId('slot-gk')).toHaveAttribute('data-filled', 'true');
    expect(screen.getByText('Alisson')).toBeInTheDocument();
  });

  it('shows the formation-specific slots after a change', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText('Formation'), '5-3-2');

    expect(screen.getByTestId('slot-lwb')).toBeInTheDocument();
    expect(screen.queryByTestId('slot-lw')).not.toBeInTheDocument();
  });

  it('recolours the whole team when a custom theme is applied', async () => {
    const user = userEvent.setup();
    render(<App />);

    await assignViaModal(user, /Empty GK/, 'alisson', 'Alisson');
    await assignViaModal(user, /Empty ST/, 'haaland', 'Erling Haaland');

    const shirtOf = (slotId: string) =>
      screen.getByTestId(`slot-${slotId}`).querySelector('[data-kit-shirt]')!;

    // Club mode: Liverpool red and Man City sky blue differ.
    expect(shirtOf('gk').getAttribute('data-kit-shirt')).toBe('#c8102e');
    expect(shirtOf('st1').getAttribute('data-kit-shirt')).toBe('#6cabdd');

    await user.click(screen.getByRole('button', { name: 'Apply Monochrome kit' }));

    // Custom mode: both wear the theme.
    expect(shirtOf('gk').getAttribute('data-kit-shirt')).toBe('#18181b');
    expect(shirtOf('st1').getAttribute('data-kit-shirt')).toBe('#18181b');
  });

  it('restores club colours when switching back', async () => {
    const user = userEvent.setup();
    render(<App />);

    await assignViaModal(user, /Empty GK/, 'alisson', 'Alisson');
    await user.click(screen.getByRole('button', { name: 'Apply Monochrome kit' }));
    await user.click(screen.getByRole('radio', { name: 'Club kits' }));

    expect(
      screen
        .getByTestId('slot-gk')
        .querySelector('[data-kit-shirt]')!
        .getAttribute('data-kit-shirt'),
    ).toBe('#c8102e');
  });

  it('requires a name before saving', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: /Save lineup/ })).toBeDisabled();
  });

  it('saves a named lineup and lists it', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Lineup name'), 'My Dream XI');
    await assignViaModal(user, /Empty GK/, 'alisson', 'Alisson');
    await user.click(screen.getByRole('button', { name: /Save lineup/ }));

    await waitFor(() => expect(fake.created).toHaveLength(1));
    expect(fake.created[0]).toMatchObject({
      name: 'My Dream XI',
      formationId: '4-3-3',
      assignments: { gk: 'liv-alisson' },
      kitMode: 'club',
      customKit: null,
    });

    expect(await screen.findByRole('button', { name: /^My Dream XI/ })).toBeInTheDocument();
  });

  it('sends the custom kit when one is in use', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Lineup name'), 'Themed XI');
    await user.click(screen.getByRole('button', { name: 'Apply Monochrome kit' }));
    await user.click(screen.getByRole('button', { name: /Save lineup/ }));

    await waitFor(() => expect(fake.created).toHaveLength(1));
    expect(fake.created[0]!.kitMode).toBe('custom');
    expect(fake.created[0]!.customKit).toMatchObject({ shirt: '#18181b' });
  });

  it('loads a saved lineup back onto the pitch', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Lineup name'), 'Reload Me');
    await assignViaModal(user, /Empty GK/, 'alisson', 'Alisson');
    await user.selectOptions(screen.getByLabelText('Formation'), '4-4-2');
    await user.click(screen.getByRole('button', { name: /^Save/ }));

    await waitFor(() => expect(fake.created).toHaveLength(1));

    // Start fresh, then load it back.
    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.getByLabelText('Lineup name')).toHaveValue('');

    await user.click(await screen.findByRole('button', { name: /^Reload Me/ }));

    await waitFor(() => expect(screen.getByLabelText('Lineup name')).toHaveValue('Reload Me'));
    expect(screen.getByLabelText('Formation')).toHaveValue('4-4-2');
    expect(screen.getByText('Alisson')).toBeInTheDocument();
  });

  it('updates an existing lineup instead of creating a duplicate', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Lineup name'), 'Edit Me');
    await user.click(screen.getByRole('button', { name: /Save lineup/ }));
    await waitFor(() => expect(fake.created).toHaveLength(1));

    await assignViaModal(user, /Empty GK/, 'alisson', 'Alisson');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() =>
      expect(fake.lineups.get('lineup-1')!.assignments).toEqual({ gk: 'liv-alisson' }),
    );
    expect(fake.created).toHaveLength(1); // still only one POST
  });

  it('deletes a saved lineup', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Lineup name'), 'Delete Me');
    await user.click(screen.getByRole('button', { name: /Save lineup/ }));

    const entry = await screen.findByRole('button', { name: /Delete Delete Me/ });
    await user.click(entry);

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Delete Me/ })).not.toBeInTheDocument(),
    );
  });

  it('surfaces a server error instead of failing silently', async () => {
    const user = userEvent.setup();
    fake.fetchMock.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Invalid lineup', issues: [] }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    });

    render(<App />);
    await user.type(screen.getByLabelText('Lineup name'), 'Doomed');
    await user.click(screen.getByRole('button', { name: /Save lineup/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid lineup/);
  });

  it('reports players who could not be re-seated after a formation change', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText('Formation'), '3-4-3');
    await assignViaModal(user, /Empty LW/, 'kvara', 'Khvicha Kvaratskhelia');
    await assignViaModal(user, /Empty RW/, 'salah', 'Mohamed Salah');
    await assignViaModal(user, /Empty ST/, 'haaland', 'Erling Haaland');
    expect(screen.getByTestId('lineup-counter')).toHaveTextContent('3 / 11 picked');

    // 4-1-4-1 has one striker slot and no wings, so not all three forwards can stay.
    await user.selectOptions(screen.getByLabelText('Formation'), '4-1-4-1');

    const notice = screen.getByTestId('remap-notice');
    expect(notice).toHaveTextContent(/returned to the player list/);
    // Whoever was dropped is named, so nobody disappears without explanation.
    expect(notice.textContent).toMatch(/Kvaratskhelia|Salah|Haaland/);

    await user.click(within(notice).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('remap-notice')).not.toBeInTheDocument();
  });
});
