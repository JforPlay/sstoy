import {initialCombatProcs,runCombatProcs,type CombatProcContext,type CombatProcOnce,type CombatProcRule,type CombatProcState} from './combat-procs';

export interface CombatProcListener { actor:string; character:number; breakthrough:number }
export type CombatPartyProcState=Record<string,CombatProcState>;
export interface CombatProcDispatch {
  event:string;
  /** Events named own-* go only to the owner explicitly supplied by the caller.
   * Party events keep the actual attacker; the listening support is not it. */
  owner?:string;
  excludeOwner?:string;
  context(listener:CombatProcListener):Omit<CombatProcContext,'actor'|'event'|'breakthrough'>;
}

/** The same event dispatcher is shared by every reviewed character. State is
 * stored per actor, not by position in a particular example party. */
export function dispatchCombatProcs(registry:Readonly<Record<number,readonly CombatProcRule[]>>,listeners:readonly CombatProcListener[],
  original:CombatPartyProcState,dispatch:CombatProcDispatch):{state:CombatPartyProcState;once:CombatProcOnce[]} {
  if(/^(?:before-)?own-/.test(dispatch.event) && dispatch.owner===undefined) throw new Error(`Owner-only combat event needs an owner: ${dispatch.event}`);
  const state={...original},once:CombatProcOnce[]=[];
  for(const listener of listeners) {
    if(dispatch.owner!==undefined && listener.actor!==dispatch.owner || listener.actor===dispatch.excludeOwner) continue;
    const rules=registry[listener.character];
    if(!rules) throw new Error(`Missing reviewed combat proc profile ${listener.character}`);
    // Do not build HP, summon or geometry facts for an unrelated listener.
    if(!rules.some(rule=>(rule.event===dispatch.event || rule.resetOn===dispatch.event) && listener.breakthrough>=(rule.breakthrough ?? 0))) continue;
    const result=runCombatProcs(rules,state[listener.actor] ?? initialCombatProcs(),{
      ...dispatch.context(listener),actor:listener.actor,event:dispatch.event,breakthrough:listener.breakthrough,
    });
    state[listener.actor]=result.state;
    once.push(...result.once);
  }
  return {state,once};
}
