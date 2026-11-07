import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface FloraState extends Record<string,unknown>{p22:number;p24:number;p27:number;p32:number;p24Hit:boolean;ashGeneration:number;volleyGeneration:number;eggGeneration:number}
const FIRE=hash('126_FireButterfly'),B2=hash('126_B2'),RING=hash('126_Ultra_FireRing');
export function createSupport126(potentials:Record<number,number>):SupportCombatAdapter<FloraState>{
  const has=(n:number)=>Boolean(potentials[512600+n]);
  const fireMain=(api:SupportCombatApi)=>api.actorInfo(api.main).element===2;
  const random=(api:SupportCombatApi,n:number)=>Math.min(n-1,Math.floor(api.randomPercent()/100*n));
  const ready=(at:number,api:SupportCombatApi,cd:number)=>at===0||api.time-at>=cd;
  const shoot=(api:SupportCombatApi,name:string)=>api.projectile(name);
  return {
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>512600+n),
    actions:cinematics=>[{kind:'skill',skill:12632000,tag:'B2_Skill'},{kind:'ultimate',skill:12640000,tag:cinematics?'Ultra_TL':'Ultra_NoTL'}],
    initialize(api){if(has(26))api.schedule('butterfly-check',0);return {p22:0,p24:0,p27:0,p32:0,p24Hit:false,ashGeneration:0,volleyGeneration:0,eggGeneration:0};},
    custom(state,api,name){
      if(name==='126SupportAttack'){
        if(api.distance<=12)for(let i=1;i<=(has(21)?5:3);i++)shoot(api,`Bullet_12601_Skill2_ButterflyFire_${i}`);
        for(let i=0;i<(has(23)?5:3);i++){
          api.buffs.add(api.main,12632003,api.actor);
          if(has(29)&&fireMain(api))api.buffs.add(api.main,12652911,api.actor);
        }
        if(has(23)&&fireMain(api))api.buffs.add(api.main,12652311,api.actor);
        if(has(27))api.buffs.add(api.main,12652711,api.actor);
        if(has(31))for(const actor of api.actorsByElement(2))api.buffs.add(actor,12653111,api.actor);
        api.buffs.add(api.main,12693015,api.actor);
        const ashGeneration=state.ashGeneration+1;
        api.schedule('ash-expire',(api.buffDuration?.(12632003)??10)+1/60,{ashGeneration});
        return {...state,ashGeneration};
      }
      if(name==='12601_ShootStart'){
        const bullet=`Bullet_12601_Ultra_Phoenix${has(43)?'_Perk43':''}`;
        api.projectileAt!(bullet,{x:api.distance-2,z:0},{x:api.distance-2,z:0});
        const bomb=api.weaponData!(bullet,'AdventureBomb'),raw=bomb.delayExplosionTime?._serializedValue??0;
        const eggGeneration=state.eggGeneration+1;
        api.schedule('phoenix-egg',Math.max(0,raw/4294967296)+.55,{eggGeneration});
        return {...state,eggGeneration};
      }
      return state;
    },
    preparePartyHit(state,api,hit){
      state={...state,p24Hit:false};
      if(hit.actor!==api.main||!fireMain(api))return state;
      if(hit.element===2&&has(22)&&api.randomPercent()<api.buffs.count('boss',12632001)*35&&ready(state.p22,api,1)){
        state.p22=api.time;
        // With only the boss present SearchConfrontMonster excludes that boss
        // and emits the native self-target variant from the main actor.
        api.projectileAs!(api.main,'Bullet_12601_Skill2_ButterflyFire_Perk22_Self',.3);
      }
      if(hit.element===2&&has(24)&&api.randomPercent()<api.buffs.count(api.main,12632003)*20&&ready(state.p24,api,1)){
        state.p24=api.time;state.p24Hit=true;
        shoot(api,`Bullet_12601_Skill2_ButterflyFire_Perk24_${random(api,2)+1}`);
      }
      return state;
    },
    beforePartyHit(state,api,hit){
      const once:{id:number;count:number}[]=[];
      if(hit.actor!==api.main||!fireMain(api))return once;
      if(state.p24Hit)once.push({id:12652401,count:1});
      if(has(25)&&api.hasBuffTag('boss','126_FireButterfly'))once.push({id:12652501,count:1});
      return once;
    },
    beforePartySettlement(state,api,hit){if(has(41)&&hit.tags.includes(RING))api.buffs.add('boss',12654111,api.actor);return state;},
    partyHit(state,api,hit){
      if(has(21)&&hit.tags.includes(FIRE))api.buffs.add('boss',12652111,api.actor);
      if(has(33)&&hit.tags.includes(B2))api.buffs.add('boss',12653311,api.actor);
      return state;
    },
    partyCrit(state,api,hit){
      state={...state};
      if(hit.actor===api.main&&api.buffs.count(api.main,12640001))api.buffs.remove(api.main,12640001);
      if(has(27)&&(hit.actor===api.main||hit.actor===api.actor)&&ready(state.p27,api,1)){
        state.p27=api.time;shoot(api,`Bullet_12601_Skill2_ButterflyFire_Perk27_${random(api,2)+1}`);
      }
      if(has(28)&&hit.actor===api.main)api.buffs.add(api.main,12652811,api.actor);
      if(has(32)&&ready(state.p32,api,6)){state.p32=api.time;api.buffs.add(api.main,12653211,api.actor);}
      return state;
    },
    event(state,api,name,data){
      if(name==='butterfly-check'){
        if(api.hasBuffTag('boss','126_FireButterfly'))api.buffs.add(api.main,12652611,api.actor);
        api.schedule(name,1);
      }
      if(name==='phoenix-egg'&&data.eggGeneration===state.eggGeneration){
        api.area(`AreaEffect_12601_Ultra_PhoenixEgg${has(42)&&has(43)?'_Perk42Perk43':has(42)?'_Perk42':has(43)?'_Perk43':''}`,'boss',{x:api.distance-2,z:0});
      }
      if(name==='ash-expire'&&data.ashGeneration===state.ashGeneration&&has(30)&&!api.buffs.count(api.main,12632003)&&api.distance<=12){
        const volleyGeneration=state.volleyGeneration+1;
        for(let i=0;i<(has(23)?5:3);i++)api.schedule('ash-volley',i*.08,{volleyGeneration,index:i});
        return {...state,volleyGeneration};
      }
      if(name==='ash-volley'&&data.volleyGeneration===state.volleyGeneration){
        const order=[2,3,1,4,5];shoot(api,`Bullet_12601_Skill2_ButterflyFire_Perk30_${order[Number(data.index)]}`);
      }
      return state;
    },
  };
}
