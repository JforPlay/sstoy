import { comboAllows } from './combat-timeline';
import type { CombatScenario } from './combat-runtime';

/** A real dodge, never a zero-time reset. Character scripts retain ownership
 * of combo stages, ammo, buffs and end callbacks. No perfect-dodge is assumed. */
export function withNormalDodgeCancel(source: CombatScenario, every: number): CombatScenario {
  if (!Number.isInteger(every) || every < 1 || every > 4) throw new Error('Invalid normal cancel interval');
  const main = source.actors.find(actor => actor.main)?.id;
  const dodge = source.actions.find(action => action.actor === main && action.flag === 16);
  if (!dodge) return source;
  const counter = 'normal-cancel:sequence';
  return { ...source,
    onCast(state, action, api) {
      source.onCast?.(state, action, api);
      if (action.actor !== main) return;
      if (action.flag === 2) state.script[counter] = Number(state.script[counter] ?? 0) + 1;
      else state.script[counter] = 0;
    },
    automatic(state, actor, api) {
      const original = source.automatic?.(state, actor, api) ?? null;
      if (actor !== main || !original || source.actions.find(action => action.id === original)?.flag !== 2) return original;
      const motion = state.motions[actor];
      const action = motion && source.actions.find(entry => entry.id === motion.action);
      if (!motion || action?.flag !== 2 || Number(state.script[counter] ?? 0) < every) return original;
      const elapsed = (state.tick - motion.started) / source.fps;
      // Wait for every animation-bound event, including the last pellet or
      // custom projectile launch. Already launched projectiles stay alive.
      const lastEvent = Math.max(0, ...motion.combo.events.map(event => event.time));
      if (!motion.combo.events.length || elapsed + 1e-9 < lastEvent ||
        !comboAllows(motion.combo, elapsed, dodge.flag, dodge.skillKey ? Number(dodge.skillKey) : undefined) ||
        api.chargeCount(dodge.id) < 1 || (state.ready[dodge.cooldownKey ?? dodge.id] ?? 0) > state.tick ||
        (state.useReady?.[dodge.cooldownKey ?? dodge.id] ?? 0) > state.tick ||
        source.canCast?.(state, dodge, api) === false) return original;
      return dodge.id;
    },
  };
}
