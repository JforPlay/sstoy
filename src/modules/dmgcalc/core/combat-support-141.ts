import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
import type {SupportFactoryContext} from './combat-adapter-registry';
interface Pet {id:number;tiger:boolean;alive:boolean;until:number;tag:string;started:number;busy:number;stage:number;special:number;p29:number;lease:number}
interface ChixiaState extends Record<string,unknown>{generation:number;index:number;next:number;p32:boolean;pets:Pet[]}
const SOURCE='char_14101_combos_monster.unity3d',ULT=hash('141_Ultra_Hurt');
export function createSupport141(potentials:Record<number,number>,context:SupportFactoryContext):SupportCombatAdapter<ChixiaState>{
  const has=(n:number)=>Boolean(potentials[514100+n]);
  const owner=(api:SupportCombatApi,id:number)=>`${api.actor}#${id}`;
  const friends=(s:ChixiaState,api:SupportCombatApi)=>[...api.party,...s.pets.filter(p=>p.alive).map(p=>owner(api,p.id))];
  function ink(api:SupportCombatApi,tags:number[]){
    if(api.hasBuffTag('boss','141_Burn'))return;
    if(tags.includes(hash('141_Ink_Add')))api.buffs.add('boss',14191015,api.actor);
    const count=api.buffs.count('boss',14191015);
    if(count>0&&count<=4&&tags.includes(hash('141_Ignite'))){
      const buff=14191010+count;api.buffs.add('boss',buff,api.actor);api.buffs.remove('boss',14191015);
      // BuffEffect 14191011..14: OnceDoT, total coefficient / eight ticks.
      api.onceDot!(buff,141100004+count,1);
    }
  }
  function countChanged(s:ChixiaState,api:SupportCombatApi){
    if(!has(25))return;const count=s.pets.filter(p=>p.alive).length;
    for(const actor of friends(s,api)){const old=api.buffs.count(actor,14125011);if(old>count)api.removeStacks(actor,14125011,1);else for(let i=old;i<count;i++)api.buffs.add(actor,14125011,api.actor);}
  }
  function play(p:Pet,api:SupportCombatApi,tag:string){
    api.independentLease!(`pet:${p.id}:${p.lease}`,api.time-1/60);
    const lease=p.lease+1,busy=api.independentCombo!(tag,{source:SOURCE,entity:p.id,lease:`pet:${p.id}:${lease}`});
    api.independentLease!(`pet:${p.id}:${lease}`,api.time+busy);return {...p,tag,started:api.time,busy:api.time+busy,lease};
  }
  function death(s:ChixiaState,api:SupportCombatApi,id:number){
    const p=s.pets.find(p=>p.id===id);if(!p?.alive)return s;
    const dead=play(p,api,p.tiger?'14101_Summon_Tiger_Death':'14101_Summon_Snake_Death_Rush');
    if(has(27))for(const actor of friends(s,api))api.removeStacks(actor,14127012,1);
    api.schedule('pet-ended',dead.busy-api.time,{id});
    s={...s,pets:s.pets.map(p=>p.id===id?{...dead,alive:false}:p)};countChanged(s,api);return s;
  }
  function throwPet(api:SupportCombatApi,tiger:boolean,generation:number){
    const angle=api.randomPercent()/100*2*Math.PI,r=Math.sqrt(api.randomPercent()/100)*4;
    const x=tiger?api.distance/2+1:api.distance/2+Math.cos(angle)*r,z=tiger?0:Math.sin(angle)*r;
    const name=`Bullet_14101_Support_Skill_Throw${tiger?'_P23_Tiger':''}`;
    const data=api.weaponData!(name,'AdventureProjectile'),speed=data.moveSpeed._serializedValue/4294967296;
    // The throw's native minimum flight time is 0.3 seconds; origin is two
    // units in front of Chixia, not the boss position.
    api.schedule('pet-spawn',Math.max(.3,Math.hypot(x-2,z)/speed),{tiger:tiger?1:0,generation});
  }
  return {
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>514100+n),
    actions:c=>[{kind:'skill',skill:14132000,tag:'141_Support_Skill',loopSeconds:6},{kind:'ultimate',skill:14140000,tag:c?'141_Ultra_TL':'141_Ultra_NoTL'}],
    initialize(api){if(has(33))for(const actor of api.actorsByElement(2))api.buffs.add(actor,14133011,api.actor);return {generation:0,index:0,next:0,p32:false,pets:[]};},
    cast(s,api,key){
      if(key==='skill'){for(const p of s.pets)if(p.alive)s=death(s,api,p.id);return {...s,index:0,generation:s.generation+1};}
      if(key==='ultimate'){api.emitProc?.('own-ultimate-start');if(context.breakthrough>=3)for(const p of s.pets)if(p.alive)api.buffs.add(owner(api,p.id),14196311,api.actor);}return s;
    },
    partySkillCast(s,api,source){if(!has(26)||source!==api.main)return s;
      return {...s,pets:s.pets.map(p=>{
        if(!p.alive||api.time<p.special||!api.independentAllowed!(p.tag,api.time-p.started,p.tiger?14132024:14132013,SOURCE))return p;
        return {...play(p,api,`14101_Summon_${p.tiger?'Tiger':'Snake'}_P26_HurtSkill`),special:api.time+1};
      })};
    },
    custom(s,api,name){
      if(name==='141_Summon'){
        if(has(23)){if(s.index===0)throwPet(api,true,s.generation);else for(const p of s.pets)if(p.alive&&p.tiger)api.schedule('tiger-strength',.5,{id:p.id});}
        else throwPet(api,false,s.generation);
        if(has(21))throwPet(api,false,s.generation);return {...s,index:s.index+1};
      }
      if(name==='14101_Ultra_Target')api.schedule('ultra-area',1);return s;
    },
    event(s,api,name,data){
      if(name==='ultra-area'){api.area('AreaEffect_14101_Ultra_T2','boss');if(has(42))api.area('AreaEffect_14101_Ultra_P42_FireWind','boss');return {...s,p32:false};}
      if(name==='tiger-strength'&&s.pets.some(p=>p.id===Number(data.id)&&p.alive))api.buffs.add(owner(api,Number(data.id)),14123011,api.actor);
      if(name==='pet-ended')api.despawn!(Number(data.id));
      if(name==='pet-death')return death(s,api,Number(data.id));
      if(name==='pet-spawn'&&data.generation===s.generation){
        s={...s,next:s.next+1,pets:[...s.pets]};const id=s.next,tiger=Boolean(data.tiger),first=!s.pets.some(p=>p.alive);
        const name=`Bullet_14101_Support_Skill_Throw${tiger?'_P23_Tiger':''}`,config=api.weaponData!(name,'WeaponFeatureSummonWhenFinish');
        const same=s.pets.filter(p=>p.alive&&p.tiger===tiger);if(same.length>=Number(config.maxCount))s=death(s,api,same[0]!.id);
        const duration=config.leftTime._serializedValue/4294967296;
        api.summon!(id,[...(has(21)?[14121011]:[]),...(has(31)?[14131011]:[])]);
        const p=play({id,tiger,alive:true,until:api.time+duration,tag:'',started:api.time,busy:api.time,stage:0,special:0,p29:0,lease:0},api,`14101_Summon_${tiger?'Tiger':'Snake'}_Born`);
        s.pets.push(p);countChanged(s,api);
        if(has(22)&&s.pets.filter(p=>p.alive).length>=2)for(const p of s.pets)if(p.alive&&!api.buffs.count(owner(api,p.id),14122011))api.buffs.add(owner(api,p.id),14122011,api.actor);
        if(first&&has(24))api.area(`AreaEffect_14101_Summon_${tiger?'Tiger':'Snake'}_P24_FireCoat`,'boss',{entity:id,duration});
        if(has(27))for(const target of friends(s,api))api.buffs.add(target,14127012,api.actor);
        api.schedule('pet-death',duration,{id});api.schedule('pet-think',p.busy-api.time,{id});if(has(28))api.schedule('pet-grow',61/60,{id});return s;
      }
      const p=s.pets.find(p=>p.id===Number(data.id));if(!p?.alive)return s;
      if(name==='pet-grow'){api.buffs.add(owner(api,p.id),14128011,api.actor);api.schedule(name,61/60,data);}
      if(name==='pet-think'){
        const wait=p.tiger?1/60:.2;
        if(api.time>=p.busy){const tag=p.tiger?`14101_Summon_Tiger_Attack${p.stage+1}`:'14101_Summon_Snake_Attack',next=play(p,api,tag);
          s={...s,pets:s.pets.map(x=>x.id===p.id?{...next,stage:(p.stage+1)%3}:x)};
        }api.schedule(name,wait,data);
      }return s;
    },
    beforeMinionHit:(_s,api,_id)=>has(30)&&api.distance<=4?[{id:14130001,count:1}]:[],
    afterMinionHit(s,api,id,hit){ink(api,hit.tags);const p=s.pets.find(p=>p.id===id);if(has(29)&&p&&(p.p29<=0||api.time-p.p29>3)&&api.distance<=4){for(const actor of friends(s,api))api.buffs.add(actor,14129011,api.actor);return {...s,pets:s.pets.map(p=>p.id===id?{...p,p29:api.time}:p)};}return s;},
    afterHit(s,api,tags){ink(api,tags);if(has(32)&&tags.includes(ULT)){api.buffs.add('boss',1011,api.actor);if(!s.p32){for(const actor of friends(s,api))api.buffs.add(actor,14132011,api.actor);return {...s,p32:true};}}return s;},
    crit(s,api,hit){if(has(41)&&hit.tags.includes(ULT))api.buffs.add(api.actor,14141011,api.actor);return s;},
    areaEnd(s,api,name){if(has(43)&&api.weaponData!(name,'AreaEffectEntity').areaTag==='141_Ultra_Area')api.area('AreaEffect_14101_Ultra_P43_DragonBreathe',api.main,{x:0,z:0});return s;},
    mark:tags=>tags.includes(hash('141_FireMark_Trigger'))?{element:2,variant:2,hit:141000001,radius:3}:null,
    markTriggered(s,api,element){if(element===2)api.emitProc?.('fire-mark-triggered');return s;},
  };
}
