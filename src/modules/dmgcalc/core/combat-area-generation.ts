import {combatFixed,type ExtractedCombatWeapon} from './combat-weapons';
export interface CombatAreaGeneration {time:number;name:string;finish:boolean;offset:{x:number;z:number};angle:number}
/** AreaEffect_GenerateAreaEffectComponent. Generated areas have independent
 * lifetimes once spawned, but future parent-bound generation is cancellable. */
export function planCombatAreaGeneration(weapon:ExtractedCombatWeapon,weapons:ExtractedCombatWeapon[],duration:number,fps=60):CombatAreaGeneration[] {
  const result:CombatAreaGeneration[]=[],tick=(time:number)=>Math.ceil((time-1e-9)*fps)/fps;
  for(const component of weapon.components.filter(component=>component.type==='AreaEffect_GenerateAreaEffectComponent')) {
    const data=component.data;
    if(data.genEnter||data.genExit||data.checkTargetWithTag||data.finishGen) throw new Error(`Area ${weapon.name} needs conditional generation/early finish handling`);
    const pointer=data.areaEffectPrefab?.m_PathID;
    if(!pointer||pointer==='0')continue;
    const child=weapons.find(weapon=>weapon.pathId===pointer);
    if(!child)throw new Error(`Missing generated combat area ${pointer}`);
    const base={name:child.name,offset:{x:combatFixed(data.genPositionOffset.x),z:combatFixed(data.genPositionOffset.y)},angle:combatFixed(data.genRotationOffset)};
    const add=(time:number,finish=false)=>result.push({...base,time,finish});
    if(data.genBegin) {
      const delay=combatFixed(data.genBeginDelay);
      const time=delay>0?tick(delay)+1/fps:0;
      if(time<duration)add(time);
    }
    if(data.genEveryWhile) {
      const interval=combatFixed(data.genInterval);
      if(interval<=0)throw new Error(`Invalid area generation interval ${weapon.name}`);
      for(let index=1;tick(index*interval)<duration;index++)add(tick(index*interval));
    }
    if(data.genFinish)add(duration,true);
  }
  return result.sort((a,b)=>a.time-b.time);
}
