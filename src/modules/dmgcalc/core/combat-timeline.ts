import type {CombatRootMotion} from './combat-root-motion';
/** Combo event scheduling, separate from character event handlers. Event type
 * matters: a visual/custom event's unused hitDamageId is never a damage hit.
 */
interface Fixed { _serializedValue: number }
interface Phase {
  activeNormalizedTime: Fixed;
  autoGenerateForAnticipation: number;
  autoGenerateForActivation: number;
  autoGenerateForRecovery: number;
  skillPhaseConfig: {
    _executeSkillPhaseConfig: { skillPhaseFeatureFlag: number; skillIds: number[] };
    _breakSkillPhaseConfig: { skillPhaseFeatureFlag: number; skillIds: number[] };
  };
}
export interface CombatTimelineEvent {
  skinId: number; index: number; type: number; name: string; tag: string; hitDamageId: number;
  startSeconds: number; endSeconds: number; damageDetectIntervalSeconds: number;
  group?:number;playOnceInLoopMode?:boolean;clipPreconditionType?:number;preconditionClip?:{m_PathID:string};
  reduceAmmoCount?:number;
  triggerFateCardTheme?:boolean;
  normalAttackTriggerForFateCard?:boolean;dodgeTriggerForFateCard?:boolean;
  skillTriggerForFateCard?:boolean;ultimateTriggerForFateCard?:boolean;
  hitGeometryRaw?:Record<string,unknown>;
  areaEffectPrefab?:{m_PathID:string};
}
export interface CombatTimeline {
  name: string; pathId: string; animationDurationSeconds: number; playSpeed: number;
  sourceAnimationDurationSeconds?: number | null;
  events: CombatTimelineEvent[]; featurePhasesRaw: Phase[];
  phaseRangeRaw: { x: Fixed; y: Fixed };
  rootMotionRaw?:CombatRootMotion;
}
export interface CompiledComboEvent { time: number; event: CombatTimelineEvent; occurrence: number }
export interface CompiledCombo {
  sourcePathId?:string;loop?:boolean;eventGroup?:number;
  translation?:{offset:number;duration:number;speed:number;motion:CombatRootMotion}[];
  duration: number;
  anticipationEnd?: number;
  activationEnd: number;
  phases: { time: number; execute: number; break: number; executeSkills: number[]; breakSkills: number[] }[];
  events: CompiledComboEvent[];
}
const fixed = (value: Fixed) => value._serializedValue / 4294967296;
export function compileCombo(timeline: CombatTimeline, normalAttack: boolean, attackSpeed: number,
  skinId: number, defaultHitInterval: number, logicFps = 60, comboSpeedMultiplier = 1,eventGroup=0): CompiledCombo {
  if (![attackSpeed, defaultHitInterval, logicFps, comboSpeedMultiplier].every(Number.isFinite)
    || attackSpeed <= 0 || defaultHitInterval <= 0 || logicFps <= 0 || timeline.playSpeed <= 0) throw new Error('Invalid combo timing');
  const runtimeSpeed = Math.min(5, Math.max(.2, (normalAttack ? attackSpeed : 1) * comboSpeedMultiplier));
  const duration = timeline.animationDurationSeconds / timeline.playSpeed / runtimeSpeed;
  const tick = (seconds: number) => Math.ceil((seconds - 1e-9) * logicFps) / logicFps;
  const selectedEvents=timeline.events.filter(event=>(event.group ?? 0)===eventGroup);
  const skins = [...new Set(selectedEvents.map(event => event.skinId))];
  const selectedSkin = skins.includes(skinId) ? skinId : skins[0];
  const events: CompiledComboEvent[] = [];
  for (const event of selectedEvents.filter(event => event.skinId === selectedSkin)) {
    const start = tick(event.startSeconds / runtimeSpeed);
    const end = tick(event.endSeconds / runtimeSpeed);
    if (event.type !== 1 || event.endSeconds <= event.startSeconds) {
      events.push({ time: start, event, occurrence: 0 });
      continue;
    }
    // The client advances at most one detection index on each logic tick. The
    // interval is expressed on the unscaled animation timeline, not wall time.
    const interval = (event.damageDetectIntervalSeconds || defaultHitInterval) / timeline.playSpeed / runtimeSpeed;
    let occurrence = 0;
    for (let frame = Math.round(start * logicFps); frame <= Math.round(end * logicFps); frame++) {
      const time = frame / logicFps;
      const unquantizedStart = event.startSeconds / runtimeSpeed;
      const progress = Math.min(time, event.endSeconds / runtimeSpeed) - unquantizedStart;
      if (occurrence <= Math.floor((progress + 1e-9) / interval)) {
        events.push({ time, event, occurrence: occurrence++ });
      }
    }
  }
  const framePhases = new Map<number, Phase>();
  for (const phase of timeline.featurePhasesRaw) {
    const frame = Math.round(fixed(phase.activeNormalizedTime) * (timeline.sourceAnimationDurationSeconds ?? timeline.animationDurationSeconds) * 60);
    const prior = framePhases.get(frame);
    const custom = !phase.autoGenerateForAnticipation && !phase.autoGenerateForActivation && !phase.autoGenerateForRecovery;
    const priorAuto = prior && (prior.autoGenerateForAnticipation || prior.autoGenerateForActivation || prior.autoGenerateForRecovery);
    if (!prior || (priorAuto && custom)) framePhases.set(frame, phase);
  }
  return {
    sourcePathId:timeline.pathId,eventGroup,
    translation:timeline.rootMotionRaw?.enableRootMotion?[{offset:0,duration,speed:timeline.playSpeed*runtimeSpeed,motion:timeline.rootMotionRaw}]:undefined,
    duration: tick(duration), anticipationEnd: tick(fixed(timeline.phaseRangeRaw.x) * duration), activationEnd: tick(fixed(timeline.phaseRangeRaw.y) * duration),
    events: events.sort((a, b) => a.time - b.time || a.event.index - b.event.index),
    phases: [...framePhases.values()].map(phase => ({ time: tick(fixed(phase.activeNormalizedTime) * duration),
      execute: phase.skillPhaseConfig._executeSkillPhaseConfig.skillPhaseFeatureFlag,
      break: phase.skillPhaseConfig._breakSkillPhaseConfig.skillPhaseFeatureFlag,
      executeSkills: phase.skillPhaseConfig._executeSkillPhaseConfig.skillIds,
      breakSkills: phase.skillPhaseConfig._breakSkillPhaseConfig.skillIds,
    })).sort((a, b) => a.time - b.time),
  };
}
/** Compose scripted clip transitions without re-casting the skill or granting
 * its SP budget again. The first clip may end at its activation-end callback. */
export function chainCombatCombos(parts: { combo: CompiledCombo; until?: number }[]): CompiledCombo {
  if (!parts.length) throw new Error('Empty combat combo chain');
  let offset = 0;
  const events: CompiledComboEvent[] = [];
  const phases: CompiledCombo['phases'] = [];
  const completedOnceEvents=new Set<string>();
  const translation:NonNullable<CompiledCombo['translation']>=[];
  let anticipationEnd = 0, activationEnd = 0;
  for (let index = 0; index < parts.length; index++) {
    const { combo, until = combo.duration } = parts[index]!;
    if (!Number.isFinite(until) || until < 0 || until > combo.duration) throw new Error('Invalid combo segment endpoint');
    for(const track of combo.translation ?? []) if(track.offset<until)
      translation.push({...track,offset:offset+track.offset,duration:Math.min(track.duration,until-track.offset)});
    const seenThisPart=new Set<string>();
    for (const event of combo.events) if (event.time <= until + 1e-9) {
      const key=`${combo.sourcePathId}:${combo.eventGroup ?? 0}:${event.event.skinId}:${event.event.index}`;
      if(combo.loop && event.event.playOnceInLoopMode) {
        if(completedOnceEvents.has(key)) continue;
        seenThisPart.add(key);
      }
      events.push({ ...event, time: offset + event.time });
    }
    for(const key of seenThisPart) completedOnceEvents.add(key);
    for (const phase of combo.phases) if (phase.time <= until + 1e-9) phases.push({ ...phase, time: offset + phase.time });
    if (index === 0) anticipationEnd = combo.anticipationEnd ?? 0;
    activationEnd = offset + combo.activationEnd;
    offset += until;
  }
  return { duration: offset, anticipationEnd, activationEnd, events, phases,translation:translation.length?translation:undefined };
}
export function comboAllows(combo: CompiledCombo, elapsed: number, flag: number, skillId?: number): boolean {
  if (elapsed >= combo.duration) return true;
  const phase = combo.phases.filter(item => item.time <= elapsed + 1e-9).at(-1);
  if (!phase || !(phase.execute & flag) || !(phase.break & flag)) return false;
  return skillId === undefined || (!(flag & 64) || (phase.executeSkills.includes(skillId) && phase.breakSkills.includes(skillId)));
}
