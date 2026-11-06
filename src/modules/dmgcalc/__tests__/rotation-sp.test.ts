import { describe, expect, it } from 'vitest';
import { creditSp, spendUltimateSp, ultimateBlockReason, type SpLedger } from '../core/rotation-sp';
const initial = (): SpLedger => ({ pools: { main: { value: 0, capacity: 100, gained: 0, spent: 0, overflow: 0 } }, castGains: {} });
describe('timeline SP ledger (synthetic raw-unit fixtures)', () => {
  it('requires both cooldown and SP; being ready is not enough', () => {
    const ledger = creditSp(initial(), { pool: 'main', amount: 70 });
    expect(ultimateBlockReason(ledger, 'main', 100, 40, 30, 0)).toBe('sp');
    const full = creditSp(ledger, { pool: 'main', amount: 30 });
    expect(ultimateBlockReason(full, 'main', 100, 20, 30, 0)).toBe('cooldown');
    expect(ultimateBlockReason(full, 'main', 100, 40, 30, 41)).toBe('animation');
    expect(ultimateBlockReason(full, 'main', 100, 40, 30, 40)).toBeNull();
    expect(spendUltimateSp(full, 'main', 100).pools.main!.value).toBe(0);
  });
  it('limits a multi-hit cast and distinguishes the next cast', () => {
    let ledger = initial();
    for (let i = 0; i < 5; i++) ledger = creditSp(ledger, { pool: 'main', amount: 20, castKey: 'skill@0', castCap: 50 });
    expect(ledger.pools.main!.value).toBe(50);
    ledger = creditSp(ledger, { pool: 'main', amount: 20, castKey: 'skill@10', castCap: 50 });
    expect(ledger.pools.main!.value).toBe(70);
  });
  it('does not bank overflow at full SP for after the ultimate', () => {
    let ledger = creditSp(initial(), { pool: 'main', amount: 150, castKey: 'a', castCap: 200 });
    expect(ledger.pools.main!.overflow).toBe(50);
    ledger = spendUltimateSp(ledger, 'main', 100);
    ledger = creditSp(ledger, { pool: 'main', amount: 100, castKey: 'a', castCap: 200 });
    expect(ledger.pools.main!.value).toBe(50);
  });
  it('keeps sibling search branches independent', () => {
    const start = initial();
    creditSp(start, { pool: 'main', amount: 50 });
    expect(start.pools.main!.value).toBe(0);
  });
});
