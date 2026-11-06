import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi,SupportCombatHit} from './combat-support-adapter';
interface Toy {id:number;hero:boolean;expires:number;tag:string;started:number;ends:number;speed:number;lease:string;generation:number;skillAt:number;pulseAt:number;growthAt:number;powerAt:number;acting:boolean}
interface RaruState extends Record<string,unknown>{toys:Toy[];sequence:number;shots:number;cannonLeft:number;cannonGeneration:number;transformedUntil:number;resident:boolean;powerAt:number}
const SOURCE='char_15801_combos_monster.unity3d',BULLET='Bullet_15801_Summon_Attack_Cannon_Support_Shoot';
const P22=hash('158_P22'),P25=hash('158_P25'),ADD=hash('158_FireTag_Add'),TRIGGER=hash('158_FireTag_Trigger'),P32=hash('158_P32');
export function createSupport158(potentials:Record<number,number>):SupportCombatAdapter<RaruState>{
  const has=(n:number)=>Boolean(potentials[515800+n]);
  const key=(api:SupportCombatApi,id:number)=>`${api.actor}#${id}`;
  const fire=(api:SupportCombatApi,id:number)=>{for(const actor of api.actorsByElement(2))api.buffs.add(actor,id,api.actor);};
  const allFire=(api:SupportCombatApi)=>api.actorsByElement(2).length===api.party.length;
  const count=(api:SupportCombatApi,toys:Toy[])=>api.emitProc?.('owned-minion-count-changed',{ownedMinionCount:toys.length});
  const dead=(toy:Toy,api:SupportCombatApi,absorb=false)=>{
    if(toy.lease)api.independentLease!(toy.lease,0);
    const duration=api.independentCombo!(toy.hero?'15801_Hero_Die':absorb?'15801_Soldier_LevelUp_P23':'15801_Soldier_Die',{source:SOURCE});
    api.despawn!(toy.id);return duration;
  };
  const born=(state:RaruState,api:SupportCombatApi,hero=false):RaruState=>{
    let toys=[...state.toys];
    if(hero){for(const old of toys.filter(t=>t.hero))dead(old,api);toys=toys.filter(t=>!t.hero);}
    const id=state.sequence+1;
    const life=api.parameter(hero?(has(29)?15829012:15823011):(has(29)?15829011:15832001));
    api.summon!(id,has(30)?[15830011]:[]);
    const duration=api.independentCombo!(hero?'15801_Hero_Born_P23':'15801_Soldier_Born',{source:SOURCE,entity:id});
    const toy:Toy={id,hero,expires:api.time+life,tag:'',started:api.time,ends:api.time+duration,speed:1,lease:'',generation:0,
      skillAt:0,pulseAt:0,growthAt:0,powerAt:0,acting:false};
    toys.push(toy);count(api,toys);state={...state,toys,sequence:id};
    const soldiers=toys.filter(t=>!t.hero).sort((a,b)=>(a.expires-b.expires)||a.id-b.id);
    if(!hero&&has(23)&&soldiers.length>=4){
      let delay=0;for(const soldier of soldiers)delay=dead(soldier,api,true);
      toys=toys.filter(t=>t.hero);count(api,toys);api.schedule('promote',delay);
      return {...state,toys};
    }
    if(soldiers.length>4){dead(soldiers[0]!,api);toys=toys.filter(t=>t.id!==soldiers[0]!.id);count(api,toys);state={...state,toys};}
    return state;
  };
  const shoot=(api:SupportCombatApi)=>api.projectile(has(22)?`${BULLET}_P22_Big`:BULLET,'boss',Math.max(0,api.distance-1));
  const markAdd=(api:SupportCombatApi,tags:number[])=>{if(tags.includes(ADD)||has(32)&&tags.includes(P32))api.buffs.add('boss',1011,api.actor);};
  return {
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>515800+n),
    actions:cinematics=>[{kind:'skill',skill:15832000,tag:'158_Support_Skill',loopCount:has(25)?6:4},
      {kind:'ultimate',skill:15840000,tag:cinematics?'158_Ultra_TL':'158_Ultra_NoTL'},
      {kind:'transformed-skill',skill:15834001,tag:'158_Skill_Ultra_Support'},
      {kind:'resident',skill:15810001,tag:'Attack_Ultra_Support',normal:true,automatic:true},
      {kind:'return',skill:15834002,tag:'158_Ultra_End',flag:64,automatic:true}],
    initialize:()=>({toys:[],sequence:0,shots:0,cannonLeft:0,cannonGeneration:0,transformedUntil:0,resident:false,powerAt:0}),
    cast(state,api,name){
      if(['skill','ultimate'].includes(name)&&!state.resident&&has(31)&&api.actorInfo(api.main).element===2)api.buffs.add(api.main,15831011,api.actor);
      if(name==='skill')return {...state,shots:0};
      if(name==='ultimate'){
        api.emitProc?.('own-transform-skill-created');if(has(32))api.buffs.add(api.actor,15832011,api.actor);
      }
      if(name==='transformed-skill'&&has(41))api.buffs.add(api.actor,15841011,api.actor);
      if(name==='return'){
        api.removeShield?.(15840011,api.actor);for(const actor of api.actorsByElement(2))api.buffs.remove(actor,15843011);
      }
      return state;
    },
    canCast:(state,api,name)=>name==='ultimate'?!state.resident:name==='skill'?!state.resident:
      name==='transformed-skill'||name==='resident'?state.resident&&api.time<state.transformedUntil:name==='return'?state.resident&&api.time>=state.transformedUntil:true,
    automatic:(state,api)=>state.resident?(api.time>=state.transformedUntil?'return':'resident'):null,
    end(state,api,name,interrupted){
      if(name==='ultimate'&&!interrupted){api.shield(15840011,api.actor);return {...state,resident:true,transformedUntil:api.time+api.parameter(15840001),powerAt:api.time+1};}
      if(name==='skill'){
        api.buffs.remove(api.actor,15842011);
        const remaining=(has(25)?6:4)-state.shots;
        if(remaining>0&&!state.resident){
          const generation=state.cannonGeneration+1;
          if(state.cannonGeneration)api.independentLease!(`cannon:${state.cannonGeneration}`,0);
          const delay=api.independentCombo!('15801_Cannon_Born',{source:SOURCE});
          api.schedule('cannon',delay,{generation,index:0});return {...state,cannonLeft:remaining,cannonGeneration:generation};
        }
      }
      if(name==='transformed-skill')api.buffs.remove(api.actor,15842011);
      if(name==='return'){api.buffs.remove(api.actor,15832011);return {...state,resident:false};}
      return state;
    },
    custom(state,api,name,data){
      if(name!=='158_Support_Shoot')return state;
      shoot(api);
      return data?.independentTag==='15801_Cannon_Attack_Support'?{...state,cannonLeft:Math.max(0,state.cannonLeft-1)}:{...state,shots:state.shots+1};
    },
    beforeHit(_state,api,tags){
      const rows:{id:number;count:number}[]=[];
      if(has(22)&&tags.includes(P22))rows.push({id:15822011,count:1});
      if(has(25)&&tags.includes(P25))rows.push({id:15825001,count:1});
      if(has(27)&&tags.includes(P25)&&api.hasBuffTag('boss','Fire'))rows.push({id:15827001,count:1});
      return rows;
    },
    afterHit(state,api,tags,hit){
      if(has(42)&&tags.includes(hash('158_P42')))api.buffs.add(api.actor,15842011,api.actor);
      if(has(22)&&tags.includes(P22)&&allFire(api))api.buffs.add('boss',15822011,api.actor);
      if(has(26)&&tags.includes(P22))api.buffs.add(api.actor,15826011,api.actor);
      if(has(33)&&tags.includes(hash('158_P33'))&&allFire(api))api.buffs.add('boss',15833011,api.actor);
      markAdd(api,tags);
      if(hit.weapon===BULLET||hit.weapon===`${BULLET}_P22_Big`){
        const native=api.weaponData!(hit.weapon,'WeaponFeatureHitTriggerArea');
        api.area(api.weaponName!(native.areaEffectPrefab.m_PathID));
        if(has(21))api.area(has(22)?'AreaEffect_15801_Support_Skill_Cannon_Boom_P21P22_BigFire':'AreaEffect_15801_Support_Skill_Cannon_Boom_P21_Fire');
        return born(state,api);
      }
      return state;
    },
    afterMinionHit(state,api,entity,hit,crit){
      markAdd(api,hit.tags);
      if(has(30)){
        api.buffs.add(key(api,entity),15830012,api.actor);
        if(crit)fire(api,15830013);
      }
      return state;
    },
    mark:tags=>tags.includes(TRIGGER)?{element:2,variant:2,hit:158000001}:null,
    shieldChanged(state,api,shield){if(shield.owner===api.actor)api.emitProc?.('own-shield-state-changed');return state;},
    tick(state,api){
      let toys=[...state.toys];
      for(const toy of toys.filter(t=>api.time>=t.expires))dead(toy,api);
      if(toys.some(t=>api.time>=t.expires)){toys=toys.filter(t=>api.time<t.expires);count(api,toys);}
      toys=toys.map(original=>{
        let t={...original};if(api.time<t.ends&&!t.acting)return t;
        const owner=key(api,t.id);
        if(!t.acting){t.acting=true;t.growthAt=api.time;t.powerAt=api.time+1+1/60;t.pulseAt=api.time+(t.hero?.5:1)+1/60;}
        if(has(29)&&api.time>=t.growthAt){api.buffs.add(owner,15829011,api.actor);t.growthAt+=30;}
        if(has(23)&&t.hero&&allFire(api)&&api.time>=t.powerAt){api.buffs.add(owner,15823011,api.actor);t.powerAt+=1;}
        if(has(28)&&api.time>=t.pulseAt){api.minionHit!(t.id,t.hero?158528002:158528001);t.pulseAt+=t.hero?.5:1;}
        const skill=has(24)&&api.time>=t.skillAt;
        const tag=t.hero?skill?'15801_Hero_Skill_Strengthen_Support':'15801_Hero_Attack_Support':skill?'15801_Soldier_Skill_Strengthen_Support':'15801_Soldier_Attack_Support';
        const skillId=t.hero?skill?15896004:15896003:skill?15895004:15895003;
        if(api.time<t.ends&&(tag===t.tag||!api.independentAllowed!(t.tag,api.time-t.started,skillId,SOURCE,t.speed)))return t;
        if(t.lease)api.independentLease!(t.lease,0);
        const generation=t.generation+1,lease=`toy:${t.id}:${generation}`,speed=api.summonAttribute!(t.id,47);
        api.independentLease!(lease,t.expires);
        const duration=api.independentCombo!(tag,{source:SOURCE,entity:t.id,speed,lease});
        return {...t,tag,started:api.time,ends:api.time+duration,speed,lease,generation,skillAt:skill?api.time+4:t.skillAt};
      });
      if(state.resident&&has(43)&&api.time>=state.powerAt&&api.time<state.transformedUntil){fire(api,15843011);state={...state,powerAt:api.time+1};}
      return {...state,toys};
    },
    event(state,api,name,data){
      if(name==='promote')return born(state,api,true);
      if(name==='cannon'&&data.generation===state.cannonGeneration){
        const index=Number(data.index);
        if(index===0||state.cannonLeft>0){
          const lease=`cannon:${state.cannonGeneration}`;
          const duration=api.independentCombo!('15801_Cannon_Attack_Support',{source:SOURCE,index:index===0?0:1,lease});
          api.independentLease!(lease,api.time+duration+1/60);
          api.schedule(name,duration,{...data,index:1});
        }else api.independentCombo!('15801_Cannon_Attack_Support',{source:SOURCE,index:2});
      }
      return state;
    },
  };
}
