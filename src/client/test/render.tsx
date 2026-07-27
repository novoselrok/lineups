import { DndContext } from '@dnd-kit/core';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { CLUBS, PLAYERS } from '../../data/index';
import { clubsToMap } from '../../shared/kits';

export const clubsById = clubsToMap(CLUBS);
export const playersById = new Map(PLAYERS.map((p) => [p.id, p]));

/** Components that use dnd-kit hooks need a DndContext ancestor. */
function Wrapper({ children }: { children: ReactNode }) {
  return <DndContext>{children}</DndContext>;
}

export function renderWithDnd(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: Wrapper, ...options });
}

export { PLAYERS, CLUBS };
