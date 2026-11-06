import {combatFixed} from './combat-weapons';
export interface CombatFollowPoint {x:number;z:number;angle:number}
/** Native AreaEffect_FollowComponent against a stationary, live actor.
 * ShakeMove continues through its target for one half-period, then reverses
 * for full periods; it does not snap to the target or choose random points. */
export function planCombatFollowPath(data:Record<string,any>,origin:CombatFollowPoint,target:CombatFollowPoint,duration:number,fps=60):CombatFollowPoint[] {
  if(![0,1,2].includes(data.targetType))throw new Error('Specified follow target is required');
  const count=Math.ceil(duration*fps),points:CombatFollowPoint[]=[{...origin}];
  let position={...origin},speed=combatFixed(data.followSpeed),direction={x:Math.cos(origin.angle*Math.PI/180),z:Math.sin(origin.angle*Math.PI/180)};
  let shaking=false,shakeTicks=0,shakePeriod=Math.max(1,Math.ceil(combatFixed(data.shakeInterval)*fps-1e-9));
  const followTime=combatFixed(data.followTime),acceleration=combatFixed(data.followAcceleratedSpeed),border=combatFixed(data.borderVelocitySpeed);
  if(!Number.isFinite(duration)||duration<0||fps<=0)throw new Error('Invalid follow duration');
  for(let frame=1;frame<=count;frame++) {
    if(followTime>0&&(frame-1)/fps>=followTime) {shaking=false;points.push({...position});continue;}
    if(!data.isSlowMove) {
      position={...target,angle:data.syncTargetRotation?target.angle:position.angle};
    } else if(shaking) {
      position={...position,x:position.x+direction.x*speed/fps,z:position.z+direction.z*speed/fps};
      if(++shakeTicks>=shakePeriod) {
        shakeTicks=0;shakePeriod=Math.max(1,Math.ceil(combatFixed(data.shakeInterval)*2*fps-1e-9));
        direction={x:-direction.x,z:-direction.z};
        if(data.changeDirection)position.angle=Math.atan2(direction.z,direction.x)*180/Math.PI;
      }
    } else {
      const dx=target.x-position.x,dz=target.z-position.z,length=Math.hypot(dx,dz);
      direction=length>0?{x:dx/length,z:dz/length}:{x:0,z:0};
      if(data.changeDirection&&length>0)position.angle=Math.atan2(direction.z,direction.x)*180/Math.PI;
      speed+=acceleration/fps;
      if(acceleration>0&&speed>border||acceleration<0&&speed<border)speed=border;
      if(length>speed/fps)position={...position,x:position.x+direction.x*speed/fps,z:position.z+direction.z*speed/fps};
      else if(data.shakeWhenReachingTarget)shaking=true;
      else position={...position,x:target.x,z:target.z};
    }
    points.push({...position});
  }
  return points;
}
