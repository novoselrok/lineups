/**
 * TEMPORARY: a deliberately failing test used to verify that CI reports failures.
 * Delete this file once the CI check has been confirmed.
 */
import { describe, expect, it } from 'vitest';
import { CLUBS, PLAYERS } from './index';

describe('ci canary', () => {
  it('fails on purpose so the CI run goes red', () => {
    expect(CLUBS).toHaveLength(999);
  });

  it('fails a second time so the run reports two failures', () => {
    expect(PLAYERS.map((p) => p.name)).toContain('Nobody At All');
  });
});
