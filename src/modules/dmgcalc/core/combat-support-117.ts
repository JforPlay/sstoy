import {combatTagHash as hash} from './combat-tags';
import {combatFixed} from './combat-weapons';
import type {SupportCombatAdapter} from './combat-support-adapter';
interface Circle {id:number;name:string;started:number;expires:number}
interface JinglinState extends Record<string,unknown>{circles:Circle[];age:number;generation:number;ultraUntil:number}
const SKILL=hash('117_B2_Skill_Hit'),ULT=hash('117_Ultra_Hit'),BULLET='Bullet_117_Ultra';
export function createSupport117(potentials:Record<number,number>):SupportCombatAdapter<JinglinState>{
  const has=(n:number)=>Boolean(potentials[511700+n]);
  if([21,22,23].every(has))throw new Error('징린의 지원 전용 잠재력 세 개를 동시에 선택할 수 없습니다.');
  const variants:Record<number,string>={0:'AreaEffect_117_B2_Skill_ElectricCircle',21:'AreaEffect_117_B2P21_Skill_ElectricCircle_Large',22:'AreaEffect_117_B2P22_Skill_ElectricCircle_Quick',23:'AreaEffect_117_B2P23_Skill_ElectricCircle_Stun',43:'AreaEffect_117_B2P21P22_Skill_ElectricCircle_LargeQuick',44:'AreaEffect_117_B2P21P23_Skill_ElectricCircle_LargeStun',45:'AreaEffect_117_B2P22P23_Skill_ElectricCircle_QuickStun'};
  return {
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>511700+n),
    actions:cinematics=>[{kind:'skill',skill:11732000,tag:'Skill_B2'},{kind:'ultimate',skill:11740000,tag:[cinematics?20:21]}],
    initialize(api){if(has(33))for(const actor of api.lightActors)api.buffs.add(actor,11733011,api.actor);return {circles:[],age:0,generation:0,ultraUntil:0};},
    cast(s,api,key){if(key==='skill'&&has(28))api.reduceCooldown(api.parameter(11728011));return s;},
    custom(s,api,name){
      if(name==='117_B2_Area'){
        for(const area of [variants[[21,22,23].filter(has).reduce((sum,n)=>sum+n,0)]!,...(has(24)?[has(21)?'AreaEffect_117_B2P21P24_Skill_ElectricCircle_LargeBoom':'AreaEffect_117_B2P24_Skill_ElectricCircle_Boom']:[])]){
          const duration=combatFixed(api.weaponData!(area,'AreaEffectEntity').duration)+(has(26)?api.parameter(11726011):0);api.area(area,'boss',{duration});
        }
      }
      if(name==='_Ultra'){
        api.projectile(BULLET,undefined,Math.max(0,api.distance-1.5));
        if(has(41))api.buffs.add(api.actor,11741011,api.actor);api.emitProc?.('own-ultra-projectile-spawned');
        const generation=s.generation+1;api.schedule('ultra-tick',1/60,{generation});return {...s,generation,ultraUntil:api.time+10};
      }return s;
    },
    weaponBegin(s,api,name,id){
      if(!name.startsWith('AreaEffect_117_B2'))return s;
      const duration=combatFixed(api.weaponData!(name,'AreaEffectEntity').duration)+(has(26)?api.parameter(11726011):0);
      let circles=[...s.circles.filter(c=>c.expires>api.time),{id:id!,name,started:api.time,expires:api.time+duration}];
      // Native P28 caps the shared 117_B2_Area tag, not each prefab separately.
      if(has(28)&&circles.length>3){const old=circles.shift()!;api.stopWeapon?.(old.id);}
      if(has(30)&&api.distance<=api.areaRadius(name))api.buffs.add(api.main,11730011,api.actor);
      return {...s,circles};
    },
    weaponEnd(s,api,name,id){
      if(name===BULLET){api.buffs.remove(api.actor,11741011);api.emitProc?.('own-ultra-projectile-finished');}
      const circles=s.circles.filter(c=>c.id!==id);
      if(name.startsWith('AreaEffect_117_B2')&&has(30)&&!circles.some(c=>c.expires>api.time&&api.distance<=api.areaRadius(c.name)))api.buffs.remove(api.main,11730011);
      return {...s,circles};
    },
    attacked(s,api,tags,hit){
      if(has(31)&&tags.includes(ULT))api.buffs.add('boss',3011,api.actor);
      if(has(43)&&tags.includes(ULT)&&api.hasBuffTag('boss','LightMark1'))api.buffs.add(api.actor,11743011,api.actor);
      const circle=s.circles.find(c=>c.id===hit?.weaponId);return {...s,age:circle?Math.max(0,Math.floor(api.time-circle.started)):0};
    },
    beforeHit(s,_api,tags){const result:{id:number;count:number}[]=[];
      if(tags.includes(SKILL))for(const n of [21,22,25,26,28])if(has(n))result.push({id:n===21?11721011:n===22?11722011:n===25?11725001:n===26?11726001:11728001,count:1});
      if(has(27)&&s.age>0)result.push({id:11727001,count:s.age});
      if(tags.includes(ULT)){if(has(31))result.push({id:11731001,count:1});if(has(42))result.push({id:11742001,count:1});}return result;},
    afterHit(s,api,tags){if(has(29)&&tags.includes(SKILL)&&Math.floor(api.randomPercent())<api.parameter(11729011))api.buffs.add(api.main,11729011,api.actor);return s;},
    event(s,api,name,data){if(name==='ultra-tick'&&data.generation===s.generation&&api.time<s.ultraUntil){if(api.distance<=20)api.hit(117400001);api.schedule(name,has(42)?.25:.5,data);}return s;},
    mark:tags=>tags.includes(hash('lightBoomHit'))?{element:5,variant:1,area:'AreaEffect_117_B1_LightTag_Boom'}:null,
    markTriggered(s,api,element){if(element===5)api.emitProc?.('light-mark-triggered');return s;},
  };
}
