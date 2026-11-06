/** BuffCom/BuffEntity stack, parallel-instance and sequential-timer semantics. */
export interface CombatBuffDefinition {
  Id: number; Time?: number; LaminatedNum?: number; Num?: number;
  TimeSuperposition?: number; Timing?: number; ReplaceType?: boolean; ReplaceMode?: boolean;
  Effects?: number[];
  GroupId?:number; Sort?:number; ValueId?:number;
}
export interface CombatBuffInstance { id: number; owner: string; source: string; stacks: number; expires: number | null;
  sources?:string[];group?:number;sort?:number;valueId?:number;serialWait?:number }
export type CombatBuffState = Record<string, CombatBuffInstance>;
const key = (owner: string, id: number) => `${owner}:${id}`;
function rebaseSerial(state:CombatBuffState,owner:string,id:number,time:number,resetFirst:boolean):CombatBuffState {
  const entries=Object.entries(state).filter(([,buff])=>buff.owner===owner && buff.id===id);
  if(!entries.length || entries[0]![1].serialWait===undefined) return state;
  let deadline:number|null=resetFirst ? time : entries[0]![1].expires;
  for(const [index,[instanceKey,buff]] of entries.entries()) {
    if(index>0 || resetFirst) deadline=deadline===null || !buff.serialWait ? null : deadline+buff.serialWait;
    state[instanceKey]={...buff,expires:deadline};
  }
  return state;
}
export function combatBuffCount(state: CombatBuffState, owner: string, id: number, time: number): number {
  return Object.values(state).filter(buff=>buff.owner===owner && buff.id===id && (buff.expires===null || buff.expires>time))
    .reduce((sum,buff)=>sum+buff.stacks,0);
}
export function expireCombatBuffs(state: CombatBuffState, time: number): CombatBuffState {
  return Object.fromEntries(Object.entries(state).filter(([, buff]) => buff.expires === null || buff.expires > time));
}
export function removeCombatBuff(state: CombatBuffState, owner: string, id: number,reduceNum=0,time=0): CombatBuffState {
  if(!Number.isInteger(reduceNum) || reduceNum<0) throw new Error('Invalid buff stack removal');
  const result = { ...state };
  const first=Object.entries(state).find(([,buff])=>buff.owner===owner && buff.id===id)?.[0];
  for(const [instanceKey,buff] of Object.entries(state)) if(buff.owner===owner && buff.id===id) {
    if(reduceNum>0 && buff.stacks>reduceNum) result[instanceKey]={...buff,stacks:buff.stacks-reduceNum,
      ...(buff.sources ? {sources:buff.sources.slice(0,-reduceNum)} : {})};
    else delete result[instanceKey];
  }
  return rebaseSerial(result,owner,id,time,first!==undefined && !result[first]);
}
export function addCombatBuff(state: CombatBuffState, definition: CombatBuffDefinition, owner: string, source: string, time: number): CombatBuffState {
  if(!Number.isInteger(definition.Num) || definition.Num!<1) throw new Error(`Invalid buff instance limit ${definition.Id}`);
  let result=expireCombatBuffs(state,time);
  if(definition.GroupId) for(const buff of Object.values(result)) {
    if(buff.owner!==owner || buff.id===definition.Id || buff.group!==definition.GroupId) continue;
    if((definition.Sort ?? 0)<(buff.sort ?? 0)) return state;
    result=removeCombatBuff(result,owner,buff.id,0,time);
  }
  const instances=Object.entries(result).filter(([,buff])=>buff.owner===owner && buff.id===definition.Id);
  const maximum = Math.max(1, definition.LaminatedNum ?? 0);
  const duration = (definition.Time ?? 0) / 10000;
  const stackable=instances.find(([,buff])=>maximum>1 && buff.stacks<maximum);
  const refresh=instances.length>=definition.Num! ? (definition.ReplaceMode ? instances.at(-1) : instances[0]) : undefined;
  if(!stackable && refresh && !definition.ReplaceType) return state;
  const updating=stackable ?? (refresh && definition.ReplaceMode ? refresh : undefined);
  if(updating) {
    const [instanceKey,prior]=updating;
    let expires=prior.expires;
    let serialWait=prior.serialWait;
    if(duration>0) {
      const position=instances.findIndex(([candidate])=>candidate===instanceKey);
      if(serialWait!==undefined) {
        if(definition.TimeSuperposition===2) serialWait=duration;
        else if(definition.TimeSuperposition===3) serialWait=(position===0 ? Math.max(0,(prior.expires ?? time)-time) : serialWait)+duration;
        if(position===0 && (definition.TimeSuperposition===2 || definition.TimeSuperposition===3)) expires=time+serialWait;
      } else {
        if (definition.TimeSuperposition === 2) expires = time + duration;
        else if (definition.TimeSuperposition === 3) expires = (prior.expires ?? time) + duration;
      }
    }
    const sources=stackable && (prior.sources || prior.source!==source)
      ? [...(prior.sources ?? Array(prior.stacks).fill(prior.source)),source] : prior.sources;
    result={...result,[instanceKey]:{...prior,stacks:stackable ? prior.stacks+1 : prior.stacks,expires,...(sources ? {sources} : {}),
      ...(serialWait!==undefined ? {serialWait} : {})}};
    return rebaseSerial(result,owner,definition.Id,time,false);
  }
  if(refresh) {
    delete result[refresh[0]];
    result=rebaseSerial(result,owner,definition.Id,time,refresh[0]===instances[0]?.[0]);
  }
  const baseKey=key(owner,definition.Id);
  let instanceKey=baseKey,index=1;
  while(result[instanceKey]) instanceKey=`${baseKey}#${index++}`;
  result={...result,[instanceKey]:{id:definition.Id,owner,source,stacks:1,expires:duration>0 ? time+duration : null,
    ...(definition.GroupId ? {group:definition.GroupId,sort:definition.Sort ?? 0} : {}),
    ...(definition.ValueId ? {valueId:definition.ValueId} : {}),...(definition.Timing===2 ? {serialWait:duration} : {})}};
  return rebaseSerial(result,owner,definition.Id,time,false);
}
