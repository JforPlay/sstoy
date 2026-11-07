import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface AyameState extends Record<string,unknown>{stage:number;followUntil:number;p2:number;p2Hit:boolean;critGeneration:number;areas:number;fallGeneration:number;falls:number[]}
const NORMAL=hash('Normal'),SKILL=hash('Skill'),ULT=hash('Ultra'),WATER=hash('WaterTagTrigger');
export function createMain111(potentials:Record<number,number>):SupportCombatAdapter<AyameState>{
  const has=(n:number)=>Boolean(potentials[511100+n]);
  const normalKeys=(stage:number)=>{const k=has(5)?1:0;return stage===0?[k]:stage===1?[k,k]:[k,k,has(6)?4:3];};
  const skillTag=(strong:boolean)=>strong?has(4)?'B1P01P04_Skill':'B1P01_Skill':has(4)?'B1P04_Skill':'B1_Skill';
  const primary=(key:string)=>key==='skill'||key==='skill-strong';
  return {
    potentials:[1,2,3,4,5,6,7,8,9,10,11,12,13,41,42,43].map(n=>511100+n),
    actions:cinematics=>[
      ...[0,1,2].map(n=>({kind:`normal:${n}`,skill:11110001,tag:normalKeys(n),normal:true,automatic:true})),
      {kind:'melee',skill:11110002,tag:[12],flag:8,automatic:true,cooldown:3,spBudget:null},
      {kind:'skill',skill:11131001,tag:skillTag(false),cooldownKey:'skill'},
      {kind:'skill-strong',skill:11131002,tag:skillTag(true),cooldownKey:'skill'},
      {kind:'skill-follow',skill:11131003,tag:has(5)?'B1P03P05_Skill_S2':'B1P03_Skill_S2',loopSeconds:301/60},
      {kind:'ultimate',skill:11140000,tag:cinematics?'Ultra_TL':'Ultra_NoTL',loopBodySeconds:5}],
    initialize(api){if(has(7))api.schedule('p7',0);return {stage:0,followUntil:0,p2:-1,p2Hit:false,critGeneration:0,areas:0,fallGeneration:0,falls:[]};},
    automatic:(s,api)=>api.distance<.2&&api.skillReady?.('melee')?'melee':`normal:${s.stage}`,
    canCast(s,api,key){
      if(key.startsWith('normal:'))return key===`normal:${s.stage}`;
      if(key==='melee')return api.distance<.2;
      if(key==='skill-follow')return has(3)&&api.time<s.followUntil;
      if(primary(key))return api.time>=s.followUntil&&(key==='skill-strong')===(has(1)&&api.buffs.count(api.actor,11150111)>=20);
      return true;
    },
    phase(s,api,key,phase){
      if(key.startsWith('normal:')&&phase==='anticipation')return {...s,stage:(Number(key.split(':')[1])+1)%3};
      if(primary(key)&&phase==='activation'&&has(3)&&Math.floor(api.randomPercent())<api.parameter(11150311))return {...s,followUntil:api.time+6};
      return s;
    },
    cast(s,api,key){if((primary(key)||key==='skill-follow')&&has(9))api.buffs.add(api.actor,11150911,api.actor);return key==='skill-follow'?{...s,followUntil:0}:s;},
    end(s,api,key){if(primary(key)||key==='skill-follow'){
      for(const id of [11150111,11150112,11150711,11150911])api.buffs.remove(api.actor,id);
    }return s;},
    custom(s,api,name){
      if(name==='Shoot_1'||name==='Shoot_2')for(let n=1;n<=(name==='Shoot_1'?3:6);n++)api.projectile(`Bullet_11101_Attack_3_H2_${n}`);
      const area:{[key:string]:string}={add_Area:'AreaEffect_11101_Ultra_H6',add_Area_FX:'AreaEffect_11101_Ultra_H6_FX',add_Area_Hit:'AreaEffect_11101_Ultra_H6_Hit'};
      if(area[name]){api.area(area[name]!,api.actor,{x:0,z:0});if(name==='add_Area'&&has(43))for(const actor of api.party)api.buffs.add(actor,11154311,api.actor);}
      return s;
    },
    weaponBegin(s,api,name){
      if(name.startsWith('AreaEffect_11101_Ultra_H6')){api.emitProc?.('own-ultra-area-start');const next={...s,areas:s.areas+1};
        if(name==='AreaEffect_11101_Ultra_H6'&&has(41)){next.fallGeneration++;api.schedule('ultra-fall',1/60,{generation:next.fallGeneration});}return next;}
      if(has(2)&&name.startsWith('Bullet_11101_B1')&&(s.p2<0||api.time-s.p2>12))return {...s,p2:api.time,p2Hit:true};return s;
    },
    weaponEnd(s,_api,name){return name.startsWith('Bullet_11101_B1')?{...s,p2Hit:false}:s;},
    areaEnd(s,api,name){if(!name.startsWith('AreaEffect_11101_Ultra_H6'))return s;const areas=Math.max(0,s.areas-1);api.emitProc?.('own-ultra-area-end',{ultraAreaCount:areas});return {...s,areas,fallGeneration:name==='AreaEffect_11101_Ultra_H6'?s.fallGeneration+1:s.fallGeneration};},
    attacked(s,api,tags){
      if(tags.includes(hash('111_AddWaterTag'))&&!api.hasBuffTag('boss','Frozen'))api.buffs.add('boss',4011,api.actor);
      if(tags.includes(NORMAL)&&has(1)){api.buffs.add(api.actor,11150111,api.actor);if(api.buffs.count(api.actor,11150111)===20)api.buffs.add(api.actor,11150112,api.actor);}
      if(tags.includes(SKILL)&&has(2)&&s.p2Hit){if(tags.includes(hash('111_B1_Skill')))api.area('AreaEffect_11101_B1P02_Skill_IceBolt_Boom','boss');else if(tags.includes(hash('111_B1P01_Skill')))api.area('AreaEffect_11101_B1P01P02_Skill_IceBolt_Boom','boss');}
      return s;
    },
    beforeHit(_s,_api,tags){const once:{id:number;count:number}[]=[];if(has(5)&&(tags.includes(NORMAL)||tags.includes(hash('S2_P05'))))once.push({id:11150501,count:1});
      if(has(6)&&tags.includes(NORMAL)&&tags.includes(hash('111_Attack_P06')))once.push({id:11150601,count:1});if(has(12)&&tags.includes(NORMAL)&&tags.includes(hash('111_Attack_Melee')))once.push({id:11151201,count:1});return once;},
    afterHit(s,api,tags){
      if(tags.includes(hash('111_B1P01P02_Skill'))||tags.includes(hash('111_B1P02_Skill'))&&api.buffs.count('boss',4011)){api.buffs.remove('boss',4011);api.buffs.add('boss',4100,api.actor);}
      if(has(12)&&tags.includes(NORMAL)&&tags.includes(hash('111_Attack_Melee'))&&Math.floor(api.randomPercent())<api.parameter(11151211))api.buffs.add('boss',11151211,api.actor);return s;
    },
    crit(s,api,hit){if(has(8)&&hit.tags.includes(SKILL)){const critGeneration=s.critGeneration+1;api.schedule('p8',1/60,{generation:critGeneration});return {...s,critGeneration};}return s;},
    event(s,api,name,data){
      if(name==='p7'){api.buffs.add(api.actor,11150711,api.actor);api.schedule(name,api.parameter(11150711));}
      if(name==='p8'&&data.generation===s.critGeneration)api.hit(111508001);
      if(name==='ultra-fall'&&data.generation===s.fallGeneration){if(api.distance<=api.areaRadius('AreaEffect_11101_Ultra_H6'))api.area('AreaEffect_11101_Ultra_P41_IceFall','boss');api.schedule(name,1,data);}
      if(name==='melee-hurt'&&has(11))api.area('AreaEffect_11101_Perk11_IceBoom',api.actor,{x:0,z:0});return s;
    },
    mark:tags=>tags.includes(WATER)||has(13)&&tags.includes(ULT)?{element:1,variant:1,area:'AreaEffect_11101_WaterTag1_Boom',applyBuff:4021}:null,
    markTriggered(s,api,element,tags,source){
      if(element!==1)return s;api.emitProc?.('water-mark-triggered');if(source!==api.actor)return s;
      if(has(13)&&tags.includes(ULT))api.buffs.add(api.actor,11151311,api.actor);
      if((api.buffTagCount?.('boss','Cold')??0)>=3){api.removeBuffTag?.('boss','Cold');api.buffs.add('boss',4100,api.actor);if(has(10)){api.reduceCooldown(api.parameter(11151011));api.buffs.add(api.actor,11151011,api.actor);}}
      if(has(4)&&tags.includes(SKILL)){const falls=s.falls.filter(t=>t>=api.time-1);if(falls.length<3){api.area('AreaEffect_11101_B1P04_Skill_IceFalling','boss');falls.push(api.time);}return {...s,falls};}return s;
    },
  };
}
