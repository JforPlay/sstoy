import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface FreesiaState extends Record<string,unknown>{rage:number;generation:number;stage:number;normalAt:number;p24:number;p28:number;p41:boolean;exit:boolean}
const SUPPORT=hash('125_Support_Damage'),ULT=hash('125_Ultra'),RAGE=hash('125_NormalAttack_Rage');
/** Three flower rays share native attack IDs: overlap is one hit per phase. */
export function freesiaFlowers(extended:boolean):{x:number;z:number;delay:number}[]{
  const points=[{x:1,z:0,delay:0}],n=extended?8:6,spacing=extended?3:4;
  for(let i=1;i<n;i++)for(const angle of [-22.5,0,22.5])points.push({x:1+i*spacing*Math.cos(angle*Math.PI/180),z:i*spacing*Math.sin(angle*Math.PI/180),delay:i*3/60});
  return points;
}
export function createSupport125(potentials:Record<number,number>):SupportCombatAdapter<FreesiaState>{
  const has=(n:number)=>Boolean(potentials[512500+n]);
  const cold=(api:SupportCombatApi)=>api.hasBuffTag('boss','Cold')||api.hasBuffTag('boss','Frozen');
  const flowerHit=(api:SupportCombatApi,id:number)=>api.hit(id,undefined,{buffIdsForTarget:[4011]});
  function flowers(api:SupportCombatApi){
    const points=freesiaFlowers(has(22)),end=((has(22)?8:6)*3+15)/60;
    const covered=(radius:number)=>points.filter(p=>Math.hypot(api.distance-p.x,p.z)<=radius).sort((a,b)=>a.delay-b.delay);
    const first=covered(has(21)?2.5:2)[0];
    if(first)api.schedule('flower-hit',first.delay,{id:125320001});
    if(covered(has(21)?4.5:3).length)api.schedule('flower-hit',end+4/60,{id:125320002});
    if(has(27))for(const point of points)api.schedule('flower-area',end+.5,point);
  }
  return {
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>512500+n),
    actions:cinematics=>[{kind:'normal',skill:12510000,tag:'Attack_Rage_1',normal:true,automatic:true},
      {kind:'rage-exit',skill:12500002,tag:'Rage_End',flag:64,automatic:true},
      {kind:'skill',skill:12532000,tag:'B2_Skill',cooldownTiming:'end'},
      {kind:'ultimate',skill:12540000,tag:cinematics?'Ultra_TL':'Ultra_NoTL'}],
    initialize(api){
      if(has(29))api.schedule('p29',61/60);
      if(has(31)&&api.party.every(id=>api.actorInfo(id).element===1))for(const id of api.party)api.buffs.add(id,12531011,api.actor);
      return {rage:0,generation:0,stage:0,normalAt:-10,p24:-1,p28:-1,p41:false,exit:false};
    },
    automatic:(s)=>s.exit?'rage-exit':s.rage>0?'normal':null,
    canCast:(s,_api,key)=>key==='normal'?s.rage>0:key==='rage-exit'?s.exit:true,
    comboTag:(s,api,key)=>key==='normal'?`Attack_Rage_${api.time-s.normalAt>1?1:s.stage+1}`:key==='skill'&&s.rage>0?'B2_Skill_Rage':null,
    cast(s,api,key){
      if(key==='ultimate')s={...s,p41:false};
      if(key==='skill'){
        if(has(23))api.buffs.add(api.actor,12523011,api.actor);
        if(s.rage>0&&has(30)){const count=Math.round(api.parameter(12530011));for(let i=0;i<count;i++)api.buffs.add(api.actor,12500002,api.actor);api.buffs.add(api.actor,12530011,api.actor);s={...s,rage:api.buffs.count(api.actor,12500002)};}
        if(s.rage>0&&has(42))api.buffs.add(api.actor,12542011,api.actor);
        if(has(33)&&api.randomPercent()<=api.parameter(12533001))for(const id of api.party)api.buffs.add(id,12533011,api.actor);
      }
      return s;
    },
    phase:(s,api,key,phase)=>key==='normal'&&phase==='anticipation'?{...s,stage:(api.time-s.normalAt>1?1:s.stage+1)%3,normalAt:api.time}:s,
    end(s,api,key){if(key==='ultimate'&&has(43))api.buffs.add(api.actor,12543011,api.actor);return key==='rage-exit'?{...s,exit:false}:s;},
    custom(s,api,name){
      if(name==='Start_Hurt')flowers(api);
      if(name==='StartRage'){
        for(let i=0;i<20;i++)api.buffs.add(api.actor,12500002,api.actor);
        api.buffs.add(api.actor,12594001,api.actor);api.emitProc?.('own-berserk-enter');
        const generation=s.generation+1;api.schedule('rage-tick',61/60,{generation});
        return {...s,rage:api.buffs.count(api.actor,12500002),generation,stage:0,exit:false};
      }
      return s;
    },
    event(s,api,name,data){
      if(name==='p29'){api.buffs.add(api.actor,12529011,api.actor);api.schedule(name,61/60);}
      if(name==='flower-hit')flowerHit(api,Number(data.id));
      if(name==='flower-area')api.area(has(21)?'AreaEffect_125_Main_P27P21_IceFlower_Large':'AreaEffect_125_Main_P27_IceFlower',api.actor,{x:Number(data.x),z:Number(data.z)});
      if(name==='p23'){flowerHit(api,125322301);api.schedule('flower-hit',34/60,{id:125322302});if(has(27))api.schedule('flower-area',1,{x:api.distance,z:0});}
      if(name==='p24')api.area('AreaEffect_125_Main_P24_IceAOE','boss');
      if(name==='rage-tick'&&data.generation===s.generation){
        api.removeStacks(api.actor,12500002,1);const rage=api.buffs.count(api.actor,12500002);
        if(rage>0)api.schedule(name,61/60,data);
        else {api.buffs.remove(api.actor,12594001);api.buffs.remove(api.actor,12541011);api.emitProc?.('own-berserk-exit');}
        return {...s,rage,exit:rage===0,stage:rage===0?0:s.stage};
      }
      return s;
    },
    attacked(s,api,tags){
      s={...s};
      if(has(23)&&tags.includes(hash('125_P23'))&&api.buffs.count(api.actor,12523011)&&api.randomPercent()<=30)api.schedule('p23',.2);
      if(has(24)&&tags.includes(hash('125_P24'))&&cold(api)&&(s.p24<0||api.time-s.p24>1)){s.p24=api.time;api.schedule('p24',1/60);}
      if(has(25)&&tags.includes(SUPPORT))api.buffs.add('boss',12525001,api.actor);
      if(has(28)&&tags.includes(RAGE)&&cold(api)&&(s.p28<0||api.time-s.p28>1)){s.p28=api.time;api.buffs.add(api.actor,12528011,api.actor);}
      if(has(32)&&tags.includes(ULT))api.buffs.add('boss',4011,api.actor);
      if(has(41)&&tags.includes(ULT)&&!s.p41){s.p41=true;api.buffs.add(api.actor,12541011,api.actor);}
      return s;
    },
    beforeHit(s,api,tags){
      const result:{id:number;count:number}[]=[];
      if(tags.includes(SUPPORT)){for(const n of [21,22])if(has(n))result.push({id:n===21?12521011:12522011,count:1});if(has(26))result.push({id:12526001,count:api.buffs.count('boss',12526011)});}
      if(has(32)&&tags.includes(ULT))result.push({id:12532001,count:1});
      if(has(41)){if(tags.includes(ULT))result.push({id:12541002,count:1});if(s.rage>0)result.push({id:12541001,count:api.buffs.count(api.actor,12541011)});}
      if(has(43)&&tags.includes(RAGE)&&cold(api)&&api.randomPercent()<=api.parameter(12543011))result.push({id:12543001,count:1});
      return result;
    },
    afterHit(s,api,tags){if(has(26)&&tags.includes(SUPPORT))api.buffs.add('boss',12526011,api.actor);if(has(43)&&tags.includes(hash('125_Ultra_Frozen')))api.buffs.add('boss',4100,api.actor);return s;},
    mark:tags=>tags.includes(hash('125_WaterTag_Trigger'))?{element:1,variant:1,area:'AreaEffect_125_WaterTag1_Boom',applyBuff:4021}:null,
    markTriggered(s,api,element){if(element===1&&(api.buffTagCount?.('boss','Cold')??0)>=3){api.removeBuffTag?.('boss','Cold');api.buffs.add('boss',4100,api.actor);}return s;},
  };
}
