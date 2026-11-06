import {combatFixed,type ExtractedCombatWeapon} from './combat-weapons';
import {planCombatFollowPath} from './combat-area-follow';
export interface CombatAreaPosition {x:number;z:number;angle?:number}
/** A thrown projectile's arrival circle or a bomb's actual hitbox, using
 * the same shape math as areas. This changes hit overlap, not flight timing. */
export function createCombatLandingGeometry(weapon:ExtractedCombatWeapon,origin:CombatAreaPosition,fps=60){
  const bomb=weapon.components.find(component=>component.type==='AdventureBomb')?.data;
  const projectile=weapon.components.find(component=>component.type==='AdventureProjectile')?.data;
  if(!bomb&&!projectile)throw new Error(`Missing projectile landing geometry ${weapon.name}`);
  const data=bomb?{...bomb,hitBoxOffset:{x:0,y:0},hitBoxRotation:0}
    :{hitBoxShape:1,hitBoxWidth:0,hitBoxLength:0,hitBoxRadius:projectile!.damageArea,
      hitBoxInnerRadius:0,hitBoxAngle:360,hitBoxOffset:{x:0,y:0},hitBoxRotation:0};
  return createCombatAreaGeometry({...weapon,components:[...weapon.components.filter(component=>component.type==='Transform'),
    {type:'AreaEffectEntity',data}]},origin,fps);
}
/** HitBox.Shape uses Rectangle=0, Circle=1, Fan=2. Dimensions, offsets and
 * rotation come from the area component, not the rendered effect mesh. */
export function createCombatAreaGeometry(weapon:ExtractedCombatWeapon,origin:CombatAreaPosition,fps=60,targets?:{owner:CombatAreaPosition;main:CombatAreaPosition;target:CombatAreaPosition}) {
  const area=weapon.components.find(component=>component.type==='AreaEffectEntity')?.data;
  if(!area) throw new Error(`Missing area geometry ${weapon.name}`);
  const movement=weapon.components.find(component=>component.type==='AreaEffect_MoveComponent')?.data;
  const following=weapon.components.find(component=>component.type==='AreaEffect_FollowComponent')?.data;
  if(following&&(!targets||movement))throw new Error(`Area ${weapon.name} requires an explicit follow target`);
  if(movement && (movement.isArc||movement.triggerActorStop)) throw new Error(`Area ${weapon.name} requires its curved/collision-stop movement handler`);
  const scale=weapon.components.find(component=>component.type==='Transform')?.data.m_LocalScale?.x ?? 1;
  const growth=weapon.components.find(component=>component.type==='AreaEffect_ScriptScale')?.data;
  const scaleAt=(seconds:number)=>growth?1+Math.min(growth.maximum,Math.floor(seconds/growth.interval+1e-9))*growth.step:1;
  if(area.areaWithActorScale) throw new Error(`Area ${weapon.name} requires its owner scale`);
  if(!Number.isFinite(scale)||scale<=0||fps<=0) throw new Error('Invalid area transform');
  const radians=(origin.angle ?? 0)*Math.PI/180,forward={x:Math.cos(radians),z:Math.sin(radians)};
  const speed=movement?combatFixed(movement.speed):0,interval=movement?combatFixed(movement.moveInterval):0;
  const offsetX=combatFixed(area.hitBoxOffset.x)*scale,offsetZ=combatFixed(area.hitBoxOffset.y)*scale;
  const width=combatFixed(area.hitBoxWidth)*scale,length=combatFixed(area.hitBoxLength)*scale;
  const radius=combatFixed(area.hitBoxRadius)*scale,inner=combatFixed(area.hitBoxInnerRadius)*scale;
  const diffuse=weapon.components.find(component=>component.type==='AreaEffect_DiffuseComponent')?.data;
  const dimensions=[{width,length,radius,inner}];
  if(diffuse){
    const ticks=(seconds:number)=>Math.ceil(seconds*fps-1e-9);
    const delay=ticks(combatFixed(diffuse.delayDiffuseTime)),interval=ticks(combatFixed(diffuse.interval));
    const maximum=ticks(combatFixed(diffuse.maxDiffuseTime));
    let current=dimensions[0]!,increment=combatFixed(diffuse.speed)*scale;
    for(let frame=1;frame<=maximum;frame++){
      if(interval>0&&frame%interval===0){
        current={...current};
        if(area.hitBoxShape===0){
          if(diffuse.edgeDiffuseType!==2)current.width+=diffuse.edgeDiffuseType===1&&current.length>0
            ?increment*current.width/current.length:increment;
          if(diffuse.edgeDiffuseType!==3)current.length+=increment;
        }else{
          if(diffuse.radiusTogether)current.inner=Math.max(0,diffuse.innerRadiusDiffuseType===0?current.radius:current.inner+increment);
          current.radius=Math.max(0,current.radius+increment);
        }
      }
      if(diffuse.changeSpeed&&(frame-1)/fps>=combatFixed(diffuse.delay_Change))increment=combatFixed(diffuse.speed_Change)*scale;
      dimensions[delay+frame]=current;
    }
  }
  const angle=combatFixed(area.hitBoxAngle);
  const followTarget=following&&targets?[targets.owner,targets.target,targets.main][following.targetType]:undefined;
  const path=following&&followTarget?planCombatFollowPath(following,{...origin,angle:origin.angle ?? 0},{...followTarget,angle:followTarget.angle ?? 0},combatFixed(area.duration),fps):undefined;
  const pathPoint=(seconds:number)=>path?.[Math.min(path.length-1,Math.floor(seconds*fps+1e-9))];
  const angleAt=(seconds:number)=>(pathPoint(seconds)?.angle ?? origin.angle ?? 0);
  function entityPositionAt(seconds:number) {
    if(!Number.isFinite(seconds)||seconds<0) throw new Error('Invalid area time');
    const followed=pathPoint(seconds);
    if(followed)return {x:followed.x,z:followed.z};
    const frames=Math.floor(seconds*fps+1e-9),step=interval>0?Math.max(1,Math.ceil(interval*fps-1e-9)):1;
    const elapsed=Math.floor(frames/step)*step/fps,distance=speed*elapsed;
    return {x:origin.x+forward.x*distance,z:origin.z+forward.z*distance};
  }
  function positionAt(seconds:number) {
    const point=entityPositionAt(seconds);
    const angle=angleAt(seconds)*Math.PI/180;
    const factor=scaleAt(seconds);
    return {x:point.x+(Math.cos(angle)*offsetZ-Math.sin(angle)*offsetX)*factor,z:point.z+(Math.sin(angle)*offsetZ+Math.cos(angle)*offsetX)*factor};
  }
  return {positionAt,entityPositionAt,angleAt,moving:Boolean(diffuse)||Boolean(speed)||Boolean(path?.some(point=>point.x!==origin.x||point.z!==origin.z)),contains(point:{x:number;z:number},seconds:number) {
    const position=positionAt(seconds),dx=point.x-position.x,dz=point.z-position.z;
    const angle=angleAt(seconds)*Math.PI/180+combatFixed(area.hitBoxRotation)*Math.PI/180;
    const facing={x:Math.cos(angle),z:Math.sin(angle)};
    const base=dimensions[Math.min(dimensions.length-1,Math.floor(seconds*fps+1e-9))] ?? dimensions[0]!,factor=scaleAt(seconds);
    const shape={width:base.width*factor,length:base.length*factor,radius:base.radius*factor,inner:base.inner*factor};
    if(area.hitBoxShape===0) return Math.abs(dx*facing.x+dz*facing.z)<=shape.length/2 && Math.abs(-dx*facing.z+dz*facing.x)<=shape.width/2;
    const distance=Math.hypot(dx,dz);
    if(area.hitBoxShape===1) return distance<shape.radius && distance>=shape.inner;
    if(area.hitBoxShape===2) {
      const deviation=distance>0?Math.acos(Math.max(-1,Math.min(1,(dx*facing.x+dz*facing.z)/distance)))*180/Math.PI:0;
      return distance<shape.radius&&distance>=shape.inner&&deviation<=angle/2;
    }
    throw new Error(`Unknown native area shape ${area.hitBoxShape}`);
  }};
}
