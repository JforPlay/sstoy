import { describe, expect, it } from 'vitest';
import { activateSkillSpBudget, tickSkillSpBudget, creditCombatHitSp, type CombatHitSpState, type CombatSpRecipient } from '../core/rotation-sp';
import { addRaidDamage, createRaidScore, finishRaidHpLevel, getRaidScore, setRaidTechnicalScore } from '../core/raid-score';

describe('recovered client raid rules', () => {
  it('floors cumulative damage, not each individual hit', () => {
    let score = createRaidScore();
    score = addRaidDamage(score, 6000, 10000);
    score = addRaidDamage(score, 6000, 10000);
    expect(getRaidScore(score)).toBe(1);
    score = finishRaidHpLevel(score);
    score = addRaidDamage(score, 9000, 10000);
    score = setRaidTechnicalScore(score, 5400);
    expect(getRaidScore(score)).toBe(5401);
  });
  it('overlapping skill activations add to a shared ten-second budget', () => {
    const first = activateSkillSpBudget({ collected: 30000, maximum: 40000, delta: 40000, expiresAt: [10] }, 5);
    expect(first.maximum).toBe(80000);
    expect(tickSkillSpBudget(first, 10)).toBe(first);
    const expired = tickSkillSpBudget(first, 10.001);
    expect(expired).toMatchObject({ collected: 0, maximum: 40000, expiresAt: [15] });
  });
  it('applies the hit budget before distributing SP and deduplicates an attack across targets', () => {
    const pool = () => ({ value: 0, capacity: 3000000, spent: 0, gained: 0, overflow: 0 });
    const original: CombatHitSpState = { ledger: { pools: { main: pool(), a: pool(), b: pool() }, castGains: {} },
      budgets: { skill: { collected: 9000, maximum: 10000, delta: 10000, expiresAt: [10] } }, creditedAttackIds: {} };
    const recipients: CombatSpRecipient[] = [
      { pool: 'main', role: 'main', efficiency: 1.3, alive: true, recoveryBlocked: false },
      { pool: 'a', role: 'support', efficiency: 1.15, alive: true, recoveryBlocked: false },
      { pool: 'b', role: 'support', efficiency: .75, alive: true, recoveryBlocked: true },
    ];
    const hit = creditCombatHitSp(original, 'attack-1', 'skill', 23500, recipients);
    expect(hit.ledger.pools.main!.value).toBe(1300);
    expect(hit.ledger.pools.a!.value).toBe(1150);
    expect(hit.ledger.pools.b!.value).toBe(0);
    expect(hit.budgets.skill!.collected).toBe(10000);
    expect(creditCombatHitSp(hit, 'attack-1', 'skill', 23500, recipients)).toBe(hit);
    expect(original.budgets.skill!.collected).toBe(9000);
  });
});
