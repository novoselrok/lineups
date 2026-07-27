import { describe, expect, it } from 'vitest';
import { getFormation } from './formations';

/**
 * Deliberately failing test, added to confirm CI actually goes red.
 *
 * Delete this file once the run has been checked — nothing else depends on it.
 */
describe('CI failure check', () => {
  it('fails on purpose so the pipeline reports a red build', () => {
    // 4-3-3 has eleven positions, like every formation. Asserting twelve fails.
    expect(getFormation('4-3-3').slots).toHaveLength(12);
  });
});
