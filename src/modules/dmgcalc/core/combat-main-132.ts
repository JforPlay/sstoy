import {combatTagHash as hash} from './combat-tags';
import {createSupport132} from './combat-support-132';
import type {SupportCombatAdapter,SupportCombatAction,SupportCombatApi} from './combat-support-adapter';
import type {MainFactoryContext} from './combat-adapter-registry';
interface StarSwordState extends Record<string,unknown>{
  stage:number;bound:number;pending:number;expires:number;enhanced:boolean;body:number;normalHit:boolean;
  lastSkillEnd:number;lastProc:number;canAoe:boolean;
}
const NORMAL=hash('132_NormalAttack'),SKILL=hash('132_Main_Skill_Hurt'),BURST=hash('132_Main_S1_Burst');
const P2=hash('132_P2'),P3=hash('132_P3'),P4=hash('132_Main_S2_Burst'),P4AOE=hash('132_Main_S2_Burst_P04');
const ATK5=hash('132_Attack5'),MARK=hash('132_LightTag_Trigger'),S3=hash('132_Main_S3_Burst'),ULT=hash('132_Ultra');
export function createMain132(potentials:Record<number,number>,context:MainFactoryContext):SupportCombatAdapter<StarSwordState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const common=createSupport132(Object.fromEntries(Object.entries(potentials).filter(([id])=>Number(id)>=513241)));
  const isSkill=(key:string)=>key.startsWith('skill');
  function bind(state:StarSwordState,api:SupportCombatApi){
    if(!state.pending)return state;
    return {...state,bound:state.pending,pending:0,expires:state.pending===1?0:api.time+5.9,
      body:api.randomPercent()<50?1:2};
  }
  return {
    potentials:[513201,513202,513203,513204,513205,513206,513207,513208,513209,513210,513211,513212,513213,513241,513242,513243],
    actions(cinematics){
      const actions:SupportCombatAction[]=[{kind:'normal',skill:13210000,tag:'132_Attack_1',normal:true,automatic:true},
        {kind:'skill',skill:13231001,tag:has(513203)?'132_Main_Skill_S1_P03':'132_Main_Skill_S1',
          cooldown:Math.max(0,context.skillCooldown(13231001)-(has(513209)?context.parameter(13209011):0))}];
      const holds=has(513204)?[{suffix:'',seconds:31/60}]:[{suffix:'',seconds:31/60},{suffix:'-hold',seconds:103/60}];
      for(const hold of holds){
        actions.push({kind:`skill2${hold.suffix}`,skill:13231002,tag:'132_Main_Skill_S2',loopBodySeconds:hold.seconds});
        if(has(513202))for(const body of [1,2])actions.push({kind:`skill2-enhanced-${body}${hold.suffix}`,skill:13231002,
          tag:'132_Main_Skill_S2_P02',loopBodySeconds:hold.seconds,loopBodyIndex:body});
      }
      if(has(513201))actions.push({kind:'skill3',skill:13231003,tag:'132_Main_Skill_S3_P01'});
      // S3's P2 variant has the same clip and a distinct event group.
      if(has(513201)&&has(513202))actions.push({kind:'skill3-enhanced',skill:13231003,tag:'132_Main_Skill_S3_P01P02'});
      actions.push(...common.actions(cinematics).filter(action=>action.kind==='ultimate'));
      return actions;
    },
    initialize:()=>({stage:0,bound:1,pending:0,expires:0,enhanced:false,body:1,normalHit:false,lastSkillEnd:0,lastProc:0,canAoe:false}),
    tick:(state,api)=>state.bound!==1&&state.expires>0&&api.time>=state.expires?{...state,bound:1,pending:0,expires:0}:state,
    automatic:()=> 'normal',
    canCast(state,_api,key){
      if(key==='skill')return state.bound===1;
      if(key.startsWith('skill2'))return state.bound===2&&(state.enhanced?key.startsWith(`skill2-enhanced-${state.body}`):!key.includes('enhanced'));
      if(key.startsWith('skill3'))return state.bound===3&&(key.includes('enhanced')===state.enhanced);
      return true;
    },
    comboTag:(state,_api,key)=>key==='normal'?`132_Attack_${state.stage+1}`:null,
    cast(state,api,key){
      if(key==='normal')return {...state,normalHit:false};
      if(key==='ultimate')return {...state,stage:0};
      if(!isSkill(key)&&!key.startsWith('skill3'))return state;
      if(has(513212)&&(state.lastProc<=0||api.time-state.lastProc>api.parameter(13212011)))api.buffs.add(api.actor,13212011,api.actor);
      if(key==='skill'){
        if(has(513207))api.buffs.remove(api.actor,13207011);
        if(has(513209))api.buffs.add(api.actor,13209011,api.actor);
      }
      if(key.startsWith('skill2'))api.buffs.add(api.actor,13293011,api.actor);
      return {...state,stage:0,pending:key==='skill'?2:key.startsWith('skill2')&&has(513201)?3:1,
        enhanced:key==='skill'?false:state.enhanced,
        canAoe:key.startsWith('skill2')&&has(513204)&&api.time-state.lastSkillEnd<2,
        lastProc:has(513212)&&(state.lastProc<=0||api.time-state.lastProc>api.parameter(13212011))?api.time:state.lastProc};
    },
    phase(state,api,key,phase){
      if(key==='normal'&&phase==='anticipation')return {...state,stage:(state.stage+1)%5};
      if((isSkill(key)||key.startsWith('skill3'))&&phase==='activation')return bind(state,api);
      return state;
    },
    end(state,api,key){
      if(key==='ultimate'&&has(513210))api.buffs.add(api.actor,13210011,api.actor);
      if(!isSkill(key)&&!key.startsWith('skill3'))return state;
      if(has(513205))api.buffs.add(api.actor,13205011,api.actor);
      if(has(513206))api.buffs.remove(api.actor,13206011);
      if(key.startsWith('skill2'))api.buffs.remove(api.actor,13293011);
      return {...bind(state,api),lastSkillEnd:api.time,canAoe:false};
    },
    partySkillCast(state,api,source){
      if(source!==api.actor&&has(513213))api.buffs.add(api.actor,13213011,api.actor);
      return state;
    },
    attacked(state,api,tags){
      if(tags.includes(NORMAL)&&!state.normalHit){
        if(has(513206))api.buffs.add(api.actor,13206011,api.actor);
        state={...state,normalHit:true};
      }
      if(tags.includes(SKILL)&&has(513207))api.buffs.add(api.actor,13207011,api.actor);
      if(tags.includes(BURST)){
        if(api.hasBuffTag('boss','LightMark1')){
          if(has(513202))state={...state,enhanced:true};
          if(has(513203))api.buffs.add('boss',13203011,api.actor);
        }
        if(has(513208))api.area('AreaEffect_132_Main_S1_Burst_P08_Stun');
      }
      return state;
    },
    beforeHit(state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(tags.includes(ULT)){
        if(has(513241))once.push({id:13241001,count:1});
        if(has(513242))once.push({id:13242001,count:1});
      }
      if(has(513202)&&tags.includes(P2))once.push({id:13202011,count:1});
      if(has(513203)&&tags.includes(P3))once.push({id:13203011,count:1});
      if(has(513204)&&tags.includes(P4))once.push({id:13204011,count:1});
      return once;
    },
    afterHit(state,api,tags){
      if(has(513211)&&tags.includes(ATK5))api.buffs.add('boss',13211011,api.actor);
      if(state.canAoe&&tags.includes(P4AOE)&&api.activeAction()?.startsWith('skill2'))api.area('AreaEffect_132_Main_S2_P04_AOE');
      return state;
    },
    custom(state,api,name){
      if(name==='StartArea'){
        api.area(has(513242)?'AreaEffect_132_Ultra_P42':'AreaEffect_132_Ultra');
        if(has(513243))api.area('AreaEffect_132_Ultra_H6');
      }
      return state;
    },
    mark:tags=>tags.includes(MARK)||has(513201)&&tags.includes(S3)||has(513210)&&tags.includes(ULT)
      ?{element:5,buffTag:'Light',area:'AreaEffect_132_LightTag_Boom'}:null,
  };
}
