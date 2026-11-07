import {combatTagHash as hash} from './combat-tags';
import {createCombatAmmo,consumeCombatAmmo,finishCombatReload,type CombatAmmoState} from './combat-ammo';
import type {MainFactoryContext} from './combat-adapter-registry';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface ChatonState extends Record<string,unknown>{ammo:CombatAmmoState;p8:number;p9:number;rageGeneration:number;rageLeft:number}
const LONG=hash('114_Long_Bullet'),SHORT=hash('114_Short_Bullet'),DOT=hash('114_Short_DoT'),NORMAL=hash('Normal'),ULT=hash('Ultra'),EXTRA=hash('Ultra_P41'),MARK=hash('114_FireTag1_Trigger');
export function createMain114(potentials:Record<number,number>,context:MainFactoryContext):SupportCombatAdapter<ChatonState>{
  const has=(n:number)=>Boolean(potentials[511400+n]);
  const strong=(api:SupportCombatApi)=>api.buffs.count(api.actor,11440003)>0;
  function shoot(api:SupportCombatApi){
    if(api.buffs.count(api.actor,11406011)){api.projectile('Bullet_114_Main_Skill_Shoot_P05_Big');api.buffs.remove(api.actor,11406011);}
    if(has(6))api.buffs.add(api.actor,11406012,api.actor);
    for(let i=0;i<2;i++)api.projectile('Bullet_114_Main_Skill_Shoot');
  }
  return {
    potentials:[1,2,3,4,5,6,7,8,9,10,11,12,13,41,42,43].map(n=>511400+n),
    actions:cinematics=>[
      {kind:'normal',skill:11410000,tag:'Attack',normal:true,automatic:true},
      {kind:'reload',skill:11410000,tag:'Attack',reload:true,automatic:true,spBudget:null},
      {kind:'skill',skill:11431000,tag:'B1_Shoot_Short',cooldownKey:'skill',chain:[{tag:'B1_Skill_Charge'},{tag:'B1_Shoot_Short'}]},
      {kind:'skill-long',skill:11431000,tag:'B1_Shoot_Long',cooldownKey:'skill',chain:[{tag:'B1_Skill_Charge'},{tag:'B1_Skill_Charge',index:1},{tag:'B1_Shoot_Long'}]},
      {kind:'ultimate',skill:11440000,tag:cinematics?'Ultra_TL':'Ultra_NoTL'}],
    initialize:()=>({ammo:createCombatAmmo(context.ammo??30),p8:-1,p9:-1,rageGeneration:0,rageLeft:0}),
    automatic:(state,api)=>state.ammo.value>0||strong(api)?'normal':state.ammo.reloadEnabled?'reload':null,
    canCast:(state,api,key)=>key==='normal'?state.ammo.value>0||strong(api):key==='reload'?state.ammo.value===0&&!strong(api)&&api.activeAction()===null:true,
    comboTag:(_state,api,key)=>key==='normal'?strong(api)?has(42)?'Attack_Strong_P42':'Attack_Strong':has(12)?'Attack_H2':'Attack':null,
    cast(state,api,key){if(key.startsWith('skill')&&has(11))api.buffs.add(api.actor,11411011,api.actor);return state;},
    shot(state,api,count){const ammo=consumeCombatAmmo(state.ammo,Math.min(count,state.ammo.value));if(count>0&&ammo.value===0)api.interrupt();return {...state,ammo};},
    phase:(state,_api,key,phase)=>key==='reload'&&phase==='anticipation'?{...state,ammo:finishCombatReload(state.ammo)}:state,
    custom(state,api,name){
      if(name==='shoot2'){shoot(api);if(has(2))api.schedule('long-followup',.4);}
      if(name==='evt_search'&&api.distance<=30)api.buffs.add('boss',11440001,api.actor);
      if(name==='evt_shoot'&&api.distance<=30){api.area('AreaEffect_114_Ultra_Boom');if(!has(43))api.buffs.remove('boss',11440001);}
      if(name==='StartRage'){
        const count=has(42)?20:15,id=has(42)?11440004:11440002;
        for(let i=0;i<count;i++)api.buffs.add(api.actor,id,api.actor);
        api.buffs.add(api.actor,11440003,api.actor);if(has(12))api.buffs.add(api.actor,11412012,api.actor);
        const rageGeneration=state.rageGeneration+1;api.schedule('rage-tick',61/60,{rageGeneration});
        return {...state,rageGeneration,rageLeft:Math.min(count,state.rageLeft+count)};
      }
      return state;
    },
    attacked(state,api,tags){
      if(!tags.includes(SHORT))return state;
      const ids=[11401011,11404011,11404012,11404013];
      let level=0;if(has(4)){const prior=ids.findIndex(id=>api.buffs.count('boss',id)>0);level=Math.min(3,prior+1);}
      api.removeBuffTag!('boss','114_B1_Base');api.buffs.add('boss',ids[level]!,api.actor);
      for(let i=1;i<=4;i++)for(const suffix of ['', '_Quick'])api.stopWeapons(`AreaEffect_114_Main_Skill_Hit_Lv${i}${suffix}`,true);
      api.area(`AreaEffect_114_Main_Skill_Hit_Lv${level+1}${has(3)?'_Quick':''}`,'boss',{duration:15});
      return state;
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      const add=(n:number,condition:boolean,id:number,count=1)=>{if(has(n)&&condition&&count>0)once.push({id,count});};
      const long=tags.includes(LONG),short=tags.includes(SHORT)||tags.includes(DOT);
      add(1,long,11401011);add(2,long,11402011);add(3,api.hasBuffTag('boss','114_B1_Base'),11403011);
      add(4,short,11404011);add(5,long,11405001);add(7,long,11407001,api.buffs.count('boss',11407011));add(7,long,11407002);
      add(8,short,11408001);add(9,short,11409002);add(9,short&&api.buffs.count(api.actor,11409011)>0,11409001);
      add(10,tags.includes(DOT),11410001,api.buffs.count(api.actor,11410011));
      add(13,(api.bossHpPercent?.()??1)>api.parameter(11413011),11413001);
      add(42,tags.includes(ULT),11442001);add(43,api.buffs.count('boss',11440001)>0,11443001);
      return once;
    },
    afterHit(state,api,tags){
      if(has(41)&&tags.includes(ULT)&&!tags.includes(EXTRA)&&api.buffs.count('boss',11440001))api.hit(114541001);
      if(has(8)&&tags.includes(NORMAL)&&api.hasBuffTag('boss','114_B1_Base')&&(state.p8<0||api.time-state.p8>api.parameter(11408011))){api.hit(114508001);return {...state,p8:api.time};}
      return state;
    },
    crit(state,api,hit){
      if(has(7)&&hit.tags.includes(LONG))api.buffs.add('boss',11407011,api.actor);
      if(has(9)&&hit.tags.includes(SHORT)){
        api.buffs.add(api.actor,11409011,api.actor);
        if(state.p9<0||api.time-state.p9>api.parameter(11409011)){api.resetCooldown('skill');return {...state,p9:api.time};}
      }
      if(has(10)&&hit.tags.includes(DOT))api.buffs.add(api.actor,11410011,api.actor);
      return state;
    },
    projectileEnd(state,api,name,_target,position){
      if(name==='Bullet_114_Main_Skill_Shoot'){
        // GetReboundTarget excludes the previous enemy: no extra single-boss hits.
        if(has(1))api.area('AreaEffect_114_Main_Skill_Boom_P01_Big','boss',position);
        if(has(6))api.projectile('Bullet_114_Main_Skill_Shoot_P05_Re',api.actor);
      }
      if(name==='Bullet_114_Main_Skill_Shoot_P05_Re')api.buffs.add(api.actor,11406011,api.actor);
      return state;
    },
    mark:tags=>tags.includes(MARK)?{element:2,variant:1,buffTag:'FireMark1',area:'AreaEffect_114_FireTag1_Boom'}:null,
    beforeMark(state,api){if(has(12))api.buffs.add(api.actor,11412011,api.actor);return state;},
    event(state,api,name,data){
      if(name==='long-followup')for(let i=0;i<2;i++)api.projectile('Bullet_114_Main_Skill_Shoot');
      if(name==='rage-tick'&&data.rageGeneration===state.rageGeneration){
        const id=has(42)?11440004:11440002,left=state.rageLeft-1;api.removeStacks(api.actor,id,1);
        if(left>0)api.schedule(name,61/60,data);else{api.buffs.remove(api.actor,11440003);api.buffs.remove(api.actor,11412012);}
        return {...state,rageLeft:Math.max(0,left)};
      }
      return state;
    },
  };
}
