import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface Wall {angle:number;expires:number}
interface AnzuState extends Record<string,unknown>{walls:Wall[];areas:number;p22:number;p33Hit:boolean;boomAt:number}
const WALL='AreaEffect_123_B2_WindWall',WAVE='AreaEffect_123_B2_WindWall_Wave_Buff',WAVE_HIT='AreaEffect_123_B2_WindWall_Wave_Hit';
const HIT=hash('123WindWallAtk'),BOOM=hash('123FengBoom');
const fixed=(v:any)=>typeof v==='number'?v:Number(v?._serializedValue??0)/4294967296;
/** Liang–Barsky segment clipping in the native rectangular wall's local space. */
export function crossesAnzuWall(distance:number,angle:number,area:Record<string,any>):boolean{
  const radians=angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
  const x0=-fixed(area.hitBoxOffset.y),z0=-fixed(area.hitBoxOffset.x),dx=distance*cos,dz=-distance*sin;
  let lo=0,hi=1;
  for(const [start,delta,half] of [[x0,dx,fixed(area.hitBoxLength)/2],[z0,dz,fixed(area.hitBoxWidth)/2]]){
    if(Math.abs(delta!)<1e-12){if(Math.abs(start!)>half!)return false;continue;}
    const a=(-half!-start!)/delta!,b=(half!-start!)/delta!;
    lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return false;
  }
  return true;
}
export function createSupport123(potentials:Record<number,number>):SupportCombatAdapter<AnzuState>{
  const has=(n:number)=>Boolean(potentials[512300+n]);
  function wall(state:AnzuState,api:SupportCombatApi,angle:number){
    const duration=api.area(WALL,api.actor,{x:0,z:0,angle});
    api.area(WAVE,api.actor,{x:0,z:0,angle,duration,enemyEnterBuffs:has(30)?[12353011]:undefined});
    if(has(23))api.area(WAVE_HIT,api.actor,{x:0,z:0,angle,duration});
    return {...state,walls:[...state.walls.filter(w=>w.expires>api.time),{angle,expires:api.time+duration}]};
  }
  return {
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>512300+n),
    actions:cinematics=>[{kind:'skill',skill:12332000,tag:'B2_Skill'},{kind:'ultimate',skill:12340000,tag:cinematics?'Ultra_TL':'Ultra_NoTL'}],
    initialize(api){if(has(42))api.buffs.add(api.actor,12354211,api.actor);return {walls:[],areas:0,p22:-1,p33Hit:false,boomAt:-1};},
    cast(state,api,key){if(key==='skill')for(const actor of api.party)api.buffs.add(actor,12393015,api.actor);return state;},
    custom(state,api,name){
      if(name==='123WindWallShoot'){
        if(has(21)){state=wall(state,api,45);state=wall(state,api,-45);}state=wall(state,api,0);
        if(has(26))api.buffs.add(api.main,12352611,api.actor);
      }
      if(name==='xingzixiqi'&&has(42))api.area('AreaEffect_123_Ultra_T42',api.actor,{x:0,z:0});
      if(name==='xingzihoujiao'){
        // No enemy projectile emitter exists in the stationary raid profile.
        // Zero cleared bullets must not manufacture P43 SP or LB3 buffs.
        api.emitProc?.('own-ultimate-clear-bullets',{blockedBulletCount:0});
        if(has(41))api.shield(12354101,api.main);
      }
      return state;
    },
    projectileModifiers(state,api,source,_name,distance){
      const attributes:{id:number;count:number;source:string}[]=[],area=api.weaponData!(WALL,'AreaEffectEntity');
      let speedMultiplier=1;
      for(const wall of state.walls)if(wall.expires>api.time&&crossesAnzuWall(distance,wall.angle,area)){
        if(has(24)&&source!==api.main)continue;
        const modifier=api.weaponData!(WALL,'AreaEffect_ModifyBulletSpeedComponent');
        attributes.push({id:has(24)?12324001:Number(modifier.additionalAttrId),count:1,source:api.actor});
        speedMultiplier*=1+fixed(modifier.modifySpeedPercent)/100;
      }
      return {attributes,speedMultiplier};
    },
    preparePartyHit(state,api,hit){return {...state,p33Hit:has(33)&&api.actorInfo(hit.actor).element===4&&api.randomPercent()<35};},
    beforePartyHit:(state)=>state.p33Hit?[{id:12353301,count:1}]:[],
    beforeHit:(_state,_api,tags)=>has(31)&&tags.includes(HIT)?[{id:12353101,count:1}]:[],
    afterHit(state,api,tags){
      if(tags.includes(HIT)){
        if(has(25))api.buffs.add('boss',12352511,api.actor);
        if(has(28))api.buffs.add('boss',12352811,api.actor);
      }
      // The new Parallel controller also retains this base 25% wind-boom
      // trigger; support-only potentials do not unlock the old main perks.
      if(api.randomPercent()<25&&tags.includes(BOOM)&&(state.boomAt<0||api.time-state.boomAt>1)){
        api.area('AreaEffect_123_FengBoom');return {...state,boomAt:api.time};
      }
      return state;
    },
    weaponBegin(state,api,name){
      if(!name.startsWith('AreaEffect_'))return state;
      if(has(32)&&!api.buffs.count(api.main,12353211))api.buffs.add(api.main,12353211,api.actor);
      return {...state,areas:state.areas+1};
    },
    areaEnd(state,api,name){
      const areas=Math.max(0,state.areas-1);
      if(has(32)&&areas===0)api.buffs.remove(api.main,12353211);
      if(has(30)&&name===WAVE&&!api.activeAreas?.('123WindWallBuff'))api.buffs.remove('boss',12353011);
      return {...state,areas,walls:state.walls.filter(w=>w.expires>api.time)};
    },
    event(state,api,name){
      if(name==='main-wall-exit'){
        if(has(22)&&(state.p22<0||api.time-state.p22>2)){api.shield(12322001,api.main);api.buffs.add(api.main,12352211,api.actor);state={...state,p22:api.time};}
        if(has(29))api.buffs.add(api.main,12352911,api.actor);
      }
      if(name==='blocked-bullet'&&has(27))api.buffs.add(api.main,12352711,api.actor);
      return state;
    },
  };
}
