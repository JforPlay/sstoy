import { activateSkillSpBudget, clearUltimateSp, creditCombatHitSp, creditSp, tickSkillSpBudget,
  type CombatHitSpState, type CombatSpRecipient, type SpPool } from './rotation-sp';
import { comboAllows, type CompiledCombo, type CombatTimelineEvent } from './combat-timeline';
import type { RotationModel } from './rotation-search';
import type { CombatBuffState } from './combat-buffs';
import type { RaidBossState } from './combat-boss';
import type { RecordRuleState } from './combat-record-rules';
import type { ResolvedCombatAttributes } from './combat-effects';
import type { SeinaScriptState } from './combat-seina';
import type { HotaruScriptState } from './combat-hotaru';
import type { TiliaScriptState } from './combat-tilia';
import type { KasimiraSupportState } from './combat-kasimira';
import type { GrayState } from './combat-gray';
import type { CombatProcState } from './combat-procs';
import type { CombatPartyProcState } from './combat-proc-dispatch';
import type { CombatShieldState } from './combat-shields';

export interface CombatActorSpec { id: string; main: boolean; spCapacity: number; efficiency: number }
export interface CombatAction {
  id: string; actor: string; flag: number; cooldown: number; cooldownTiming: 'start' | 'end';
  cooldownKey?: string;
  charges?:number;
  useInterval?:number;
  spCost: number; skillKey: string | null; spBudget: number | null;
  combo: CompiledCombo; automatic?: boolean;
}
export interface RuntimeEvent {
  tick: number; sequence: number; kind: string; actor: string;
  /** Only animation-bound events are invalidated when an action is interrupted.
   * Already launched projectiles and independent areas have no token. */
  token?: number; action?: string; comboEvent?: CombatTimelineEvent;
  weaponId?:number;
  priority?:number;
  removeBuffsAfterHit?:{owner:string;id:number}[];
  additionalAttributes?:{id:number;count:number;source?:string}[];
  addBuffsAfterHit?:{owner:string;id:number}[];
  hitId?: number; energy?: number; skillKey?: string | null; data?: Record<string, number | string>;
  snapshot?: ResolvedCombatAttributes;
  scalingActor?:string;
  feature?: Record<string, any>;
  featureFlags?: number;
}
interface ActorMotion { action: string; token: number; started: number; ends: number; combo: CompiledCombo }
export interface CombatRuntimeState {
  tick: number; sequence: number; token: number; sp: CombatHitSpState;
  motions: Record<string, ActorMotion>; ready: Record<string, number>;
  /** Remaining logic ticks, independent of the wall clock while recovery is
   * paused by a native multi-stage skill. Keys match shared cooldown keys. */
  pausedCooldowns?:Record<string,number>;
  chargeRecovery?:Record<string,{value:number;maximum:number;period:number;next:number;paused?:number}>;
  useReady?:Record<string,number>;
  cooldownPeriods?:Record<string,number>;
  /** Native SaveGroupAttributeSnapshot: immutable, captured after initial
   * passives/record scripts, before the first combat action. */
  initialAttributes?:Record<string,ResolvedCombatAttributes>;
  summons?:Record<string,{owner:string;entity:number;alive:boolean;attributes:ResolvedCombatAttributes}>;
  queue: RuntimeEvent[];
  /** Character scripts store counters, timestamps, form and buff stacks here.
   * All entries are canonical numeric/string values for beam deduplication. */
  script: Record<string, number | string>;
  buffs: CombatBuffState;
  shields?:CombatShieldState;
  boss?: RaidBossState;
  records?: RecordRuleState;
  seina?: SeinaScriptState;
  hotaru?: HotaruScriptState;
  tilia?: TiliaScriptState;
  kasimira?: KasimiraSupportState;
  kasimiraShared?: { lastBreakthroughFour: number; procs?:CombatProcState };
  gray?: GrayState;
  procs?:CombatPartyProcState;
  supportScripts?:Record<string,Record<string,unknown>>;
  weaponSequence?:number;
  drops?:Record<number,{actor:string;name:string;created:number}>;
  dropSequence?:number;
  weapons?:Record<number,{actor:string;name:string;area:boolean;center:string;x?:number;z?:number;started?:number;expires:number;exit:{target:string;add:number[];remove:number[];key?:string}[];
    children?:number[];
    growth?:{interval:number;step:number;maximum:number};
    snapshot?:ResolvedCombatAttributes;
    finishAreas?:{name:string;x:number;z:number;angle:number}[]}>;
  damage: number;
  hits: number;
  counts: Record<string, number>;
  hitCounts?:Record<string,number>;
}
export interface CombatRuntimeApi {
  schedule(event: Omit<RuntimeEvent, 'sequence' | 'tick'>, delaySeconds: number): void;
  damage(value: number): void;
  directSp(actor: string, rawAmount: number): void;
  hitSp(event: RuntimeEvent, rawAmount: number): void;
  resetCooldown(action: string): void;
  restartCooldown(action:string):void;
  reduceCooldown(action: string, seconds: number): void;
  pauseCooldown(action:string):void;
  resumeCooldown(action:string):void;
  retainCooldownPercent(action:string,percent:number):void;
  chargeCount(action:string):number;
  /** Native proactive charge reduction: no recast, but AddSkillEnergyPool runs. */
  consumeCharge(action:string):boolean;
  /** Script-launched skills may interrupt their owner's current animation,
   * but never bypass their cooldown, SP cost or character-specific gates. */
  cast(action:string,interruptMotion?:boolean):void;
  interrupt(actor:string):void;
}
export interface CombatScenario {
  fps: number;
  actors: CombatActorSpec[];
  actions: CombatAction[];
  initialize?(state: CombatRuntimeState, api: CombatRuntimeApi): void;
  /** Must return a normal action only when the character's script permits it. */
  automatic?(state: CombatRuntimeState, actor: string, api:CombatRuntimeApi): string | null;
  canCast?(state: CombatRuntimeState, action: CombatAction,api:CombatRuntimeApi): boolean;
  comboFor?(state: CombatRuntimeState, action: CombatAction,api:CombatRuntimeApi): CompiledCombo;
  continuation?(state:CombatRuntimeState,action:CombatAction,api:CombatRuntimeApi):CompiledCombo|null;
  spRecipients?(state: CombatRuntimeState): CombatSpRecipient[];
  onCast?(state: CombatRuntimeState, action: CombatAction, api: CombatRuntimeApi): void;
  onChargeConsumed?(state:CombatRuntimeState,action:CombatAction,api:CombatRuntimeApi):void;
  cooldown?(state:CombatRuntimeState,action:CombatAction):number;
  onEvent(state: CombatRuntimeState, event: RuntimeEvent, api: CombatRuntimeApi): void;
  onActionEnd?(state: CombatRuntimeState, action: CombatAction, interrupted: boolean, api: CombatRuntimeApi): void;
}

/** Fixed logic-clock runtime. Search decisions and automatic normals use the
 * same legality checks. Character rules live in the scenario, not in heuristics.
 */
export function createCombatRuntime(scenario: CombatScenario): RotationModel<CombatRuntimeState> {
  if (!Number.isInteger(scenario.fps) || scenario.fps < 1) throw new Error('Invalid logic FPS');
  const actions = new Map(scenario.actions.map(action => [action.id, action]));
  const actors = new Map(scenario.actors.map(actor => [actor.id, actor]));
  if (actions.size !== scenario.actions.length || actors.size !== scenario.actors.length) throw new Error('Duplicate combat IDs');
  for (const action of actions.values()) {
    if (!actors.has(action.actor) || !Number.isFinite(action.cooldown) || action.cooldown < 0 || action.spCost < 0 ||
      !Number.isFinite(action.useInterval ?? 0) || (action.useInterval ?? 0)<0 ||
      !Number.isInteger(action.charges ?? 1) || (action.charges ?? 1)<1) throw new Error(`Invalid combat action: ${action.id}`);
  }
  const ticks = (seconds: number) => Math.ceil((seconds - 1e-9) * scenario.fps);
  const clone = (state: CombatRuntimeState): CombatRuntimeState => ({ ...state,
    supportScripts: state.supportScripts ? {...state.supportScripts} : undefined,
    summons:state.summons?{...state.summons}:undefined,
    pausedCooldowns:state.pausedCooldowns?{...state.pausedCooldowns}:undefined,
    chargeRecovery:state.chargeRecovery?Object.fromEntries(Object.entries(state.chargeRecovery).map(([key,value])=>[key,{...value}])):undefined,
    useReady:state.useReady?{...state.useReady}:undefined,
    cooldownPeriods:state.cooldownPeriods?{...state.cooldownPeriods}:undefined,
    hitCounts:state.hitCounts?{...state.hitCounts}:undefined,
    weapons:state.weapons ? {...state.weapons} : undefined,
    drops:state.drops?{...state.drops}:undefined,
    motions: { ...state.motions }, ready: { ...state.ready }, script: { ...state.script }, buffs: { ...state.buffs }, counts: { ...state.counts }, queue: [...state.queue],
    sp: { ...state.sp, budgets: { ...state.sp.budgets } },
  });
  const recipients = (): CombatSpRecipient[] => scenario.actors.map(actor => ({ pool: actor.id,
    role: actor.main ? 'main' : 'support', efficiency: actor.efficiency, alive: true, recoveryBlocked: false }));
  const syncCharges=(state:CombatRuntimeState,key:string)=>{
    const charge=state.chargeRecovery?.[key];
    if(!charge)return;
    // Native recovery is sequential, not one independent timer per charge.
    // Excess recovery on the completion frame is discarded.
    if(charge.value<charge.maximum && charge.paused===undefined && state.tick>=charge.next){
      charge.value++;
      charge.next=charge.value<charge.maximum?state.tick+Math.max(1,charge.period):Number.MAX_SAFE_INTEGER;
    }
    state.ready[key]=Math.max(state.useReady?.[key] ?? 0,charge.value>0?state.tick:charge.paused===undefined?charge.next:Number.MAX_SAFE_INTEGER);
  };
  const refreshCooldowns=(state:CombatRuntimeState)=>{
    if(!scenario.cooldown)return;
    const seen=new Set<string>();
    for(const action of actions.values()){
      const key=action.cooldownKey ?? action.id;
      if(seen.has(key))continue;seen.add(key);
      const seconds=scenario.cooldown(state,action);
      if(!Number.isFinite(seconds)||seconds<0)throw new Error(`Invalid resolved cooldown ${action.id}`);
      const period=ticks(seconds),old=state.cooldownPeriods?.[key] ?? ticks(action.cooldown);
      state.cooldownPeriods ??={};state.cooldownPeriods[key]=period;
      const delta=period-old,charge=state.chargeRecovery?.[key];
      if(charge){
        charge.period=period;
        if(delta&&charge.value<charge.maximum){
          if(charge.paused!==undefined)charge.paused=Math.max(0,charge.paused+delta);
          else if(charge.next!==Number.MAX_SAFE_INTEGER)charge.next=Math.max(state.tick,charge.next+delta);
        }
      }else if(delta){
        if(state.pausedCooldowns?.[key]!==undefined)state.pausedCooldowns[key]=Math.max(0,state.pausedCooldowns[key]!+delta);
        else if((state.ready[key] ?? 0)>state.tick&&state.ready[key]!==Number.MAX_SAFE_INTEGER)state.ready[key]=Math.max(state.tick,state.ready[key]!+delta);
      }
    }
  };
  const apiFor = (state: CombatRuntimeState): CombatRuntimeApi => ({
    chargeCount(action){
      const definition=actions.get(action);
      if(!definition)throw new Error(`Unknown charge action: ${action}`);
      const key=definition.cooldownKey ?? action;
      syncCharges(state,key);
      return state.chargeRecovery?.[key]?.value ?? (state.tick>=(state.ready[key] ?? 0)?1:0);
    },
    consumeCharge(action){
      const definition=actions.get(action);
      if(!definition)throw new Error(`Unknown charge action: ${action}`);
      const key=definition.cooldownKey ?? action;
      syncCharges(state,key);
      const charge=state.chargeRecovery?.[key];
      if(!charge||charge.value<=0)return false;
      charge.value--;
      if(charge.next===Number.MAX_SAFE_INTEGER)charge.next=state.tick+charge.period;
      syncCharges(state,key);
      if(definition.skillKey&&definition.spBudget!==null){
        const budget=state.sp.budgets[definition.skillKey] ?? {collected:0,maximum:0,delta:definition.spBudget,expiresAt:[]};
        state.sp.budgets[definition.skillKey]=activateSkillSpBudget(budget,state.tick/scenario.fps);
      }
      state.counts[`${action}:charge-consumed`]=(state.counts[`${action}:charge-consumed`] ?? 0)+1;
      scenario.onChargeConsumed?.(state,definition,apiFor(state));
      return true;
    },
    schedule(event, delaySeconds) {
      if (!Number.isFinite(delaySeconds) || delaySeconds < 0) throw new Error('Invalid event delay');
      state.queue.push({ ...event, tick: state.tick + ticks(delaySeconds), sequence: state.sequence++ });
    },
    damage(value) {
      if (!Number.isFinite(value) || value < 0) throw new Error('Invalid runtime damage');
      state.damage += value;
      state.hits++;
    },
    directSp(actor, amount) { state.sp = { ...state.sp, ledger: creditSp(state.sp.ledger, { pool: actor, amount }) }; },
    hitSp(event, amount) {
      state.sp = creditCombatHitSp(state.sp, `attack:${event.sequence}`, event.skillKey ?? null, amount, scenario.spRecipients?.(state) ?? recipients());
    },
    resetCooldown(action) {
      if (!actions.has(action)) throw new Error(`Unknown cooldown: ${action}`);
      const key=actions.get(action)!.cooldownKey ?? action;
      if(state.useReady)delete state.useReady[key];
      const charge=state.chargeRecovery?.[key];
      if(charge){charge.value=charge.maximum;charge.next=Number.MAX_SAFE_INTEGER;delete charge.paused;syncCharges(state,key);return;}
      if(state.pausedCooldowns) delete state.pausedCooldowns[key];
      state.ready[key] = state.tick;
    },
    reduceCooldown(action, seconds) {
      if (!actions.has(action) || !Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid cooldown reduction');
      const key=actions.get(action)!.cooldownKey ?? action;
      const charge=state.chargeRecovery?.[key];
      if(charge){
        if(charge.value<charge.maximum){
          if(charge.paused!==undefined)charge.paused=Math.max(0,charge.paused-ticks(seconds));
          else charge.next=Math.max(state.tick,charge.next-ticks(seconds));
        }
        syncCharges(state,key);return;
      }
      if(state.pausedCooldowns?.[key]!==undefined) state.pausedCooldowns[key]=Math.max(0,state.pausedCooldowns[key]!-ticks(seconds));
      else state.ready[key] = Math.max(state.tick, (state.ready[key] ?? 0) - ticks(seconds));
    },
    pauseCooldown(action) {
      const definition=actions.get(action);
      if(!definition) throw new Error(`Unknown cooldown: ${action}`);
      const key=definition.cooldownKey ?? action;
      const charge=state.chargeRecovery?.[key];
      if(charge){if(charge.value<charge.maximum && charge.paused===undefined)charge.paused=Math.max(0,charge.next-state.tick);syncCharges(state,key);return;}
      state.pausedCooldowns ??={};
      if(state.pausedCooldowns[key]!==undefined) return;
      if(state.ready[key]===Number.MAX_SAFE_INTEGER) throw new Error(`Cannot pause an unstarted end-timed cooldown: ${action}`);
      state.pausedCooldowns[key]=Math.max(0,(state.ready[key] ?? state.tick)-state.tick);
    },
    resumeCooldown(action) {
      const definition=actions.get(action);
      if(!definition) throw new Error(`Unknown cooldown: ${action}`);
      const key=definition.cooldownKey ?? action,remaining=state.pausedCooldowns?.[key];
      const charge=state.chargeRecovery?.[key];
      if(charge){if(charge.paused!==undefined){charge.next=state.tick+charge.paused;delete charge.paused;}syncCharges(state,key);return;}
      if(remaining===undefined) return;
      state.ready[key]=state.tick+remaining;
      delete state.pausedCooldowns![key];
    },
    restartCooldown(action){
      const definition=actions.get(action);
      if(!definition)throw new Error(`Unknown cooldown reset action ${action}`);
      const key=definition.cooldownKey ?? action,charge=state.chargeRecovery?.[key];
      const period=state.cooldownPeriods?.[key] ?? ticks(definition.cooldown);
      delete state.pausedCooldowns?.[key];
      if(charge){charge.value=0;charge.next=state.tick+period;delete charge.paused;}
      else state.ready[key]=state.tick+period;
    },
    retainCooldownPercent(action,percent) {
      const definition=actions.get(action);
      if(!definition||!Number.isFinite(percent)) throw new Error('Invalid cooldown percentage');
      const key=definition.cooldownKey ?? action,ratio=Math.max(0,Math.min(100,percent))/100;
      const charge=state.chargeRecovery?.[key];
      if(charge){
        if(charge.value<charge.maximum){
          if(charge.paused!==undefined)charge.paused=Math.ceil(charge.paused*ratio-1e-9);
          else charge.next=state.tick+Math.ceil(Math.max(0,charge.next-state.tick)*ratio-1e-9);
        }
        syncCharges(state,key);return;
      }
      if(state.pausedCooldowns?.[key]!==undefined) state.pausedCooldowns[key]=Math.ceil(state.pausedCooldowns[key]!*ratio-1e-9);
      else {
        if(state.ready[key]===Number.MAX_SAFE_INTEGER) throw new Error(`Cannot scale an unstarted end-timed cooldown: ${action}`);
        state.ready[key]=state.tick+Math.ceil(Math.max(0,(state.ready[key] ?? state.tick)-state.tick)*ratio-1e-9);
      }
    },
    cast(actionId,interruptMotion=false) {
      const action=actions.get(actionId);
      if(!action) throw new Error(`Unknown script action ${actionId}`);
      begin(state,action,interruptMotion);
    },
    interrupt(actor) {
      if(!actors.has(actor)) throw new Error(`Unknown combat actor ${actor}`);
      endMotion(state,actor,true);
    },
  });
  const allowed = (state: CombatRuntimeState, action: CombatAction,interruptMotion=false): boolean => {
    const cooldownKey=action.cooldownKey ?? action.id;
    syncCharges(state,cooldownKey);
    if(state.tick<(state.useReady?.[cooldownKey] ?? 0))return false;
    if (state.pausedCooldowns?.[cooldownKey]!==undefined || state.tick < (state.ready[cooldownKey] ?? 0) || state.sp.ledger.pools[action.actor]!.value < action.spCost) return false;
    const motion = state.motions[action.actor];
    if (motion && !interruptMotion) {
      if (!comboAllows(motion.combo, (state.tick - motion.started) / scenario.fps, action.flag,
        action.skillKey===null?undefined:Number(action.skillKey))) return false;
    }
    return scenario.canCast?.(state, action,apiFor(state)) !== false;
  };
  const endMotion = (state: CombatRuntimeState, actor: string, interrupted: boolean) => {
    const motion = state.motions[actor];
    if (!motion) return;
    const action = actions.get(motion.action)!;
    delete state.motions[actor];
    const key=action.cooldownKey ?? action.id,charge=state.chargeRecovery?.[key];
    if (action.cooldownTiming === 'end') {
      if(charge){if(charge.next===Number.MAX_SAFE_INTEGER && charge.value<charge.maximum)charge.next=state.tick+charge.period;syncCharges(state,key);}
      else state.ready[key] = state.tick + (state.cooldownPeriods?.[key] ?? ticks(action.cooldown));
    }
    scenario.onActionEnd?.(state, action, interrupted, apiFor(state));
  };
  const begin = (state: CombatRuntimeState, action: CombatAction,interruptMotion=false) => {
    if (!allowed(state, action,interruptMotion)) throw new Error(`Illegal action ${action.id} at ${state.tick / scenario.fps}s`);
    endMotion(state, action.actor, true);
    const token = ++state.token;
    state.motions[action.actor] = { action: action.id, token, started: state.tick, ends: state.tick + ticks(action.combo.duration), combo: action.combo };
    const key=action.cooldownKey ?? action.id,charge=state.chargeRecovery?.[key];
    state.useReady ??={};
    state.useReady[key]=state.tick+ticks(action.useInterval ?? 0);
    if(charge){
      charge.value--;
      if(action.cooldownTiming==='start' && charge.next===Number.MAX_SAFE_INTEGER)charge.next=state.tick+charge.period;
      syncCharges(state,key);
    }
    else if (action.cooldownTiming === 'start') state.ready[key] = state.tick + (state.cooldownPeriods?.[key] ?? ticks(action.cooldown));
    // End-timed cooldowns are unavailable while the initiating action is active.
    else state.ready[action.cooldownKey ?? action.id] = Number.MAX_SAFE_INTEGER;
    if (action.spCost) state.sp = { ...state.sp, ledger: clearUltimateSp(state.sp.ledger, action.actor, action.spCost) };
    if (action.skillKey && action.spBudget !== null) {
      const budget = state.sp.budgets[action.skillKey] ?? { collected: 0, maximum: 0, delta: action.spBudget, expiresAt: [] };
      state.sp.budgets[action.skillKey] = activateSkillSpBudget(budget, state.tick / scenario.fps);
    }
    state.counts[action.id] = (state.counts[action.id] ?? 0) + 1;
    const api = apiFor(state);
    scenario.onCast?.(state, action, api);
    const combo = scenario.comboFor?.(state, action,api) ?? action.combo;
    state.motions[action.actor] = { action: action.id, token, started: state.tick, ends: state.tick + ticks(combo.duration), combo };
    for (const event of combo.events) {
      api.schedule({ kind: 'combo', actor: action.actor, action: action.id, token,
        comboEvent: event.event, skillKey: action.skillKey }, event.time);
    }
    api.schedule({ kind: 'activation-end', actor: action.actor, action: action.id, token }, combo.activationEnd);
    api.schedule({ kind: 'anticipation-end', actor: action.actor, action: action.id, token }, combo.anticipationEnd ?? 0);
    api.schedule({ kind: 'action-end', actor: action.actor, action: action.id, token }, combo.duration);
  };
  const dispatch = (state: CombatRuntimeState) => {
    let safety = 0;
    while (true) {
      state.queue.sort((a, b) => a.tick - b.tick || (a.priority ?? 1)-(b.priority ?? 1) || a.sequence - b.sequence);
      const event = state.queue[0];
      if (!event || event.tick > state.tick) break;
      state.queue.shift();
      if (++safety > 10000) throw new Error('Runaway same-tick combat events');
      if (event.token !== undefined && event.token !== state.motions[event.actor]?.token) continue;
      if(event.weaponId!==undefined && !state.weapons?.[event.weaponId]) continue;
      if (event.kind === 'action-end') {
        const action=actions.get(event.action!)!,next=scenario.continuation?.(state,action,apiFor(state));
        if(next){
          // A native chained combo is still the same skill invocation: no
          // additional SP, charge, cast proc or cooldown restart.
          const token=++state.token,api=apiFor(state);
          state.counts[`${action.id}:continuation`]=(state.counts[`${action.id}:continuation`] ?? 0)+1;
          state.motions[event.actor]={action:action.id,token,started:state.tick,ends:state.tick+ticks(next.duration),combo:next};
          for(const frame of next.events)api.schedule({kind:'combo',actor:event.actor,action:action.id,token,comboEvent:frame.event,skillKey:action.skillKey},frame.time);
          api.schedule({kind:'activation-end',actor:event.actor,action:action.id,token},next.activationEnd);
          api.schedule({kind:'anticipation-end',actor:event.actor,action:action.id,token},next.anticipationEnd ?? 0);
          api.schedule({kind:'action-end',actor:event.actor,action:action.id,token},next.duration);
        }else endMotion(state, event.actor, false);
      }
      else scenario.onEvent(state, event, apiFor(state));
    }
  };
  return {
    initial() {
      const pool = (capacity: number): SpPool => ({ capacity, value: 0, spent: 0, gained: 0, overflow: 0 });
      const state: CombatRuntimeState = { tick: 0, sequence: 0, token: 0, motions: {}, ready: {}, queue: [], script: {}, buffs: {}, damage: 0, hits: 0, counts: {},
        sp: { ledger: { pools: Object.fromEntries(scenario.actors.map(actor => [actor.id, pool(actor.spCapacity)])), castGains: {} }, budgets: {}, creditedAttackIds: {} } };
      for(const action of scenario.actions){
        if((action.charges ?? 1)<=1)continue;
        const key=action.cooldownKey ?? action.id,maximum=action.charges!;
        if(!Number.isInteger(maximum))throw new Error(`Invalid skill charges: ${action.id}`);
        state.chargeRecovery ??={};
        const existing=state.chargeRecovery[key];
        if(existing && (existing.maximum!==maximum || existing.period!==ticks(action.cooldown)))throw new Error(`Inconsistent shared skill charges: ${key}`);
        state.chargeRecovery[key]={value:maximum,maximum,period:ticks(action.cooldown),next:Number.MAX_SAFE_INTEGER};
      }
      scenario.initialize?.(state, apiFor(state));
      refreshCooldowns(state);
      return state;
    },
    advance(original, time) {
      const state = clone(original);
      const target = ticks(time);
      if (target < state.tick) throw new Error('Combat clock cannot move backwards');
      const previousDamage = state.damage;
      while (state.tick < target) {
        dispatch(state);
        refreshCooldowns(state);
        for (const actor of scenario.actors) {
          const actionId = scenario.automatic?.(state, actor.id,apiFor(state));
          const action = actionId ? actions.get(actionId) : undefined;
          if (action && allowed(state, action)) begin(state, action);
        }
        dispatch(state);
        state.tick++;
        for(const key of Object.keys(state.chargeRecovery ?? {}))syncCharges(state,key);
        state.sp.budgets = Object.fromEntries(Object.entries(state.sp.budgets).map(([key, budget]) => [key, tickSkillSpBudget(budget, state.tick / scenario.fps)]));
      }
      dispatch(state);
      return { state, damage: state.damage - previousDamage };
    },
    actions(state) { refreshCooldowns(state);return scenario.actions.filter(action => !action.automatic && allowed(state, action)).map(action => action.id); },
    cast(original, actionId) {
      const state = clone(original);
      refreshCooldowns(state);
      const action = actions.get(actionId);
      if (!action) throw new Error(`Unknown action: ${actionId}`);
      const previousDamage = state.damage;
      begin(state, action);
      dispatch(state);
      return { state, damage: state.damage - previousDamage };
    },
    key(state) {
      // Counters used only for reporting and damage already earned do not alter
      // future legality. Resource, event and script state do.
      return JSON.stringify([state.tick, state.motions, state.ready,state.pausedCooldowns,state.chargeRecovery,state.useReady,state.cooldownPeriods, state.queue, state.script, state.buffs,state.shields,state.weapons,state.weaponSequence,state.drops,state.dropSequence, state.boss, state.records, state.seina, state.hotaru, state.tilia, state.kasimira, state.kasimiraShared, state.gray,state.procs,state.supportScripts,state.summons,
        Object.fromEntries(Object.entries(state.sp.ledger.pools).map(([id, pool]) => [id, pool.value])), state.sp.budgets]);
    },
  };
}
