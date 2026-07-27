import type { Catalog, Lineup, LineupInput, LineupSummary } from '../shared/types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json', ...init.headers } : init?.headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.error ?? `Request failed with ${response.status}`,
      response.status,
      body?.issues ?? [],
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  getCatalog: () => request<Catalog>('/catalog'),
  listLineups: () => request<LineupSummary[]>('/lineups'),
  getLineup: (id: string) => request<Lineup>(`/lineups/${id}`),
  createLineup: (input: LineupInput) =>
    request<Lineup>('/lineups', { method: 'POST', body: JSON.stringify(input) }),
  updateLineup: (id: string, input: LineupInput) =>
    request<Lineup>(`/lineups/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteLineup: (id: string) => request<void>(`/lineups/${id}`, { method: 'DELETE' }),
};
