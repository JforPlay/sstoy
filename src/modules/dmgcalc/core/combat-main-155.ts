import {combatTagHash as hash} from './combat-tags';
import {combatFixed} from './combat-weapons';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface Drone {id:number;color:'White'|'Black';expires:number;generation:number;lease:string;first:boolean}
interface ShiaState extends Record<string,unknown>{stage:number;sequence:number;drones:Drone[];orbits:{id:number;expires:number}[];curHits:number;lastHits:number;seen:boolean;burst:number;shooting:boolean;last1:number;last2:number}
const SOURCE='char_15501_combos_monster.unity3d',T=(s:string)=>hash(`155_${s}`);
const LB=T('Black_Attack'),LW=T('White_Attack'),BB=T('Black_Main_Skill_Shoot'),BW=T('White_Main_Skill_Shoot'),ULT=T('Ultra');
export function createMain155(potentials:Record<number,number>):SupportCombatAdapter<ShiaState>{
  const has=(n:number)=>Boolean(potentials[515500+n]);let cinematic=true;
  function command(api:SupportCombatApi,drone:Drone,tag:string,repeat=false):Drone{
    if(drone.lease)api.independentLease!(drone.lease,0);
    const generation=drone.generation+1,lease=`shia:${drone.id}:${generation}`;
    api.independentLease!(lease,drone.expires);
    // Native UAVs have useSummonHit=true: hits and weapon snapshots belong
    // to Shia, while independent leases prevent overlapping UAV commands.
    const duration=api.independentCombo!(tag,{source:SOURCE,lease});
    if(repeat)api.schedule('drone-next',duration+1/60,{id:drone.id,generation});
    return {...drone,generation,lease,first:false};
  }
  function whiteTag(stage:number){return `15501_White_Attack_${stage}${has(1)&&has(5)?'_P01P05':has(1)?'_P01':has(5)?'_P05':''}`;}
  function orbit(s:ShiaState,api:SupportCombatApi):ShiaState{
    if(s.orbits.length>=3||api.distance>20)return s;
    const cfg=api.weaponData!(has(6)?'Orbit_15501_Main_Skill_P06':'Orbit_15501_Main_Skill','OrbitEntity');
    const life=combatFixed(cfg.LeftTime)+(has(2)?1.85:0),orbitId=s.sequence+1;let sequence=orbitId;
    const drones=[...s.drones];
    for(const row of cfg.orbitNodeCfgs)for(const _ of row.attachOffsetRot){
      const id=++sequence,color:Drone['color']=row.monsterId===15531021?'Black':'White';
      const drone={id,color,expires:api.time+life,generation:0,lease:'',first:true};
      drones.push(command(api,drone,`15501_${color}_Born`,true));
    }
    api.schedule('orbit-end',life+1/60,{id:orbitId});
    if(has(11))api.buffs.add(api.actor,15511011,api.actor);
    return {...s,sequence,drones,orbits:[...s.orbits,{id:orbitId,expires:api.time+life}]};
  }
  function once(s:ShiaState,api:SupportCombatApi,tags:number[]){
    const result:{id:number;count:number}[]=[];
    if(tags.includes(T('P03')))for(const n of [3,4])if(has(n))result.push({id:15503011,count:api.buffs.count(api.actor,15503011)});
    if(has(5)&&tags.includes(LW))result.push({id:15505001,count:1});
    if(has(6)&&s.orbits.length&&(tags.includes(BW)||tags.includes(LW)))result.push({id:15506001,count:1});
    if(has(7)&&[BW,LW,T('P01_Boom'),T('P02_Boom')].some(t=>tags.includes(t)))result.push({id:15507001,count:api.buffs.count(api.actor,15507011)});
    if(has(8)&&tags.includes(LB))result.push({id:15508001,count:Math.min(s.lastHits,api.parameter(15508011))});
    if(has(10)&&s.orbits.length&&tags.includes(BB))result.push({id:15510001,count:1});
    if(has(11)&&api.distance>4)result.push({id:15511001,count:1});
    if(has(13)&&(api.bossHpPercent?.()??1)<.5)result.push({id:15513001,count:1});
    if(tags.includes(ULT)){if(has(42)&&api.buffs.count(api.actor,15542011))result.push({id:15542001,count:1});if(has(43))result.push({id:15543001,count:1});}
    return result;
  }
  return {
    potentials:[1,2,3,4,5,6,7,8,9,10,11,12,13,41,42,43].map(n=>515500+n),
    actions(cinematics){cinematic=cinematics;return [{kind:'normal',skill:15510000,tag:'Attack_1',normal:true,automatic:true},
      {kind:'skill',skill:15531000,tag:'155_Main_Skill',cooldownTiming:'end'},
      {kind:'ultimate',skill:15540000,tag:cinematics?'155_Ultra_TL':'155_Ultra_NoTL',loopBodySeconds:4.2},
      {kind:'dodge',skill:15520000,tag:[3],flag:16,automatic:true,charges:has(12)?2:1,spBudget:null}];},
    initialize(api){api.schedule('companions',1/60);return {stage:0,sequence:2,drones:[],orbits:[],curHits:0,lastHits:0,seen:false,burst:0,shooting:false,last1:-1,last2:-1};},
    automatic:()=> 'normal',comboTag:(s,_api,key)=>key==='normal'?`Attack_${s.stage+1}`:null,
    end:(s,_api,key)=>key==='normal'?{...s,stage:(s.stage+1)%4}:key==='ultimate'?{...s,shooting:false}:s,
    cast(s,api,key){if(key!=='ultimate')return s;
      if(has(42)&&api.party.filter(id=>id!==api.actor).every(id=>api.ultimateCooling?.(id)))api.buffs.add(api.actor,15542011,api.actor);
      const burst=s.burst+1;if(cinematic)api.schedule('ult-start',.2,{burst});return {...s,burst,shooting:true};
    },
    phase(s,api,key,phase){if(!cinematic&&key==='ultimate'&&phase==='anticipation')api.schedule('ult-start',.2,{burst:s.burst});return s;},
    custom(s,api,name){
      const match=/^Attack_([1-4])$/.exec(name);
      if(match){const n=Number(match[1]),color=n%2?'White':'Black';
        if(color==='Black'&&has(8))s={...s,lastHits:s.curHits,curHits:0,seen:false};
        return {...s,drones:s.drones.map(d=>d.id<=2&&d.color===color?command(api,d,color==='White'?whiteTag(n):`15501_Black_Attack_${n}`):d)};
      }
      if(name==='Summon_Orbit')return orbit(s,api);
      if(name==='Shoot_P3'&&has(3)&&api.distance<=10)api.projectile('Bullet_15501_Summon_Attack_Black_Missile_P03_1');
      if(name==='Shoot_P4'&&has(4)&&api.distance<=10)api.projectile('Bullet_15501_Summon_Main_Skill_Black_Missile_P04_1');
      return s;
    },
    event(s,api,name,data){
      if(name==='companions')return {...s,drones:[{id:1,color:'White',expires:Infinity,generation:0,lease:'',first:true},{id:2,color:'Black',expires:Infinity,generation:0,lease:'',first:true}]};
      if(name==='drone-next')return {...s,drones:s.drones.map(d=>{
        if(d.id!==data.id||d.generation!==data.generation||d.expires<=api.time)return d;
        const tag=d.color==='Black'?'15501_Black_Main_Shoot':has(2)?d.generation===1?'15501_White_Main_Shoot_Strengthen':'15501_White_Main_Shoot_P02':'15501_White_Main_Shoot';
        return command(api,d,tag,true);
      })};
      if(name==='orbit-end'){
        const drones=s.drones.filter(d=>d.expires>api.time);for(const d of s.drones)if(d.expires<=api.time)api.independentLease!(d.lease,0);
        const orbits=s.orbits.filter(o=>o.id!==data.id);if(!orbits.length&&has(11))api.buffs.remove(api.actor,15511011);
        return {...s,drones,orbits};
      }
      if(name==='ult-start'&&data.burst===s.burst){const step=has(43)?.08:.1;for(let n=0;n*step<4-1e-9;n++)api.schedule('ult-shot',Math.ceil(n*step*60-1e-9)/60,{burst:s.burst});}
      if(name==='ult-shot'&&data.burst===s.burst&&s.shooting){
        const radius=Math.sqrt(api.randomPercent()/100)*4,angle=api.randomPercent()/100*2*Math.PI;
        api.area('AreaEffect_15501_Ultra','boss',{x:api.distance+radius*Math.cos(angle),z:radius*Math.sin(angle)});
      }
      return s;
    },
    attacked(s,api,tags){
      for(const [n,tag] of [[3,T('P03_Missile')],[4,T('P04_Missile')]])if(has(n!)&&tags.includes(tag!))api.buffs.add(api.actor,15503011,api.actor);
      if(has(8)&&tags.includes(LB)&&!s.seen)return {...s,seen:true,curHits:s.curHits+1};return s;
    },
    beforeHit:once,
    afterHit(s,api,tags){
      s={...s};for(const n of [1,2])if(has(n)&&tags.includes(T(n===1?'P01_Boom':'P02_Boom'))){
        const key=n===1?'last1':'last2';if(api.time>s[key])api.buffs.add('boss',15501011,api.actor);
        if(api.buffs.count('boss',15501011)>=20){api.buffs.remove('boss',15501011);api.hit(155310101);s[key]=api.time;}
      }return s;
    },
    crit(s,api,hit){if(has(41)&&hit.tags.includes(ULT))api.buffs.add(api.actor,15541011,api.actor);return s;},
    mark:tags=>tags.includes(T('LightMark_Hurt'))?{element:5,variant:1,area:'AreaEffect_15501_LightTag_Boom'}:null,
    markTriggered(s,api,element,_tags,source){if(element===5&&source===api.actor){api.emitProc?.('own-light-mark');if(has(7))api.buffs.add(api.actor,15507011,api.actor);if(has(12))api.buffs.add(api.actor,15512011,api.actor);}return s;},
  };
}
