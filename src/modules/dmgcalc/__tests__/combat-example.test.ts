import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadExampleCombatTables } from '../core/combat-data';
import { createExampleCombatModel } from '../core/combat-example-model';
import { evaluateCombatPolicies } from '../core/combat-policy-search';
import { optimizeExampleCycles } from '../core/combat-optimizer';
const read = async (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
const example = JSON.parse(readFileSync('public/guides/rotation-example.json', 'utf8'));

describe('full example combat integration', () => {
  it('runs all three actors for 180 seconds with actual SP and cooldown legality', async () => {
    const tables = await loadExampleCombatTables(read);
    const { model, boss } = createExampleCombatModel(example, tables, { boss: 27, distance: 2, cinematics: true });
    const [result] = evaluateCombatPolicies(model, [{ name: 'ready', choose: (_state, legal) => legal.find(id => id.includes('ultimate')) ?? legal[0] ?? null }], 180, 60, boss.switchRate);
    expect(result!.state.tick).toBe(10800);
    expect(result!.damage).toBeGreaterThan(0);
    for (const actor of ['162', '115', '107']) expect(result!.trace.some(entry => entry.action.startsWith(actor + ':'))).toBe(true);
    for (const pool of Object.values(result!.state.sp.ledger.pools)) expect(pool.value).toBeGreaterThanOrEqual(0);
    expect(result!.damageScore).toBe(Math.floor(result!.damage / 25000));
  }, 120000);
  it.each([26, 27, 28, 29])('also runs boss %s with cinematics disabled', async bossId => {
    const tables = await loadExampleCombatTables(read);
    const { model, boss } = createExampleCombatModel(example, tables, { boss: bossId, distance: 2, cinematics: false });
    const [result] = evaluateCombatPolicies(model, [{ name: 'ready', choose: (_state, legal) => legal.find(id => id.includes('ultimate')) ?? legal[0] ?? null }], 180, 60, boss.switchRate);
    expect(result!.state.counts['115:ultimate']).toBeGreaterThan(0);
    expect(result!.state.counts['107:ultimate']).toBeGreaterThan(0);
    expect(result!.damage).toBeGreaterThan(0);
  });
  it('searches expanded holds and replays the top five with legal SP', async () => {
    const tables = await loadExampleCombatTables(read);
    const result = optimizeExampleCycles(example, tables, { boss: 27, distance: 2, cinematics: true });
    expect(result.tested).toBe(90);
    expect(result.candidates).toHaveLength(5);
    expect(result.candidates[0]!.damageScore).toBeGreaterThanOrEqual(result.baseline);
    for (const candidate of result.candidates) {
      for (const cast of candidate.casts) {
        expect(cast.sp).toBeGreaterThanOrEqual(cast.requiredSp);
        expect(cast.time).toBeLessThan(180);
      }
      expect(candidate.casts.filter(cast => cast.action.startsWith('115:')).length).toBeGreaterThan(0);
      expect(candidate.casts.filter(cast => cast.action.startsWith('107:')).length).toBeGreaterThan(0);
      expect(candidate.actions.some(action=>action.automatic&&action.flag===2)).toBe(true);
      expect(candidate.actions.every(action=>action.end>=action.time&&action.end<=180)).toBe(true);
    }
  }, 120000);
});
