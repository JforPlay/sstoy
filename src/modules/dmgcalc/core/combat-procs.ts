import type { RecordRuleBuffs } from './combat-record-rules';

export interface CombatProcState { last: Record<string,number>; counters: Record<string,number> }
export interface CombatProcContext {
  event: string; actor: string; attacker: string; target: string; main: string; party: string[];
  time: number; breakthrough: number; tags: number[]; buffs: RecordRuleBuffs;
  facts: Record<string,number|boolean|string>;
  groups?:Record<string,string[]>;
  parameter(id: number): number;
  randomPercent(): number;
}
type ProcRecipient = 'self'|'attacker'|'target'|'main'|'party'|`group:${string}`;
export interface CombatProcEffect { kind:'add-buff'|'remove-buff'|'once'; id:number; recipient?:ProcRecipient; source?:ProcRecipient; count?:number }
export interface CombatProcRule {
  id:string; event:string; breakthrough?:number;
  when?(context:CombatProcContext,state:CombatProcState):boolean;
  cooldown?: { seconds?:number; parameter?:number; strict?:boolean; zeroIsUnset?:boolean };
  probability?: { percent?:number; parameter?:number; inclusive?:boolean };
  every?:number;
  uniqueBy?:'target'|'attacker';
  resetOn?:string;
  counters?:{key:string;set?:number;add?:number}[];
  effects:CombatProcEffect[];
}
export interface CombatProcOnce { id:number; count:number; source:string }
export const initialCombatProcs = ():CombatProcState => ({last:{},counters:{}});

export function combatProcContext(api:{actor:string;buffs:RecordRuleBuffs;time?:number;parameter?:(id:number)=>number;randomPercent?:()=>number},
  event:string,breakthrough:number,party:string[],main=party[0] ?? api.actor,tags:number[]=[],facts:CombatProcContext['facts']={}):CombatProcContext {
  return {event,breakthrough,party,main,tags,facts,actor:api.actor,attacker:api.actor,target:'boss',time:api.time ?? 0,buffs:api.buffs,
    parameter:api.parameter ?? (()=>{throw new Error('Proc requires character parameter facts');}),
    randomPercent:api.randomPercent ?? (()=>{throw new Error('Proc requires replay random state');})};
}

/** One implementation of native event gates, independent cooldowns, counters,
 * random boundary semantics and recipient routing for every actor's rules.
 * Input state is immutable so each policy/replay starts from the same state. */
export function runCombatProcs(rules:readonly CombatProcRule[], original:CombatProcState, context:CombatProcContext): {state:CombatProcState;once:CombatProcOnce[]} {
  const state:CombatProcState = {last:{...original.last},counters:{...original.counters}}, once:CombatProcOnce[]=[];
  const recipients = (recipient:ProcRecipient='self'):string[] => {
    if (recipient==='party') return context.party;
    if (recipient.startsWith('group:')) {
      const members=context.groups?.[recipient.slice(6)];
      if (!members) throw new Error(`Missing proc recipient group ${recipient}`);
      return members;
    }
    return [recipient==='self' ? context.actor : recipient==='attacker' ? context.attacker : recipient==='target' ? context.target : context.main];
  };
  for (const rule of rules) {
    if (rule.resetOn===context.event) {
      for (const key of Object.keys(state.counters)) if (key===rule.id || key.startsWith(`${rule.id}@`)) delete state.counters[key];
    }
    if (rule.event!==context.event || context.breakthrough<(rule.breakthrough ?? 0) || (rule.when && !rule.when(context,state))) continue;
    const uniqueKey=rule.uniqueBy ? `${rule.id}@${context[rule.uniqueBy]}` : undefined;
    if (uniqueKey && state.counters[uniqueKey]) continue;
    if (rule.cooldown) {
      const cooldown = rule.cooldown.parameter ? context.parameter(rule.cooldown.parameter) : rule.cooldown.seconds ?? 0;
      const last = state.last[rule.id];
      if (last!==undefined && (!rule.cooldown.zeroIsUnset || last>0)
        && (rule.cooldown.strict===false ? context.time-last<cooldown : context.time-last<=cooldown)) continue;
    }
    if (rule.probability) {
      const chance = rule.probability.parameter ? context.parameter(rule.probability.parameter) : rule.probability.percent ?? 0;
      const roll = context.randomPercent();
      if (rule.probability.inclusive===false ? roll>=chance : roll>chance) continue;
    }
    if (rule.every) {
      if (!Number.isInteger(rule.every) || rule.every<1) throw new Error(`Invalid proc count ${rule.id}`);
      const count = (state.counters[rule.id] ?? 0)+1;
      state.counters[rule.id] = count;
      if (count<rule.every) continue;
      state.counters[rule.id]=0;
    }
    state.last[rule.id]=context.time;
    if (uniqueKey) state.counters[uniqueKey]=1;
    for (const update of rule.counters ?? []) {
      const value=(update.set ?? state.counters[update.key] ?? 0)+(update.add ?? 0);
      if (!Number.isFinite(value)) throw new Error(`Invalid proc counter ${update.key}`);
      state.counters[update.key]=value;
    }
    for (const effect of rule.effects) {
      if (effect.kind==='once') {
        const sources=recipients(effect.source);
        if (sources.length!==1) throw new Error(`Once attribute requires exactly one source: ${rule.id}`);
        once.push({id:effect.id,count:effect.count ?? 1,source:sources[0]!});
        continue;
      }
      for (const recipient of recipients(effect.recipient)) {
        if (effect.kind==='remove-buff') context.buffs.remove(recipient,effect.id);
        else for (let n=0;n<(effect.count ?? 1);n++) context.buffs.add(recipient,effect.id,context.actor);
      }
    }
  }
  return {state,once};
}
