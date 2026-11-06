import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatApi,SupportCombatAction} from './combat-support-adapter';
const ULT=hash('137UltraAtk'),MARK=hash('137WindTagTrigger');
/** Common 137 role-independent ultimate and elemental hooks. */
export function createCommon137(potentials:Record<number,number>){
  const has=(id:number)=>Boolean(potentials[id]);
  return {
    ultimate:(cinematics:boolean):SupportCombatAction=>({kind:'ultimate',skill:13740000,tag:cinematics?'Ultra_TL':'Ultra_NoTL'}),
    cast(api:SupportCombatApi,key:string){if(key==='ultimate'&&has(513741))api.buffs.add(api.actor,13741011,api.actor);},
    skill(api:SupportCombatApi,source:string){if(has(513743)&&api.actorInfo(source).element===4)api.buffs.add(api.actor,13743011,api.actor);},
    custom(api:SupportCombatApi,name:string){
      if(name!=='Ultra_Atk_Left'&&name!=='Ultra_Atk_Right')return;
      const index=Math.min(3,Math.floor(api.randomPercent()*4/100))+(name==='Ultra_Atk_Left'?1:5);
      api.randomPercent();api.randomPercent();
      api.projectile(`Bullet_137_UltraAtk_Bullet_${index}`);
    },
    beforeHit(api:SupportCombatApi,tags:number[]){
      const count=api.buffs.count('boss',13742011);
      return has(513742)&&tags.includes(ULT)&&count?[{id:13742001,count}]:[];
    },
    afterHit(api:SupportCombatApi,tags:number[]){if(has(513742)&&tags.includes(ULT))api.buffs.add('boss',13742011,api.actor);},
    mark:(tags:number[])=>tags.includes(MARK)?{element:4,variant:2 as const,area:'AreaEffect_137_WindMark1_Bloom',radius:1.5}:null,
  };
}
