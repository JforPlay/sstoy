import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';

interface WaterState extends Record<string,unknown> {
  areaUntil:number;nextWaterBuff:number;lastWave:number|null;lastFountain:number|null;lastReduction:number|null;lastWaterHit:number|null;
}
const AREA='AreaEffect_12701_B2_Skill_WaterArea',SHIELD='127_SupportSkill';
const WATER=combatTagHash('127_B2Water'),MARK=combatTagHash('WaterTag1'),ULTRA=combatTagHash('127UltraAtk');
const shieldTag=combatTagHash(SHIELD);
export function createSupport127(potentials:Record<number,number>):SupportCombatAdapter<WaterState> {
  const has=(id:number)=>Boolean(potentials[id]);
  const shieldBuffs=(api:SupportCombatApi)=>[
    ...(api.actorInfo(api.main).element===1?[...(has(512721)?[12752111]:[]),...(has(512725)?[12752511,12752512]:[])]:[]),
    ...(has(512726)?[12752611]:[]),...(has(512727)?[12752711]:[]),
  ];
  const waterRecipients=(api:SupportCombatApi)=>api.actorsByElement(1);
  return {
    potentials:[512721,512722,512723,512724,512725,512726,512727,512728,512729,512730,512731,512732,512733,512741,512742,512743],
    actions:cinematics=>[{kind:'skill',skill:12732000,tag:'127_B2_Skill',loopSeconds:has(512723)?10.4:6.4},
      {kind:'ultimate',skill:12740000,tag:cinematics?'127_Ultra_TL':'127_Ultra_NoTL'}],
    initialize(api){
      if(has(512733)) for(const actor of waterRecipients(api)) api.buffs.add(actor,12753311,api.actor);
      return {areaUntil:0,nextWaterBuff:0,lastWave:null,lastFountain:null,lastReduction:null,lastWaterHit:null};
    },
    cast(state,api,key){
      if(has(512731)) for(const actor of api.party) api.buffs.add(actor,12731011,api.actor);
      if(key==='ultimate'&&has(512742)) for(const actor of api.party) api.buffs.add(actor,12754211,api.actor);
      return state;
    },
    end(state,api){
      if(has(512731)) for(const actor of api.party) api.buffs.remove(actor,12731011);
      return state;
    },
    custom(state,api,name){
      if(name==='127BranchBullet') {
        for(const dz of [-1,1]) api.directionalProjectile('Bullet_127_Ultra_Branch',{x:7.8,z:0,dx:0,dz,
          enemyBuffs:has(512741)?[12754111]:[],friendBuffs:has(512741)?[12754112]:[]});
      }
      if(name!=='127WaterArea'||api.activeAction()!=='skill') return state;
      api.shield(12750002,api.main,has(512721)?4:0);
      api.stopWeapons(AREA);
      const nameArea=has(512724)?`${AREA}_Perk24`:AREA;
      const duration=api.area(nameArea,'boss',{x:2.2,z:0,disableBuffs:true,
        ...(has(512723)?{duration:10}:{}),...(has(512728)?{hitInterval:.5}:{})});
      if(has(512729)&&api.areaRadius(nameArea)>2.2) for(const actor of waterRecipients(api)) api.buffs.add(actor,12752911,api.actor);
      return {...state,areaUntil:api.time+duration,nextWaterBuff:api.time+1};
    },
    shieldChanged(state,api,shield,added){
      if(!shield.tags.includes(shieldTag)) return state;
      for(const id of shieldBuffs(api)) {
        if(added) api.buffs.add(api.main,id,api.actor);else api.buffs.remove(api.main,id);
      }
      return state;
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(tags.includes(WATER)&&has(512724)) once.push({id:12752411,count:1});
      if(tags.includes(ULTRA)&&has(512743)&&['WaterMark1','Cold','Frozen'].some(tag=>api.hasBuffTag('boss',tag))) once.push({id:12754301,count:1});
      return once;
    },
    afterHit(state,api,tags){
      if(tags.includes(MARK)) api.buffs.add('boss',4011,api.actor);
      if(tags.includes(WATER)&&has(512728)&&(state.lastWaterHit===null||api.time-state.lastWaterHit>.5)) {
        api.buffs.add(api.main,12752811,api.actor);
        return {...state,lastWaterHit:api.time};
      }
      return state;
    },
    mainHit(state,api){
      if(has(512722)&&api.hasShieldTag(api.main,SHIELD)&&(state.lastWave===null||api.time-state.lastWave>.5)) {
        api.area('AreaEffect_12701_B2_Skill_Wave_Perk22',api.main);
        state={...state,lastWave:api.time};
      }
      if(has(512730)&&state.areaUntil>api.time&&api.randomPercent()<50&&(state.lastFountain===null||api.time-state.lastFountain>1)) {
        api.area('AreaEffect_12701_Perk30_Fountain');
        state={...state,lastFountain:api.time};
      }
      if(has(512726)&&(state.lastReduction===null||api.time-state.lastReduction>4)) {
        api.reduceCooldown(1);
        state={...state,lastReduction:api.time};
      }
      return state;
    },
    tick(state,api){
      if(has(512729)&&state.areaUntil>api.time&&state.nextWaterBuff<=api.time) {
        for(const actor of waterRecipients(api)) api.buffs.add(actor,12752911,api.actor);
        return {...state,nextWaterBuff:api.time+1};
      }
      return state;
    },
  };
}
