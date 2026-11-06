import {matchesCombatTargetFilter,type CombatFilterActor,type CombatTargetFilterContext,type CombatTargetFilter} from './combat-target-filter';
export interface ExtractedWeaponComponent { type: string; data: Record<string, any> }
export interface ExtractedCombatWeapon { name: string; pathId: string; components: ExtractedWeaponComponent[] }
export interface WeaponImpact { time: number; hitId: number; feature: Record<string, any>; featureFlags: number; snapshot: boolean;
  sharedImmunity?:{group:number;duration:number} }
export interface WeaponPlan { impacts: WeaponImpact[]; duration: number; finishArea?: string; snapshot: boolean }
export interface AreaBuffChange { time: number; add: number[]; remove: number[]; target?:string;
  /** Updates cancellation cleanup as a moving area's collision inventory changes. */
  tracking?:'enter'|'exit';exitKey?:string }
export interface AreaBuffTargets {owner:CombatFilterActor;candidates:CombatFilterActor[];context:CombatTargetFilterContext;
  contains?:(actor:string,time:number)=>boolean;moving?:boolean}
/** Stationary opposing monster inside the area throughout its lifetime.
 * Do not silently reuse this filter for friendly actors or tag-filtered areas. */
export function planCombatAreaBuffs(weapon: ExtractedCombatWeapon, fps: number,targets?:AreaBuffTargets): AreaBuffChange[] {
  const area = weapon.components.find(component => component.type === 'AreaEffectEntity')?.data;
  if (!area) return [];
  const tick = (value: number) => Math.ceil((value - 1e-9) * fps) / fps;
  const duration = tick(combatFixed(area.duration)), result: AreaBuffChange[] = [];
  const recipients = (criteria: CombatTargetFilter|undefined,at?:number): (string|undefined)[] => {
    if(targets) return targets.candidates.filter(target=>matchesCombatTargetFilter(targets.owner,target,criteria,targets.context)
      && (at===undefined || !targets.contains || targets.contains(target.id,at))).map(target=>target.id);
    const filters = criteria?.filterCriteriaList ?? [];
    if (!filters.length) return [];
    if (filters.length !== 1 || filters[0]!.targetType !== 16 || filters[0]!.elementType !== 254 || filters[0]!.monsterEpicType !== 30) {
      throw new Error(`Area ${weapon.name} requires its target filter handler`);
    }
    // The legacy point-target scenario supplies only the opposing boss. All
    // richer actor/element criteria require an explicit collision inventory.
    const owner:CombatFilterActor={id:'owner',player:true,main:true,element:5,summoner:null,minion:false};
    const boss:CombatFilterActor={id:'boss',player:false,main:false,element:1,monsterEpic:7,summoner:null,minion:false};
    return matchesCombatTargetFilter(owner,boss,criteria,{actors:[owner,boss],relation:()=> 'enemy'}) ? [undefined] : [];
  };
  for (const [componentIndex,{data}] of weapon.components.filter(component => component.type === 'AreaEffect_BuffComponent').entries()) {
    if (data.checkTargetWithTag || data.removeBuffGroupId || data.removeBuffTag || data.removeBuffCount || data.finish_TriggerEnter || data.finish_TriggerExit) {
      throw new Error(`Area ${weapon.name} requires its conditional buff handler`);
    }
    const add = (data.addBuffIdList ?? []).filter((id: number) => id > 0), remove = (data.removeBuffIdList ?? []).filter((id: number) => id > 0);
    const repeat = (ids: number[], interval: number, criteria: any, removing: boolean) => {
      if (!ids.length) return;
      const first = data.executeImmediately ? 0 : interval > 0 ? tick(interval) : Infinity;
      for (let at = first; at < duration; at += interval > 0 ? tick(interval) : Infinity) {
        for(const target of recipients(criteria,at)) result.push({time: at, add: removing ? [] : ids, remove: removing ? ids : [],...(target ? {target} : {})});
      }
    };
    repeat(add, combatFixed(data.addInterval), data.addCriteriaInfo, false);
    repeat(remove, combatFixed(data.removeInterval), data.removeCriteriaInfo, true);
    if(targets?.moving && targets.contains){
      const enter=new Set(recipients(data.triggerEnterCriteriaInfo)),exit=new Set(recipients(data.triggerExitCriteriaInfo));
      for(const candidate of targets.candidates){
        const target=candidate.id,exitKey=`${componentIndex}:${target}`;
        let inside=false;
        for(let frame=0;frame<=Math.round(duration*fps);frame++){
          const at=frame/fps,next=at<duration && targets.contains(target,at);
          if(next&&!inside){
            if(data.triggerExit&&exit.has(target))result.push({time:at,add,remove,target,tracking:'enter',exitKey});
            if(data.triggerEnter&&enter.has(target))result.push({time:at,add,remove,target});
          }
          if(!next&&inside&&data.triggerExit&&exit.has(target)){
            result.push({time:at,add:[],remove:[],target,tracking:'exit',exitKey});
            result.push({time:at,add,remove,target});
          }
          inside=next;
        }
      }
    } else {
      if (data.triggerEnter) for(const target of recipients(data.triggerEnterCriteriaInfo,0)) result.push({time:0,add,remove,...(target ? {target} : {})});
      if (data.triggerExit) for(const target of recipients(data.triggerExitCriteriaInfo,0)) result.push({time:duration,add,remove,...(target ? {target} : {})});
    }
  }
  return result.sort((a,b) => a.time - b.time);
}
export const combatFixed = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && '_serializedValue' in value) return Number(value._serializedValue) / 4294967296;
  throw new Error('Missing fixed-point combat value');
};
/** Point-target weapon timing. Geometry is supplied by the scenario (stationary
 * target distance), never inferred from damage coefficients or icon assets. */
export function planCombatWeapon(weapon: ExtractedCombatWeapon, distance: number, fps: number, hitOverride?: number,
  weapons: ExtractedCombatWeapon[] = [], rules:Record<string,number> = {}): WeaponPlan {
  if (!Number.isFinite(distance) || distance < 0 || fps <= 0) throw new Error('Invalid weapon geometry');
  const tick = (value: number) => Math.ceil((value - 1e-9) * fps) / fps;
  const component = (type: string) => weapon.components.find(component => component.type === type)?.data;
  const curved=component('AdventureBezier3DBullet');
  if(curved){
    if(rules.AssumeBezier3DFirstContact!==1)throw new Error(`3D guided projectile ${weapon.name} requires an explicit first-contact assumption`);
    const flight=combatFixed(curved.flyTime),delay=combatFixed(curved.delayMove),life=combatFixed(curved.lifeTime);
    if(flight<=0||life<=0)throw new Error('Invalid native guided-projectile lifetime');
    // Trace phase performs no hit test. One update changes to AccMove;
    // the following base AdventureBullet update is its first hit test.
    const impact=Math.max(1/fps,tick(delay))+tick(flight)+1/fps;
    const hitId=hitOverride ?? curved.hitDamageId,snapshot=!curved.useOwnerActorInfo;
    return {duration:impact+tick(life),snapshot,impacts:hitId?[{time:impact,hitId,
      feature:curved.hitFeatureData ?? {},featureFlags:curved.hitFlags ?? 0,snapshot}]:[]};
  }
  const rotating=component('AdventureRotateWeapon');
  if(rotating){
    if(rules.AssumeContinuousRotateContact!==1)throw new Error(`Rotating weapon ${weapon.name} requires an explicit sustained-contact assumption`);
    const life=combatFixed(rotating._duration),warning=rotating.enableEarlyWarningEffect?tick(combatFixed(rotating.earlyWarningDuration)):0;
    if(life<=0)throw new Error(`Rotating weapon ${weapon.name} needs an explicit cancellation lifetime`);
    const interval=combatFixed(rotating.hitTestInterval)||rules.Combat_HitboxDamageImmuneDuration;
    if(interval===undefined||interval<=0)throw new Error('Missing rotating-weapon hit immunity interval');
    const period=Math.floor(interval*fps+1e-9)+1;
    const lastFrame=Math.floor(life*fps+1e-9)+1,impacts:WeaponImpact[]=[];
    for(let frame=1;frame<=lastFrame;frame+=period)impacts.push({
      time:warning+frame/fps,hitId:hitOverride ?? rotating.hitDamageId,feature:rotating.hitFeatureData ?? {},
      // AdventureRotateWeapon.OnHitActor calls Damage(_owner), not
      // Damage(this). Actor targets therefore use live owner attributes.
      featureFlags:rotating.hitFlags ?? 0,snapshot:false,
    });
    return {duration:warning+(lastFrame+1)/fps,snapshot:false,impacts};
  }
  const area = component('AreaEffectEntity');
  if (area) {
    const following=component('AreaEffect_FollowComponent');
    const limit=following?.finishAfterFollowTime&&combatFixed(following.followTime)>0?combatFixed(following.followTime):Infinity;
    const duration = tick(Math.min(combatFixed(area.duration),limit));
    const impacts: WeaponImpact[] = [];
    for (const attack of weapon.components.filter(component => component.type === 'AreaEffect_AttackComponent').map(component => component.data)) {
      const delay = combatFixed(attack.hitDelay), interval = combatFixed(attack.hitInterval);
      const first = delay > 0 ? tick(delay) : attack.hitImmediately ? 0 : interval > 0 ? tick(interval) : Infinity;
      let occurrence = 1;
      for (let time = first; time < duration - 1e-9; time += interval > 0 ? tick(interval) : Infinity) {
        const configuredId = attack.hitDamageIdList?.[occurrence] ?? attack.hitDamageId;
        const hitId = hitOverride ?? configuredId;
        if (hitId) impacts.push({ time, hitId, feature: attack.hitFeatureData ?? {}, featureFlags: attack.hitFlags ?? 0, snapshot: !area.copyBattleDataBeforeAttack,
          ...(area.shareSameDamageImmuneDuration&&area.areaHashCode?{sharedImmunity:{group:Number(area.areaHashCode),duration:combatFixed(attack.damageImmuneDuration)}}:{}) });
        occurrence++;
      }
    }
    return { impacts, duration, snapshot: !area.copyBattleDataBeforeAttack };
  }
  const bezier=component('AdventureBezierBullet');
  if(bezier) {
    const flight=combatFixed(bezier.flyTime),delay=combatFixed(bezier.delayMove);
    if(flight<=0) throw new Error(`Invalid bezier flight time ${weapon.name}`);
    // AdventureBezierBullet tests _flyTimer/flyTime before advancing it. The
    // arrival hit is therefore on the following update, never at launch time.
    const duration=Math.max(1/fps,tick(delay))+tick(flight);
    const hitId=hitOverride ?? bezier.hitDamageId,snapshot=!bezier.useOwnerActorInfo;
    const finishId=component('WeaponFeatureFinishTriggerArea')?.areaEffectPrefab?.m_PathID;
    const finishArea=finishId&&finishId!=='0'?weapons.find(weapon=>weapon.pathId===finishId)?.name:undefined;
    if(finishId&&finishId!=='0'&&!finishArea)throw new Error(`Missing bezier finish area ${finishId}`);
    return {duration,snapshot,finishArea,impacts:hitId ? [{time:duration,hitId,feature:bezier.hitFeatureData ?? {},featureFlags:bezier.hitFlags ?? 0,snapshot}] : []};
  }
  const projectile=component('AdventureProjectile');
  if(projectile) {
    const minimum=projectile.useCustomMinJumpDuration ? combatFixed(projectile.customMinJumpDuration) : rules.Combat_MinJumpDuration;
    if(minimum===undefined) throw new Error('Missing native Combat_MinJumpDuration');
    const speed=combatFixed(projectile.moveSpeed);
    if(!projectile.useLifeTime && speed<=0) throw new Error(`Invalid thrown projectile speed ${weapon.name}`);
    const duration=tick(Math.max(minimum,projectile.useLifeTime ? combatFixed(projectile.lifeTime) : distance/speed));
    const snapshot=!projectile.useOwnerActorInfo,hitId=hitOverride ?? projectile.hitDamageId;
    const finishId=component('WeaponFeatureFinishTriggerArea')?.areaEffectPrefab?.m_PathID;
    const finishArea=finishId&&finishId!=='0'?weapons.find(weapon=>weapon.pathId===finishId)?.name:undefined;
    if(finishId&&finishId!=='0'&&!finishArea)throw new Error(`Missing thrown-projectile finish area ${finishId}`);
    return {duration,snapshot,finishArea,impacts:hitId ? [{time:duration,hitId,feature:projectile.hitFeatureData ?? {},featureFlags:projectile.hitFlags ?? 0,snapshot}] : []};
  }
  const following=component('AdventureFbxFollowBullet');
  if(following) {
    if(combatFixed(following.acceleratedVelocity)!==0 || following.reboundTime && !rules.SingleEnemyMainRebound) throw new Error(`Following projectile ${weapon.name} requires rebound/acceleration simulation`);
    const speed=combatFixed(following.moveSpeed),life=combatFixed(following.lifeTime);
    if(speed<=0) throw new Error(`Invalid following projectile speed ${weapon.name}`);
    const impact=Math.max(1/fps,tick(combatFixed(following.delayMove)+distance/speed));
    const hitId=hitOverride ?? following.hitDamageId,snapshot=!following.useOwnerActorInfo;
    if(following.reboundTime) {
      const impacts:WeaponImpact[]=[],leg=impact,range=following.reboundRange;
      if(leg>=life) return {duration:life,snapshot,impacts};
      let at=leg,count=0,target='boss',nextId=hitId;
      for(let guard=0;guard<2*following.reboundTime+3;guard++) {
        if(target==='boss' && nextId) impacts.push({time:at,hitId:nextId,feature:following.hitFeatureData ?? {},featureFlags:following.hitFlags ?? 0,snapshot});
        if(count>=following.reboundTime) return {duration:at,snapshot,impacts};
        if(target==='boss') {
          if(!following.EnableReboundMainCtr || distance>=range) return {duration:at,snapshot,impacts};
          target='main';if(following.reboundMainCtrCost)count++;
        } else {
          if(distance>=range) return {duration:at,snapshot,impacts};
          target='boss';nextId=hitOverride ?? following.hitDmgs?.[count] ?? following.hitDamageId;count++;
        }
        // Each rebound resets the projectile's lifetime, delay and per-target
        // hit record. A friendly return never counts as enemy damage or SP.
        at+=leg+1/fps;
      }
      throw new Error(`Runaway following projectile rebound ${weapon.name}`);
    }
    // This targeted, non-rebounding type finishes on its target, not at its
    // maximum lifetime. Friendly delivery is dispatched without enemy damage.
    return {duration:Math.min(life,impact),snapshot,impacts:hitId && impact<life ? [{time:impact,hitId,feature:following.hitFeatureData ?? {},featureFlags:following.hitFlags ?? 0,snapshot}] : []};
  }
  const bullet = component('AdventureBullet');
  const bomb = component('AdventureBomb');
  const data = bullet ?? bomb;
  if (!data) throw new Error(`Unsupported weapon timing ${weapon.name}`);
  const snapshot = !data.useOwnerActorInfo;
  const finishFeature = component('WeaponFeatureFinishTriggerArea');
  const finishId = finishFeature?.areaEffectPrefab?.m_PathID;
  const finishArea = finishId && finishId !== '0' ? weapons.find(weapon => weapon.pathId === finishId)?.name : undefined;
  let duration: number, impact: number;
  if (bomb) {
    const timer = component('BombComponent_Time');
    if (!timer) throw new Error(`Missing bomb fuse ${weapon.name}`);
    // BombComponent_Time only arms the explosion; AdventureBomb then waits
    // its own delayExplosionTime coroutine before dealing damage/finishing.
    duration = Math.max(1 / fps, tick(combatFixed(timer.time))) + tick(combatFixed(data.delayExplosionTime ?? 0));
    impact = duration;
  } else {
    duration = tick(combatFixed(data.lifeTime));
    const speed = combatFixed(data.moveSpeed);
    if (speed <= 0) throw new Error(`Invalid projectile speed ${weapon.name}`);
    impact = tick(combatFixed(data.delayMove) + distance / speed);
  }
  const hitId = hitOverride ?? data.hitDamageId;
  return { impacts: hitId && impact <= duration ? [{ time: impact, hitId, feature: data.hitFeatureData ?? {}, featureFlags: data.hitFlags ?? 0, snapshot }] : [], duration, finishArea, snapshot };
}
