import {combatFixed,type ExtractedCombatWeapon} from './combat-weapons';
export interface CombatDropPosition {x:number;z:number;y?:number}
/** DropEntity's born, adsorption-delay, range, acceleration and lifetime clocks.
 * The scenario supplies the actual landing point and a stationary pickup target;
 * no pickup is awarded merely because a drop was generated. */
export function planCombatDrop(weapon:ExtractedCombatWeapon,landing:CombatDropPosition,target:CombatDropPosition,fps=60){
  const data=weapon.components.find(component=>component.type==='DropEntity')?.data;
  if(!data || data.doType!==1 || data.dropAdsorptionType!==1 || data.isColliderAdaptive || data.effectIds?.length)
    throw new Error(`Drop ${weapon.name} requires its specialized pickup handler`);
  if(!Number.isInteger(fps)||fps<1)throw new Error('Invalid drop logic clock');
  const ticks=(seconds:number)=>Math.ceil(seconds*fps-1e-9),dt=1/fps;
  const born=data.dbShow===1?ticks(.8):0,delay=ticks(combatFixed(data.delayAdsorptionTime));
  const life=ticks(combatFixed(data.maxDuration)),horizontal=Math.hypot(landing.x-target.x,landing.z-target.z);
  let remaining=Math.hypot(horizontal,(landing.y ?? 0)-(target.y ?? 0)),speed=Number(data.flyToActorSpeed);
  const acceleration=combatFixed(data.flyToActorAcceleration);
  if(!Number.isFinite(speed)||speed<0||acceleration<0||life<1)throw new Error(`Invalid drop movement ${weapon.name}`);
  // The manager selects a target only after born and delay flags are set.
  // The flight component runs on the subsequent logic update.
  if(horizontal<Number(data.adsorptionRange))for(let frame=Math.max(1,delay)+1;frame<life;frame++){
    speed+=acceleration*dt;
    remaining-=speed*dt;
    if(remaining<=0)return {time:(born+frame)/fps,picked:true,tag:String(data.dropTag),buff:Number(data.buffId ?? 0),maximum:Number(data.sameMaxCount)};
  }
  return {time:(born+life)/fps,picked:false,tag:String(data.dropTag),buff:Number(data.buffId ?? 0),maximum:Number(data.sameMaxCount)};
}
