import {combatTagHash} from './combat-tags';
import {sampleCombatComboTranslation} from './combat-root-motion';
import type {SupportCombatAdapter} from './combat-support-adapter';
import type {SupportFactoryContext} from './combat-adapter-registry';

interface EllieState extends Record<string,unknown>{fieldGeneration:number;secondStages:number}
const LOOP=combatTagHash('139_B2_Loop'),END=combatTagHash('139_B2_End');
const SUPPORT=combatTagHash('139_Sup_P31'),ULTRA1=combatTagHash('139_Ultra_1'),ULTRA2=combatTagHash('139_Ultra_2');
const WATER=combatTagHash('139_WaterTrigger');
const ULTIMATE_DAMAGE:Record<number,number>={139400001:139400101,139400002:139400102,139543002:139543102};
const SHOTS:Record<string,string>={Event_139_Sup:'',Event_139_Sup_l30:'_l30',Event_139_Sup_l90:'_l90',Event_139_Sup_r30:'_r30'};

/** The assist ultimate automatically enters its second clip sequence,
 * consuming SP only once. */
export function createSupport139(potentials:Record<number,number>,context:SupportFactoryContext):SupportCombatAdapter<EllieState>{
  const has=(id:number)=>Boolean(potentials[id]);
  return {
    potentials:[513921,513922,513923,513924,513925,513926,513927,513928,513929,513930,513931,513932,513933,513941,513942,513943],
    actions(cinematics){
      const tag=cinematics?'139_Ultra_TL':'139_Ultra_NoTL';
      const skill=has(513922)?has(513923)?'139_Skill_Sup_P23P22':'139_Skill_Sup_P22':has(513923)?'139_Skill_Sup_P23':'139_Skill_Sup';
      return [{kind:'skill',skill:13932000,tag:skill,loopCount:1+(has(513922)?Math.trunc(context.parameter(13922011)):0)},
        {kind:'ultimate',skill:13940000,tag,chain:[{tag,until:'activation'},
          {tag:'139_Ultra2_Start',until:'activation',enterEvent:'second-ultimate-start'},
          {tag:has(513943)?'139_Ultra2_Atk_P43':'139_Ultra2_Atk'}]}];
    },
    comboArea(name,combo,elapsed,distance){
      if(name!=='AreaEffect_13901_Ultra2'&&name!=='AreaEffect_13901_Ultra2_P43')return;
      const dash=combo.events.find(frame=>frame.event.name==='Event_139_Ultra2_Move');
      const attack=combo.translation?.find(track=>dash&&track.offset>=dash.time);
      if(!dash||!attack)return;
      // The dash is interrupted by the activation-end callback. The next
      // clip advances from that point toward the stationary raid target.
      const dashFraction=Math.max(0,Math.min(1,(attack.offset-dash.time)/.1));
      const beforeAttack=sampleCombatComboTranslation(combo,attack.offset,0);
      const origin={x:(distance-6.5)*dashFraction,z:0};
      const lookAt=combo.events.find(frame=>frame.event.name==='139_Ultra2_LookAtTarget'&&frame.time<=elapsed);
      const turnTime=lookAt?.time ?? elapsed;
      const beforeTurn=sampleCombatComboTranslation(combo,turnTime,0);
      const x=origin.x+beforeTurn.x-beforeAttack.x,z=origin.z+beforeTurn.z-beforeAttack.z;
      const facing=lookAt?Math.atan2(-z,distance-x):0;
      const remaining=sampleCombatComboTranslation(combo,elapsed,facing);
      const turned=sampleCombatComboTranslation(combo,turnTime,facing);
      // The native area event is owner-relative, two units forward.
      return {x:x+remaining.x-turned.x+2*Math.cos(facing),
        z:z+remaining.z-turned.z+2*Math.sin(facing),angle:facing*180/Math.PI};
    },
    initialize(api){
      if(has(513933)&&api.actorsByElement(1).length===api.party.length)
        for(const actor of api.party)api.buffs.add(actor,13933011,api.actor);
      return {fieldGeneration:0,secondStages:0};
    },
    cast(state,api,key){
      if(key==='ultimate'&&context.breakthrough>=2)api.buffs.add(api.actor,13996221,api.actor);
      const fieldGeneration=state.fieldGeneration+1;
      if(has(513927))api.schedule('field-stack',api.parameter(13927011),{fieldGeneration});
      return {...state,fieldGeneration};
    },
    end(state,api){
      if(has(513927))api.buffs.remove(api.actor,13927011);
      return {...state,fieldGeneration:state.fieldGeneration+1};
    },
    custom(state,api,name){
      if(name==='139_Sup_Area'){
        const suffix=has(513924)?has(513930)?'_P30P24':'_P24':has(513930)?'_P30':'';
        api.area(`AreaEffect_13901_Sup${suffix}`,'boss',{x:3,z:0});
      }
      if(has(513921)&&Object.prototype.hasOwnProperty.call(SHOTS,name))
        api.directionalProjectile(`Bullet_13901_Sup_P21${SHOTS[name]}`,{x:3,z:0,dx:1,dz:0});
      if(name==='139_Ultra1_AddBuff'){
        api.buffs.add(api.actor,13994011,api.actor);
        if(has(513941))api.buffs.add(api.actor,13941011,api.actor);
      }
      if(name==='Event_139_Ultra1_Area')
        api.area('AreaEffect_13901_Ultra1','boss',{x:0,z:0,scale:has(513942)?1+api.parameter(13942001):1});
      if(name==='second-ultimate-start'){
        if(context.breakthrough>=2)api.buffs.add(api.actor,13996211,api.actor);
        if(context.breakthrough>=4)api.buffs.add(api.actor,13996411,api.actor);
        return {...state,secondStages:state.secondStages+1};
      }
      if(name==='139_Ultra2_AddBuff'&&has(513941))api.buffs.add(api.actor,13941011,api.actor);
      return state;
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      const add=(id:number)=>once.push({id,count:1});
      if(tags.includes(LOOP)){
        if(has(513922))add(13922011);
        if(has(513925)){add(13925001);if(api.bossBroken?.())add(13925002);}
        if(has(513926)&&1>api.parameter(13926011))add(13926001);
      }
      if(tags.includes(END)){
        if(has(513923))add(13923011);
        if(has(513928)){add(13928001);add(13928002);}
        if(has(513929)&&1<api.parameter(13929011))add(13929001);
        if(has(513930))add(13930001);
      }
      if(has(513931)&&tags.includes(SUPPORT)&&api.party.some(actor=>api.actorInfo(actor).job===3&&api.actorActive?.(actor)))add(13931001);
      if(has(513942)&&tags.includes(ULTRA1))add(13942001);
      if(has(513943)&&tags.includes(ULTRA2))add(13943001);
      return once;
    },
    replaceNoDamageHit:id=>ULTIMATE_DAMAGE[id],
    mark:tags=>tags.includes(WATER)?{element:1,variant:2,buffTag:'Water',hit:139000001,afterHitBuffs:[4031]}:null,
    markTriggered(state,api,element,_tags,source){
      if(element===1&&source===api.actor&&api.buffs.count('boss',4031)>=(api.buffLimit?.(4031) ?? Infinity)){
        api.buffs.remove('boss',4031);api.area('AreaEffect_13901_WaterTrigger');
      }
      return state;
    },
    event(state,api,name,data){
      if(name==='field-stack'&&Number(data.fieldGeneration)===state.fieldGeneration&&api.activeAction()){
        api.buffs.add(api.actor,13927011,api.actor);
        api.schedule(name,api.parameter(13927011),data);
      }
      return state;
    },
  };
}
