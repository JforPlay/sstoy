/** SP accounting for timeline models. Values retain the game's raw units.
 * The caller resolves efficiency/collection modifiers according to verified rules;
 * this ledger does not assume that EnergyConvRatio is a universal gain multiplier.
 */
export interface SpPool { value: number; capacity: number; spent: number; gained: number; overflow: number }
export interface SpLedger { pools: Record<string, SpPool>; castGains: Record<string, number> }
export interface SpGain {
  pool: string;
  /** Post-modifier amount, not damage and not a percent of damage. */
  amount: number;
  /** One activation key shared by all hits belonging to that cast. */
  castKey?: string;
  /** Post-modifier cap for the same activation, if the game rule supplies one. */
  castCap?: number;
}
export function creditSp(ledger: SpLedger, gain: SpGain): SpLedger {
  const pool = ledger.pools[gain.pool];
  if (!pool || !Number.isFinite(gain.amount) || gain.amount < 0 || (gain.castCap !== undefined && (!gain.castKey || !Number.isFinite(gain.castCap) || gain.castCap < 0))) throw new Error('Invalid SP gain');
  const key = gain.castKey === undefined ? undefined : `${gain.pool}:${gain.castKey}`;
  const collected = key === undefined ? 0 : ledger.castGains[key] || 0;
  const allowed = Math.min(gain.amount, gain.castCap === undefined ? Infinity : Math.max(0, gain.castCap - collected));
  const accepted = Math.min(allowed, Math.max(0, pool.capacity - pool.value));
  return {
    pools: { ...ledger.pools, [gain.pool]: { ...pool, value: pool.value + accepted, gained: pool.gained + accepted, overflow: pool.overflow + allowed - accepted } },
    // SP lost at capacity still counts against that cast's collection limit.
    castGains: key === undefined ? ledger.castGains : { ...ledger.castGains, [key]: collected + allowed },
  };
}
export type UltimateBlock = 'cooldown' | 'sp' | 'animation';
export function ultimateBlockReason(ledger: SpLedger, poolId: string, cost: number, time: number, readyAt: number, lockedUntil: number): UltimateBlock | null {
  if (![cost, time, readyAt, lockedUntil].every(Number.isFinite) || cost < 0 || !ledger.pools[poolId]) throw new Error('Invalid ultimate constraints');
  if (time < lockedUntil) return 'animation';
  if (time < readyAt) return 'cooldown';
  return ledger.pools[poolId]!.value < cost ? 'sp' : null;
}
export function spendUltimateSp(ledger: SpLedger, poolId: string, cost: number): SpLedger {
  const pool = ledger.pools[poolId];
  if (!pool || !Number.isFinite(cost) || cost < 0 || pool.value < cost) throw new Error('Insufficient SP');
  return { ...ledger, pools: { ...ledger.pools, [poolId]: { ...pool, value: pool.value - cost, spent: pool.spent + cost } } };
}

/** AdventureSkill begins an ultimate by setting its pool to zero. A larger
 * capacity does not leave a remainder, even if the availability cost is lower. */
export function clearUltimateSp(ledger: SpLedger, poolId: string, cost: number): SpLedger {
  const pool = ledger.pools[poolId];
  if (!pool || !Number.isFinite(cost) || cost < 0 || pool.value < cost) throw new Error('Insufficient SP');
  return { ...ledger, pools: { ...ledger.pools, [poolId]: { ...pool, value: 0, spent: pool.spent + pool.value } } };
}

/** Recovered from PlayerSkillCd / AdventurePlayerController in the installed
 * 2026-11 client. A skill has a rolling budget, NOT an isolated per-cast cap.
 * All amounts below retain table raw units (SP * 10000).
 */
export interface SkillSpBudget {
  collected: number;
  maximum: number;
  delta: number;
  expiresAt: number[];
}
export function activateSkillSpBudget(budget: SkillSpBudget, time: number, lifetime = 10): SkillSpBudget {
  if (![time, lifetime, budget.delta].every(Number.isFinite) || lifetime <= 0 || budget.delta < 0) throw new Error('Invalid SP budget');
  return { ...budget, maximum: budget.maximum + budget.delta, expiresAt: [...budget.expiresAt, time + lifetime] };
}
/** One client logic tick expires at most one grant, strictly after its deadline. */
export function tickSkillSpBudget(budget: SkillSpBudget, time: number): SkillSpBudget {
  if (!budget.expiresAt.length || time <= budget.expiresAt[0]!) return budget;
  return { ...budget, collected: Math.max(0, budget.collected - budget.delta), maximum: Math.max(0, budget.maximum - budget.delta), expiresAt: budget.expiresAt.slice(1) };
}
export interface CombatSpRecipient {
  pool: string;
  role: 'main' | 'support';
  /** Resolved player FRONT_ADD_ENERGY (main) or ADD_ENERGY (support). */
  efficiency: number;
  alive: boolean;
  recoveryBlocked: boolean;
}
export interface CombatHitSpState {
  ledger: SpLedger;
  budgets: Record<string, SkillSpBudget>;
  creditedAttackIds: Record<string, true>;
}
export function creditCombatHitSp(state: CombatHitSpState, attackId: string, sourceSkillKey: string | null,
  rawEnergy: number, recipients: CombatSpRecipient[]): CombatHitSpState {
  if (!Number.isFinite(rawEnergy) || rawEnergy < 0 || !attackId || recipients.some(r => !Number.isFinite(r.efficiency) || r.efficiency < 0)) throw new Error('Invalid hit SP');
  if (state.creditedAttackIds[attackId]) return state;
  const budget = sourceSkillKey === null ? undefined : state.budgets[sourceSkillKey];
  const allowed = budget ? Math.min(budget.maximum - budget.collected, rawEnergy) : rawEnergy;
  if (allowed < 0) throw new Error('SP budget collected exceeds maximum');
  let ledger = state.ledger;
  for (const recipient of recipients) {
    if (recipient.alive && !recipient.recoveryBlocked) ledger = creditSp(ledger, { pool: recipient.pool, amount: allowed * recipient.efficiency });
  }
  return { ledger, creditedAttackIds: { ...state.creditedAttackIds, [attackId]: true },
    budgets: budget && sourceSkillKey !== null ? { ...state.budgets, [sourceSkillKey]: { ...budget, collected: budget.collected + allowed } } : state.budgets };
}
