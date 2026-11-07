import {combatTagHash as hash} from './combat-tags';
import {combatFixed} from './combat-weapons';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface Avatar {id:number;stage:number;generation:number;lease:string;expires:number}
interface NanohaState extends Record<string,unknown>{stage:number;normals:number;sequence:number;avatars:Avatar[]}
const SOURCE='char_11901_combos_monster.unity3d',NORMAL=hash('119NrmAtk'),SKILL=hash('119Skill1Atk'),WIND=hash('WindTag1Boom');
export function createMain119(potentials:Record<number,number>):SupportCombatAdapter<NanohaState>{
  const has=(n:number)=>Boolean(potentials[511900+n]);
  const bullet=()=>`Bullet_11901_Skill1_${has(3)&&has(4)?'T3T4_':has(3)?'T3_':has(4)?'T4_':''}BulltA`;
  function shoot(api:SupportCombatApi,count=1){
    const name=bullet(),data=api.weaponData!(name,'AdventureBoomerang');api.projectile(name);
    if(has(5))api.buffs.add(api.actor,11950511,api.actor);
    if(count<8){const turn=Math.ceil(combatFixed(data.maxBeginStageTime)*60)/60+1/60,range=combatFixed(data.speed)*turn;
      api.schedule('boomerang-return',turn+Math.ceil(Math.max(0,range-combatFixed(data.catchRadius))/combatFixed(data.speed)*60)/60,{count:count+1});}
  }
  function command(api:SupportCombatApi,avatar:Avatar,tag:string|number[]){
    if(avatar.lease)api.independentLease!(avatar.lease,0);
    const generation=avatar.generation+1,lease=`nanoha:${avatar.id}:${generation}`;api.independentLease!(lease,avatar.expires);
    // useSummonHit=true redirects both native hit events and weapon stats to
    // the summoner (AdventureActor.Damage / AdventureWeapon.Setup).
    const duration=api.independentCombo!(tag,{source:SOURCE,lease});
    api.schedule('avatar-normal',duration+1/60,{id:avatar.id,generation});return {...avatar,generation,lease};
  }
  return {
    potentials:[1,2,3,4,5,6,7,8,9,10,11,12,13,41,42,43].map(n=>511900+n),
    actions:cinematics=>[{kind:'normal',skill:11910000,tag:'Atk1',normal:true,automatic:true},{kind:'skill',skill:11931000,tag:'119_Skill1_Boomerang'},
      {kind:'ultimate',skill:11940000,tag:cinematics?'119_Ultra_TL':'119_Ultra_NoTL'},
      {kind:'dodge',skill:11920000,tag:[3],flag:16,automatic:true,charges:has(13)?2:1,spBudget:null}],
    initialize:()=>({stage:0,normals:0,sequence:0,avatars:[]}),
    automatic:(_s,api)=>has(13)&&!api.buffs.count(api.actor,11951311)&&api.skillReady?.('dodge')?'dodge':'normal',comboTag:(s,_api,key)=>key==='normal'?`Atk${s.stage+1}`:null,
    cast(s,api,key){
      if(key==='dodge'&&has(13))api.buffs.add(api.actor,11951311,api.actor);
      if(key==='skill'){
        if(has(2))api.buffs.add(api.actor,11950211,api.actor);if(has(11))api.buffs.add(api.actor,11951111,api.actor);
        if(has(10))return {...s,avatars:s.avatars.map((a,i)=>i<2?command(api,a,'119FenShen_Skill_T10'):a)};
      }
      if(key==='ultimate'&&has(10))api.buffs.add(api.actor,11951011,api.actor);
      return s;
    },
    end:(s,_api,key)=>key==='normal'?{...s,stage:(s.stage+1)%3}:s,
    custom(s,api,name){
      if(name==='119_Skill1_Shoot'){shoot(api);api.schedule('boomerang-first',.5);}
      if(name==='119NrmAtk'&&has(2)&&api.buffs.count(api.actor,11950211))for(let i=0;i<3;i++)api.projectile('Bullet_11901_Atk_T2');
      if(name==='119Summon'){
        for(const a of s.avatars){api.independentLease!(a.lease,0);api.despawn!(a.id);}
        api.buffs.remove(api.actor,11950611);
        const avatars:Avatar[]=[];let sequence=s.sequence;
        for(let i=0;i<(has(42)?3:2);i++){
          const id=++sequence,life=25+(has(43)?api.parameter(11954301):0);api.summon!(id,[]);
          if(has(6))api.buffs.add(api.actor,11950611,api.actor);
          const a={id,stage:0,generation:0,lease:'',expires:api.time+life};avatars.push(command(api,a,'Birth'));api.schedule('avatar-expire',life,{id});
        }
        api.emitProc?.('own-summon-event');return {...s,avatars,sequence};
      }
      if(name==='119FenShen_ShootBoomerang')api.projectile('Bullet_11901_Skill1_T10_BulltA');
      return s;
    },
    event(s,api,name,data){
      if(name==='boomerang-first')shoot(api);if(name==='boomerang-return')shoot(api,Number(data.count));
      if(name==='avatar-normal')return {...s,avatars:s.avatars.map(a=>a.id===data.id&&a.generation===data.generation?command(api,{...a,stage:(a.stage+1)%3},[0,91,...(a.stage>0?[92]:[]),...(a.stage>1?[93]:[])]):a)};
      if(name==='avatar-expire'){
        const avatar=s.avatars.find(a=>a.id===data.id);if(!avatar)return s;api.independentLease!(avatar.lease,0);api.despawn!(avatar.id);if(has(6))api.removeStacks(api.actor,11950611,1);
        const avatars=s.avatars.filter(a=>a.id!==data.id);api.emitProc?.('own-summon-died',{remainingOwnedSummons:avatars.length});return {...s,avatars};
      }
      return s;
    },
    prepareHit(s,api,tags){if(has(1)&&tags.includes(NORMAL)){const normals=s.normals+1;if(normals>=4)api.area('AreaEffect_119_T1_AOE','boss');return {...s,normals:normals%4};}return s;},
    beforeHit(_s,api,tags){
      const once:{id:number;count:number}[]=[];
      if(tags.includes(NORMAL)&&has(6)){once.push({id:11950601,count:api.buffs.count(api.actor,11950611)});if(api.ultimateCooling?.(api.actor))once.push({id:11950602,count:1});}
      if(tags.includes(SKILL)){if(has(4))once.push({id:11950411,count:1});if(has(8)&&api.distance>2)once.push({id:11950801,count:1});if(has(9))once.push({id:11950901,count:api.buffs.count(api.actor,11950911)});}
      if(has(41)&&tags.includes(hash('119FenShen')))once.push({id:11954101,count:1});return once;
    },
    afterHit(s,api,tags){if(has(9)&&tags.includes(WIND)&&api.hasBuffTag('boss','Wind'))api.buffs.add(api.actor,11950911,api.actor);return s;},
    crit(s,api){if(has(7)&&Math.floor(api.randomPercent())<30)api.buffs.add(api.actor,11950711,api.actor);return s;},
    mark:tags=>tags.includes(WIND)?{element:4,variant:2,area:'AreaEffect_119_WindMark1_Bloom'}:null,
    markTriggered(s,api,element,_tags,source){if(element===4&&has(12))api.buffs.add(api.actor,11951211,api.actor);if(element===4&&source===api.actor)api.emitProc?.('own-wind-mark-2');return s;},
  };
}
