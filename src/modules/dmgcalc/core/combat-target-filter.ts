/** TargetFilterCriteriaInfo + ActorHelper.CheckTarget. Candidates are supplied
 * by the scene's collision query; this module does not invent area geometry. */
export interface CombatFilterActor {
  id:string;player:boolean;main:boolean;element:number;monsterEpic?:number;
  summoner:string|null;minion:boolean;
}
export interface CombatTargetCriterion {targetType:number;elementType:number;monsterEpicType:number;operationType:number}
export interface CombatTargetFilter {filterCriteriaList?:CombatTargetCriterion[];operationType?:number}
export interface CombatTargetFilterContext {
  actors:readonly CombatFilterActor[];
  relation(from:string,to:string):'friend'|'enemy'|'neutral';
}
function matchesTarget(owner:CombatFilterActor,target:CombatFilterActor,mask:number,context:CombatTargetFilterContext):boolean {
  if(mask===0) return false;
  if(mask===0xfffe) return true;
  const relation=()=>context.relation(owner.id,target.id);
  const summonRelation=()=>{
    if(!target.summoner) throw new Error('Summon target needs its owner');
    if(!context.actors.some(actor=>actor.id===target.summoner)) throw new Error(`Missing summon owner ${target.summoner}`);
    return context.relation(owner.id,target.summoner);
  };
  const checks:Record<number,()=>boolean>={
    2:()=>target.id===owner.id,
    4:()=>target.id!==owner.id && relation()==='friend',
    8:()=>relation()==='friend',16:()=>relation()==='enemy',32:()=>relation()!=='neutral',
    64:()=>target.minion && target.summoner===owner.id,
    128:()=>target.minion && target.summoner!==owner.id && summonRelation()==='friend',
    256:()=>target.minion && summonRelation()==='friend',
    512:()=>target.minion && summonRelation()==='enemy',
    1024:()=>target.minion && summonRelation()!=='neutral',
    2048:()=>target.player && target.main,4096:()=>target.player && !target.main,
    8192:()=>target.id!==owner.id && relation()==='friend' && target.summoner===null,
    16384:()=>target.id!==owner.id && relation()==='friend' && (target.summoner===null || target.minion),
    32768:()=>relation()==='friend' && target.summoner===null,
  };
  return Object.entries(checks).some(([flag,check])=>(mask&Number(flag))!==0 && check());
}
const combine=(left:boolean,right:boolean,operation:number)=>operation===0 ? left && right : left || right;
export function matchesCombatTargetFilter(owner:CombatFilterActor,target:CombatFilterActor,filter:CombatTargetFilter|undefined,
  context:CombatTargetFilterContext):boolean {
  const criteria=filter?.filterCriteriaList ?? [];
  if(!criteria.length) return true;
  const matches=(criterion:CombatTargetCriterion)=>{
    const element=criterion.elementType===254 || target.element>=1 && target.element<=7 && (criterion.elementType&(1<<target.element))!==0;
    let result=combine(matchesTarget(owner,target,criterion.targetType,context),element,criterion.operationType);
    if(!target.player) {
      if(target.monsterEpic===undefined) throw new Error(`Missing monster epic type ${target.id}`);
      const epic=target.monsterEpic;
      const monster=criterion.monsterEpicType===30 || Boolean((criterion.monsterEpicType&2) && epic===5)
        || Boolean((criterion.monsterEpicType&4) && epic===4) || Boolean((criterion.monsterEpicType&8) && epic===3)
        || Boolean((criterion.monsterEpicType&16) && [2,3,7,8].includes(epic));
      result=combine(result,monster,criterion.operationType);
    }
    return result;
  };
  return filter?.operationType===1 ? criteria.some(matches) : criteria.every(matches);
}
