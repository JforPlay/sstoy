import { describe, expect, it } from 'vitest';
import { createCombatRuntime, type CombatScenario } from '../core/combat-runtime';
import { withNormalDodgeCancel } from '../core/combat-normal-cancel';

function fixture(): CombatScenario {
  const phases = [{ time: 0, execute: 0, break: 0, executeSkills: [], breakSkills: [] },
    { time: .6, execute: 255, break: 255, executeSkills: [], breakSkills: [] }];
  return { fps: 60, actors: [{ id: 'a', main: true, spCapacity: 100000, efficiency: 1 }],
    actions: [
      { id: 'a:normal', actor: 'a', flag: 2, automatic: true, cooldown: 0, cooldownTiming: 'start',
        spCost: 0, skillKey: null, spBudget: null, combo: { duration: 1, activationEnd: .8, phases,
          events: [{ time: .5, occurrence: 0, event: { skinId: 1, index: 0, type: 1, name: '', tag: '', hitDamageId: 1,
            startSeconds: .5, endSeconds: .5, damageDetectIntervalSeconds: 0 } }] } },
      { id: 'a:dodge', actor: 'a', flag: 16, automatic: true, cooldown: 3, cooldownTiming: 'start',
        spCost: 0, skillKey: null, spBudget: null, combo: { duration: .2, activationEnd: .2, phases: [], events: [] } },
    ], automatic: () => 'a:normal',
    onEvent(_state, event, api) { if (event.kind === 'combo') api.damage(100); },
    onActionEnd(state, action) { if (action.flag === 2) state.script.stage = Number(state.script.stage ?? 0) + 1; },
  };
}

describe('native-window normal dodge cancel', () => {
  it('waits for native permission, preserves hits and respects recovery', () => {
    const model = createCombatRuntime(withNormalDodgeCancel(fixture(), 1));
    let state = model.advance(model.initial(), .59).state;
    expect(state.counts['a:dodge']).toBeUndefined();
    expect(state.damage).toBe(100);
    state = model.advance(state, .61).state;
    expect(state.counts['a:dodge']).toBe(1);
    expect(state.script.stage).toBe(1);
    state = model.advance(state, 3.59).state;
    expect(state.counts['a:dodge']).toBe(1);
    expect(state.damage).toBeGreaterThanOrEqual(300);
  });
  it('counts normal actions rather than damage pellets', () => {
    const model = createCombatRuntime(withNormalDodgeCancel(fixture(), 2));
    const state = model.advance(model.initial(), 1).state;
    expect(state.counts['a:dodge']).toBeUndefined();
  });
  it('does not invent a dodge or discard native automation', () => {
    const data = fixture(); data.actions.pop();
    expect(withNormalDodgeCancel(data, 1)).toBe(data);
    const native = fixture(); native.automatic = () => 'a:dodge';
    expect(createCombatRuntime(withNormalDodgeCancel(native, 4)).advance(
      createCombatRuntime(native).initial(), .1).state.counts['a:dodge']).toBe(1);
  });
  it('rejects invalid intervals', () => {
    expect(() => withNormalDodgeCancel(fixture(), 0)).toThrow();
  });
});
