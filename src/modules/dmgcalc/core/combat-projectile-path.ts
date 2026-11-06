import {combatFixed,type ExtractedCombatWeapon} from './combat-weapons';
export interface CombatPoint {x:number;z:number}
/** Straight, penetrating, swept-collider/circular/rectangular projectiles against stationary point
 * targets. Other shapes/features are rejected, not turned into guaranteed hits.
 * AdventureBullet tests lifetime before collision on each fixed logic update. */
export function planStraightCombatProjectile(weapon:ExtractedCombatWeapon,origin:CombatPoint,direction:CombatPoint,
  targets:{id:string;position:CombatPoint;friendly?:boolean}[],fps=60,rules:Record<string,number>={},traceTarget?:CombatPoint) {
  const data=weapon.components.find(component=>component.type==='AdventureBullet')?.data;
  if(!data||data.isRangeHit&&![0,1].includes(data.shape)||data.isPauseMove||data.isAreaHit)
    throw new Error(`Directional projectile ${weapon.name} requires its native movement/shape handler`);
  const penetrating=weapon.components.some(component=>component.type==='WeaponFeaturePenetratingActor');
  const length=Math.hypot(direction.x,direction.z),speed=combatFixed(data.moveSpeed),life=combatFixed(data.lifeTime),delay=combatFixed(data.delayMove);
  if(!Number.isFinite(length)||length<=0||speed<0||life<=0||fps<=0) throw new Error('Invalid directional projectile');
  let unit={x:direction.x/length,z:direction.z/length};
  const radius=combatFixed(data.damageRadius);
  const width=combatFixed(data.damageWidth),height=combatFixed(data.damageHeight);
  if(data.isRangeHit&&(data.shape===1?radius<=0:width<=0||height<=0)) throw new Error(`Missing directional projectile dimensions ${weapon.name}`);
  const transform=weapon.components.find(component=>component.type==='Transform')?.data;
  const scale=transform?.m_LocalScale;
  if(!scale || !Number.isFinite(scale.x)||!Number.isFinite(scale.z)) throw new Error(`Missing projectile transform ${weapon.name}`);
  const collider=weapon.components.find(component=>component.type==='BoxCollider')?.data;
  const sphere=weapon.components.find(component=>component.type==='SphereCollider')?.data;
  if(!data.isRangeHit&&!sphere)throw new Error(`Missing swept projectile collider ${weapon.name}`);
  const buffTrigger=weapon.components.some(component=>component.type==='WeaponFeatureBuffTrigger');
  if(buffTrigger&&!collider) throw new Error(`Directional projectile ${weapon.name} needs its native buff collider shape`);
  let duration=Math.ceil((life-1e-9)*fps)/fps;
  const hits:{target:string;time:number}[]=[],buffContacts:{target:string;time:number}[]=[];
  const firstMove=Math.max(1,Math.ceil(delay*fps-1e-9));
  const acceleration=combatFixed(data.acceleratedVelocity),border=combatFixed(data.borderVelocitySpeed);
  if(acceleration!==0&&border<0)throw new Error(`Invalid projectile speed limit ${weapon.name}`);
  const frameCount=Math.round(duration*fps),positions=[{...origin}];
  let currentSpeed=speed,position={...origin};
  const trace=weapon.components.find(component=>component.type==='WeaponFeatureTraceTarget'&&component.data.iActive)?.data;
  if(trace&&(!traceTarget||trace.iResetTraceStartTime||combatFixed(trace.tracePauseRange)>0))
    throw new Error(`Directional projectile ${weapon.name} requires its specialized trace handler`);
  let tracing=false;
  const hitTimes=new Map<string,number>(),buffSeen=new Set<string>();
  const configuredImmune=combatFixed(data.damageImmuneDuration);
  const immune=configuredImmune===0?rules.Combat_HitboxDamageImmuneDuration:configuredImmune;
  if(immune===undefined)throw new Error(`Missing projectile damage immunity ${weapon.name}`);
  const positionAt=(time:number)=>{
    const frames=Math.max(0,Math.min(positions.length-1,Math.floor(time*fps+1e-9)));
    return positions[frames]!;
  };
  for(let frame=1;frame<frameCount;frame++) {
    // Collision precedes Move(). The update that reaches lifeTime finishes
    // immediately; it neither attacks nor advances by another full frame.
    const time=frame/fps;
    if(trace&&traceTarget){
      const start=combatFixed(trace.traceStartTime);
      if(time>start+1e-9&&time<=start+combatFixed(trace.traceDuration)+1e-9){
        const dx=traceTarget.x-position.x,dz=traceTarget.z-position.z;
        const distance=Math.hypot(dx,dz);
        if(distance<=combatFixed(trace.traceRange))tracing=true;
        if(tracing&&distance>1e-9){
          const turn=Math.atan2(unit.x*dz-unit.z*dx,unit.x*dx+unit.z*dz);
          const max=combatFixed(trace.traceRotateSpeed)*Math.PI/180/fps;
          const angle=Math.atan2(unit.z,unit.x)+Math.max(-max,Math.min(max,turn));
          unit={x:Math.cos(angle),z:Math.sin(angle)};
        }
      }
    }
    for(const target of targets) {
      const dx=target.position.x-position.x,dz=target.position.z-position.z;
      const localX=(-unit.z*dx+unit.x*dz)/scale.x,localZ=(unit.x*dx+unit.z*dz)/scale.z;
      const along=Math.max(0,Math.min(frame>=firstMove?currentSpeed/fps:0,dx*unit.x+dz*unit.z));
      const sweptDistance=Math.hypot(dx-unit.x*along,dz-unit.z*along);
      const inside=!data.isRangeHit?sweptDistance<=Number(sphere!.m_Radius)*scale.x:
        data.shape===1?Math.hypot(dx,dz)<radius*scale.x:Math.abs(localX)<=width/2&&Math.abs(localZ)<=height/2;
      const previous=hitTimes.get(target.id);
      if(!target.friendly&&inside&&(previous===undefined||time-previous>immune+1e-9)) {
        hits.push({target:target.id,time});hitTimes.set(target.id,time);
      }
      if(buffTrigger&&!buffSeen.has(target.id)) {
        if(Math.abs(localX-collider!.m_Center.x)<=collider!.m_Size.x/2 && Math.abs(localZ-collider!.m_Center.z)<=collider!.m_Size.z/2) {
          buffContacts.push({target:target.id,time});buffSeen.add(target.id);
        }
      }
    }
    // Friendly buff contacts never stop an allied projectile. Without native
    // actor penetration the first enemy collision terminates its flight.
    if(!penetrating&&hits.length){duration=time;positions.push({...position});break;}
    if(frame>=firstMove){
      position={x:position.x+unit.x*currentSpeed/fps,z:position.z+unit.z*currentSpeed/fps};
      if(acceleration!==0){
        const next=currentSpeed+acceleration/fps;
        currentSpeed=acceleration>0?Math.min(next,border):Math.max(next,border);
      }
    }
    positions.push(position);
  }
  return {duration,hits,buffContacts,end:position,positionAt,data};
}
