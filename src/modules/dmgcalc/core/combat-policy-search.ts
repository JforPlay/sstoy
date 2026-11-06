import type { RotationDecision, RotationModel } from './rotation-search';
export interface CombatPolicy<T> { name: string; choose(state: T, legal: string[], time: number): string | null }
export interface CombatPolicyResult<T> { name: string; state: T; damage: number; damageScore: number; trace: RotationDecision[] }
/** Evaluate complete 180-second policies on the same runtime. A null choice is
 * a deliberate hold, not an error. Multiple independent actors may cast on the
 * same logic tick; animation legality is still enforced by the model.
 */
export function evaluateCombatPolicies<T>(model: RotationModel<T>, policies: CombatPolicy<T>[], duration: number,
  fps: number, switchRate: number, top = 5): CombatPolicyResult<T>[] {
  if (![duration, fps, switchRate, top].every(Number.isFinite) || duration <= 0 || fps < 1 || switchRate <= 0 || top < 1) throw new Error('Invalid policy search');
  const results: CombatPolicyResult<T>[] = [];
  const unique = new Set<string>();
  for (const policy of policies) {
    let state = model.initial(), damage = 0;
    const trace: RotationDecision[] = [];
    for (let tick = 0; tick < Math.ceil(duration * fps); tick++) {
      const time = tick / fps;
      const current = model.advance(state, time);
      state = current.state; damage += current.damage;
      const used = new Set<string>();
      for (let decision = 0; decision < 20; decision++) {
        const legal = model.actions(state, time).filter(action => !used.has(action));
        const action = policy.choose(state, legal, time);
        if (action === null) break;
        if (!legal.includes(action)) throw new Error(`Policy ${policy.name} chose illegal action ${action}`);
        used.add(action);
        const cast = model.cast(state, action, time);
        state = cast.state; damage += cast.damage;
        trace.push({ time, action });
      }
    }
    const end = model.advance(state, duration);
    state = end.state; damage += end.damage;
    const key = JSON.stringify(trace);
    if (unique.has(key)) continue;
    unique.add(key);
    results.push({ name: policy.name, state, damage, damageScore: Math.floor(damage / switchRate), trace });
  }
  return results.sort((a, b) => b.damage - a.damage).slice(0, top);
}
