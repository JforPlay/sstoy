import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter} from './combat-support-adapter';

export interface FishState extends Record<string,unknown>{phaseHits:number;bubbles:number;generation:number}
const FISH=combatTagHash('157FishAtk'),SUP_FISH=combatTagHash('157SkillSupFishAtk');
const SWING=combatTagHash('157HuiWu'),SUP_SWING=combatTagHash('157SkillSupHuiWu');
const ULTRA=combatTagHash('157UltraAtk'),MARK=combatTagHash('157DarkTagTrigger');
// Native local offsets: (left,forward), then signed rotation from forward.
const SHOTS:Record<string,[number,number,number]>={
  '157SkillSupHuiWu1':[-5,3,90],'157SkillSupHuiWu2':[5,4,-90],
  '157SkillSupHuiWu3':[-3,-3,20],'157SkillSupHuiWu4':[3,-2.5,-20],
};

export function createSupport157(potentials:Record<number,number>):SupportCombatAdapter<FishState>{
  const has=(id:number)=>Boolean(potentials[id]);
  return {
    potentials:[515721,515722,515723,515724,515725,515726,515727,515728,515729,515730,515731,515732,515733,515741,515742,515743],
    actions:cinematics=>[
      {kind:'skill',skill:15732000,tag:has(515723)?'Skill_Sup_P23':'Skill_Sup'},
      {kind:'ultimate',skill:15740000,tag:cinematics?'Ultra_TL':'Ultra_NoTL'},
    ],
    initialize(api){
      const dark=api.actorsByElement(6);
      if(has(515731))for(const actor of dark)api.buffs.add(actor,15731011,api.actor);
      if(has(515733))for(const _ of dark)api.buffs.add(api.actor,15733011,api.actor);
      return {phaseHits:0,bubbles:0,generation:0};
    },
    cast(state,api,key){
      if(key==='skill'&&has(515732))api.buffs.add(api.actor,15732011,api.actor);
      if(key==='ultimate'&&has(515743))api.buffs.add(api.actor,15743011,api.actor);
      return {...state,phaseHits:0,generation:state.generation+1};
    },
    end(state){return {...state,phaseHits:0,generation:state.generation+1};},
    partySkillCast(state,api,source){
      if(has(515730)&&api.actorInfo(source).element===6)api.buffs.add(api.actor,15730011,api.actor);
      return state;
    },
    custom(state,api,name){
      const shot=SHOTS[name];
      if(shot){
        const [left,forward,angle]=shot,radians=angle*Math.PI/180;
        const name=has(515721)?has(515725)?'Bullet_157_Skill_Sup_P21_Fish1_P25':'Bullet_157_Skill_Sup_P21_Fish1'
          :has(515725)?'Bullet_157_Skill_Sup_Fish1_P25':'Bullet_157_Skill_Sup_Fish1';
        api.directionalProjectile(name,{x:forward,z:left,dx:Math.cos(radians),dz:Math.sin(radians)});
      }
      if(name==='157RestartP24')return {...state,phaseHits:0};
      if(name==='157P42PenSheStart'&&has(515742)){
        const generation=state.generation+1;
        api.schedule('bubbles',0,{generation});
        return {...state,generation};
      }
      if(name==='157P42PenSheEnd')return {...state,generation:state.generation+1};
      return state;
    },
    event(state,api,name,data){
      if(name!=='bubbles'||data.generation!==state.generation)return state;
      const count=Math.trunc(api.parameter(15742002));
      // An all-hits raid profile: landing geometry is not optimized here.
      for(let n=0;n<count;n++)api.projectile('Bullet_157_P42_ShuiPao');
      api.schedule(name,api.parameter(15742011),data);
      return {...state,bubbles:state.bubbles+count};
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(has(515725)&&tags.includes(FISH))once.push({id:15725001,count:1});
      // P27 is normal/elite-only and cannot apply to a raid boss.
      if(has(515728)&&tags.includes(SWING))once.push({id:15728001,count:api.buffs.count(api.actor,15728011)});
      if(has(515729)&&tags.includes(SWING))once.push({id:15729001,count:1});
      if(has(515741)&&tags.includes(ULTRA))once.push({id:15741001,count:1});
      return once.filter(effect=>effect.count>0);
    },
    afterHit(state,api,tags){
      if(has(515722)&&tags.includes(SUP_FISH)){
        if(api.buffs.count('boss',15721011)){api.buffs.remove('boss',15721011);api.hit(157300014);}
        else api.buffs.add('boss',15721011,api.actor);
      }
      if(has(515726)&&tags.includes(FISH))api.buffs.add(api.actor,15726011,api.actor);
      if(has(515728)&&tags.includes(SWING))api.buffs.add(api.actor,15728011,api.actor);
      if(has(515724)&&tags.includes(SUP_SWING)&&api.activeAction()==='skill'&&state.phaseHits<4){
        api.area('AreaEffect_157_P24_Boom');
        return {...state,phaseHits:state.phaseHits+1};
      }
      return state;
    },
    mark:tags=>tags.includes(MARK)?{element:6,variant:1,buffTag:'Dark',hit:157000001,afterHitBuffs:[15700001]}:null,
  };
}
