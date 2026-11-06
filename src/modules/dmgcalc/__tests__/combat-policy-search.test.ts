import { describe, expect, it } from 'vitest';
import { evaluateCombatPolicies } from '../core/combat-policy-search';
import type { RotationModel } from '../core/rotation-search';
describe('complete-policy evaluation', () => {
  it('finds a support hold that beats using it immediately, across a full three-minute run', () => {
    type State = { time: number; main: number; support: number; buff: number };
    const model: RotationModel<State> = {
      initial: () => ({ time: 0, main: 3, support: 0, buff: 0 }),
      advance: (state, time) => ({ state: { ...state, time }, damage: 0 }),
      actions: (state, time) => [...(time >= state.main ? ['main'] : []), ...(time >= state.support ? ['support'] : [])],
      cast(state, action, time) {
        return action === 'support' ? { state: { ...state, support: time + 10, buff: time + 1 }, damage: 0 }
          : { state: { ...state, main: time + 10 }, damage: time < state.buff ? 300 : 100 };
      },
      key: JSON.stringify,
    };
    const result = evaluateCombatPolicies(model, [
      { name: 'immediate', choose: (_state, legal) => legal.includes('support') ? 'support' : legal[0] ?? null },
      { name: 'hold', choose: (state, legal, time) => legal.includes('support') && time >= state.main - .25 ? 'support' : legal.includes('main') ? 'main' : null },
    ], 180, 60, 100);
    expect(result[0]!.name).toBe('hold');
    expect(result[0]!.damage).toBe(5400);
    expect(result[0]!.damageScore).toBe(54);
    expect(result[0]!.trace.every(decision => decision.time < 180)).toBe(true);
  });
});
