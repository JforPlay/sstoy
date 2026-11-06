/** Pure, deterministic candidate search. Character rules must be supplied separately.
 * Waiting remains a branch even when actions are ready. No greedy cooldown policy.
 * This does NOT supply missing game timings, energy rules, hit counts or score formulas.
 */
export interface RotationNode<T> { state: T; time: number; damage: number; trace: RotationDecision[] }
export interface RotationDecision { time: number; action: string }
export interface RotationModel<T> {
  initial(): T;
  /** Advance exactly to time, resolving scheduled hits/expirations before decisions. */
  advance(state: T, time: number): { state: T; damage: number };
  /** Includes only legal actions: cooldown, energy, animation lock, etc. */
  actions(state: T, time: number): string[];
  /** Must return a new state; sibling branches must never share mutable state. */
  cast(state: T, action: string, time: number): { state: T; damage: number };
  /** Canonical combat-state key including future hits, timers, stacks and resources. */
  key(state: T): string;
  /** Optional pruning heuristic; final ranking always uses accumulated damage. */
  priority?(node: RotationNode<T>): number;
}
export interface RotationSearchOptions { duration: number; interval: number; width: number; top: number }
export interface RotationSearchResult<T> {
  candidates: RotationNode<T>[];
  explored: number;
  interval: number;
  exhaustive: false;
  /** No inferred conversion from damage to a raid score. */
  raidScore: null;
}

export function searchRotations<T>(model: RotationModel<T>, options: RotationSearchOptions): RotationSearchResult<T> {
  const { duration, interval, width, top } = options;
  if (![duration, interval, width, top].every(Number.isFinite) || duration <= 0 || interval <= 0 || !Number.isInteger(width) || !Number.isInteger(top) || width < 1 || top < 1 || top > width) throw new Error('Invalid rotation search options');
  let beam: RotationNode<T>[] = [{ state: model.initial(), time: 0, damage: 0, trace: [] }];
  let explored = 0;
  const steps = Math.ceil(duration / interval);
  for (let tick = 0; tick < steps; tick++) {
    const time = tick * interval;
    const nextTime = Math.min(duration, (tick + 1) * interval);
    const choices = new Map<string, RotationNode<T>>();
    for (const node of beam) {
      const current = model.advance(node.state, time);
      // Null means hold. Deliberate waits are never removed by cooldown availability.
      for (const action of [null, ...model.actions(current.state, time)]) {
        const cast = action === null ? { state: current.state, damage: 0 } : model.cast(current.state, action, time);
        const advanced = model.advance(cast.state, nextTime);
        const candidate = { state: advanced.state, time: nextTime, damage: node.damage + current.damage + cast.damage + advanced.damage,
          trace: action === null ? node.trace : [...node.trace, { time, action }] };
        if (!Number.isFinite(candidate.damage)) throw new Error('Non-finite rotation damage');
        explored++;
        const key = model.key(candidate.state);
        const previous = choices.get(key);
        if (!previous || candidate.damage > previous.damage) choices.set(key, candidate);
      }
    }
    const rank = model.priority || ((node: RotationNode<T>) => node.damage);
    beam = [...choices.values()].sort((a, b) => rank(b) - rank(a) || b.damage - a.damage).slice(0, width);
  }
  return { candidates: beam.sort((a, b) => b.damage - a.damage).slice(0, top), explored, interval, exhaustive: false, raidScore: null };
}
