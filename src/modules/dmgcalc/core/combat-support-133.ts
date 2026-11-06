import {combatTagHash as hash} from './combat-tags';
import {createMain133,type WindChannelState} from './combat-main-133';
import {combatFixed} from './combat-weapons';
import type {SupportCombatAdapter} from './combat-support-adapter';
interface PetalState extends WindChannelState{
  regions:Record<string,number>;extraUntil:number;flowerGeneration:number;groupsLeft:number;
  groupDue:number;groupPausedDelay:number;lastExtra:number|null;lastAttack:number|null;flowers:number;
}
const PETAL=hash('133Petal'),REGION=hash('133_B2_PetalRegion'),SUP32=hash('133_Sup32'),ULT=hash('133Ultra');
const BASE='AreaEffect_13301_PetalRegion',TIME='AreaEffect_13301_PetalRegion_Time23',EXTRA='AreaEffect_13301_PetalRegion_Perk23';
const active=(state:PetalState)=>Object.values(state.regions).reduce((sum,count)=>sum+count,0);
export function createSupport133(potentials:Record<number,number>):SupportCombatAdapter<PetalState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const common=createMain133(Object.fromEntries(Object.entries(potentials).filter(([id])=>Number(id)>=513341)));
  return {
    potentials:[513321,513322,513323,513324,513325,513326,513327,513328,513329,513330,513331,513332,513333,513341,513342,513343],
    actions:cinematics=>[{kind:'skill',skill:13332000,tag:has(513323)?'133_B2P23':'133_B2'},common.actions(cinematics).at(-1)!],
    initialize(api){
      if(has(513333))for(const actor of api.actorsByElement(4))if([1,2].includes(api.actorInfo(actor).job))api.buffs.add(actor,13353311,api.actor);
      return {...common.initialize(api),regions:{},extraUntil:-1,flowerGeneration:0,groupsLeft:0,
        groupDue:0,groupPausedDelay:0,lastExtra:null,lastAttack:null,flowers:0};
    },
    cast(state,api,key){
      if(key==='ultimate')return {...state,...common.cast!(state,api,key)};
      if(key!=='skill')return state;
      api.stopAreasByTag?.('133petalRegion');
      if(has(513321)&&api.actorInfo(api.main).element===4){
        const flowerGeneration=state.flowerGeneration+1;
        const delay=state.groupsLeft>0?Math.max(0,state.groupDue-api.time):state.groupPausedDelay;
        api.schedule('flower-group',delay,{flowerGeneration});
        return {...state,extraUntil:-1,flowerGeneration,groupsLeft:3,groupDue:api.time+delay};
      }
      return {...state,extraUntil:-1};
    },
    custom(state,api,name){
      return name==='133_PetalRegion_Extra'?{...state,extraUntil:api.time+9}:state;
    },
    tick(state,api){
      if(state.extraUntil>=0&&api.time>state.extraUntil){
        api.stopAreasByTag?.('133petalRegion');return {...state,extraUntil:-1};
      }
      return state;
    },
    event(state,api,name,data){
      if(name==='flower-group'&&data.flowerGeneration===state.flowerGeneration&&state.groupsLeft>0){
        const entity=api.entityData!('13301_B2_flower');
        const frame=(time:number)=>Math.ceil(time*60-1e-9)/60;
        const born=frame(combatFixed(entity.bornTime)),interval=frame(combatFixed(entity.shootDeltaTime));
        const count=(entity.animationNames as string[]).length,pointers=entity.bulletPrefabs as {m_PathID:string}[];
        if(count<1||pointers.length<count)throw new Error('Missing native flower shot sequence');
        for(let shot=0;shot<count;shot++)api.schedule('flower-shot',born+shot*interval,{projectile:api.weaponName!(pointers[shot]!.m_PathID)});
        const groupsLeft=state.groupsLeft-1;
        if(groupsLeft)api.schedule(name,2.5,data);
        return {...state,groupsLeft,groupDue:api.time+2.5,groupPausedDelay:2.5,flowers:state.flowers+1};
      }
      if(name==='flower-shot')api.projectile(String(data.projectile));
      return state;
    },
    beforeHit(state,api,tags){
      const once=common.beforeHit!(state,api,tags);
      if(tags.includes(PETAL)){
        if(has(513322))once.push({id:13352211,count:1});
        if(has(513326))once.push({id:13352601,count:1});
        if(has(513327))once.push({id:13352701,count:1});
      }
      if(tags.includes(REGION)){
        if(has(513328)){once.push({id:13352801,count:1});if(active(state)>=3)once.push({id:13352802,count:1});}
        if(has(513330))once.push({id:13353001,count:1});
      }
      if(has(513332)&&tags.includes(SUP32)&&active(state)>0)once.push({id:13353201,count:1});
      return once;
    },
    afterHit(state,api,tags,hit){
      if(has(513325)&&tags.includes(PETAL))api.buffs.add('boss',13352511,api.actor);
      if(has(513329)&&tags.includes(REGION))api.buffs.add('boss',13352911,api.actor);
      if(has(513331)&&tags.includes(ULT))api.buffs.add('boss',2011,api.actor);
      return {...state,...common.afterHit!(state,api,tags,hit)};
    },
    partyHit(state,api,hit){
      if(hit.actor===api.actor||api.actorInfo(hit.actor).element!==4)return state;
      const total=active(state);
      if(has(513324)&&total>0&&(state.lastAttack===null||api.time-state.lastAttack>1)){
        for(const [area,count] of Object.entries(state.regions))for(let n=0;n<count;n++)
          api.area(area===EXTRA?'AreaEffect_13301_B2P23P24_PetalRegionAtk':'AreaEffect_13301_B2P24_PetalRegionAtk');
        return {...state,lastAttack:api.time};
      }
      if(has(513323)&&total===0&&state.extraUntil>api.time&&(state.lastExtra===null||api.time-state.lastExtra>1)){
        api.area(EXTRA);return {...state,lastExtra:api.time};
      }
      return state;
    },
    weaponDuration:common.weaponDuration,
    weaponBegin(state,api,name){
      state={...state,...common.weaponBegin!(state,api,name)};
      if([BASE,TIME,EXTRA].includes(name))return {...state,regions:{...state.regions,[name]:(state.regions[name] ?? 0)+1}};
      if(has(513327)&&name.startsWith('Bullet_13301_Skill2_Petal'))api.buffs.add(api.actor,13352711,api.actor);
      return state;
    },
    weaponEnd(state,api,name){
      state={...state,...common.weaponEnd!(state,api,name)};
      if(![BASE,TIME,EXTRA].includes(name))return state;
      if(has(513330))api.area(name===EXTRA?'AreaEffect_13301_B2P30P23_Boom':'AreaEffect_13301_B2P30_Boom');
      return {...state,regions:{...state.regions,[name]:Math.max(0,(state.regions[name] ?? 0)-1)}};
    },
    mark:common.mark,
  };
}
