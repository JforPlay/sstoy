import {combatFixed,type ExtractedCombatWeapon} from './combat-weapons';
import type {CombatPoint} from './combat-projectile-path';
/** WeaponFeatureIntermittentTriggerAreaEffect runs before the bullet's Move
 * update. A bound child is stopped when its parent weapon finishes. */
export function planCombatProjectileGeneration(weapon:ExtractedCombatWeapon,weapons:ExtractedCombatWeapon[],
  duration:number,positionAt:(time:number)=>CombatPoint,fps=60){
  const result:{time:number;name:string;position:CombatPoint;bound:boolean}[]=[];
  for(const {data} of weapon.components.filter(component=>component.type==='WeaponFeatureIntermittentTriggerAreaEffect')){
    if(data.finishAttachedWeapon)throw new Error(`Projectile ${weapon.name} requires its finishing feature handler`);
    const pointer=data.areaEffectPrefab?.m_PathID;
    if(!pointer||pointer==='0')continue;
    const child=weapons.find(weapon=>weapon.pathId===pointer);
    if(!child)throw new Error(`Missing intermittent projectile area ${pointer}`);
    const delay=Math.max(1,Math.ceil(combatFixed(data.delay)*fps-1e-9)),interval=Math.max(1,Math.ceil(combatFixed(data.interval)*fps-1e-9));
    for(let frame=delay;frame<=Math.round(duration*fps);frame+=data.isIntermittent?interval:Infinity){
      result.push({time:frame/fps,name:child.name,position:positionAt((frame-1)/fps),bound:Boolean(data.isBindWeaponLifeCycle)});
    }
  }
  return result.sort((a,b)=>a.time-b.time);
}
