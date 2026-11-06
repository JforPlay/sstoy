import {combatTagHash as hash} from './combat-tags';
import {createSupport140,type FireworksState} from './combat-support-140';
import type {SupportCombatAdapter,SupportCombatAction,SupportCombatApi} from './combat-support-adapter';
import type {MainFactoryContext} from './combat-adapter-registry';
type Form='none'|'tank'|'cannon';
interface TransformState extends FireworksState {form:Form;pending:Form;returnForm:Form;until:number;formGeneration:number;
  stage:number;shots:number;specialUsed:boolean;lastP9:number;lastP12:number}
const TANK=hash('140_Tank'),CANNON=hash('140_Cannon'),P1=hash('140_P01'),P2=hash('140_P02'),P3=hash('140_P03'),P4=hash('140_Tank');
const MARK=hash('140_LandTag_Trigger');
/** Both player-selected transformations share the native B recovery. Their
 * attacks remain normal casts even though their Skill rows have Type=3. */
export function createMain140(potentials:Record<number,number>,context:MainFactoryContext):SupportCombatAdapter<TransformState>{
  const has=(id:number)=>Boolean(potentials[id]),earth=context.partyElements?.every(element=>element===3) ?? false;
  const common=createSupport140(Object.fromEntries(Object.entries(potentials).filter(([id])=>Number(id)>=514041)),context);
  const randomPoint=(api:SupportCombatApi,x:number,z:number,radius:number)=>{
    const angle=api.randomPercent()/100*Math.PI*2,r=Math.sqrt(api.randomPercent()/100)*radius;
    return {x:x+Math.cos(angle)*r,z:z+Math.sin(angle)*r};
  };
  function leave(state:TransformState,api:SupportCombatApi):TransformState{
    if(state.form==='none')return state;
    for(const id of [14004011,14006011,14006012,14009011])api.buffs.remove(api.actor,id);
    // BindSkillIdToButton(B, default, resetSection:true) empties the section
    // and starts a fresh five-second recovery, not an instant-ready reset.
    api.restartCooldown!('skill-tank');
    return {...state,form:'none',until:0,formGeneration:state.formGeneration+1,returnForm:state.form};
  }
  return {
    potentials:[514001,514002,514003,514004,514005,514006,514007,514008,514009,514010,514011,514012,514013,514041,514042,514043],
    actions(cinematics){
      const actions:SupportCombatAction[]=[
        {kind:'normal',skill:14010000,tag:'140_Attack_1',normal:true,automatic:true},
        {kind:'tank-normal',skill:14031011,tag:'140_Attack_Tank',normal:true,automatic:true},
        {kind:'cannon-normal',skill:14031021,tag:has(514006)?'140_Attack_Fly':'140_Attack_Cannon',normal:true,automatic:true},
        {kind:'return',skill:14031003,tag:'140_Main_Skill_Tank_End',flag:64,automatic:true},
      ];
      for(const form of ['tank','cannon'] as const)actions.push({kind:`skill-${form}`,skill:14031000,tag:'140_Main_Skill_Transform',
        cooldownKey:'transform',cooldownTiming:'end',chain:[{tag:'140_Main_Skill_Transform',until:'activation'},
          {tag:form==='tank'?'140_Main_Skill_Type_Tank':has(514006)?'140_Main_Skill_Type_Fly':'140_Main_Skill_Type_Cannon'}]});
      if(has(514003))actions.push({kind:'tank-skill',skill:14031012,tag:has(514004)?'140_Tank_P03_Skill_P04':'140_Tank_P03_Skill',cooldownTiming:'end'});
      if(has(514001))actions.push({kind:'cannon-skill',skill:14031022,tag:has(514006)?'140_Fly_P01_Skill':'140_Cannon_P01_Skill',cooldownTiming:'end'});
      if(has(514012))actions.push({kind:'dodge',skill:14020000,tag:[3],flag:16,charges:2,automatic:true},
        {kind:'tank-dodge',skill:14031001,tag:[19],flag:16,charges:2,cooldownKey:'transformed-dodge',automatic:true},
        {kind:'cannon-dodge',skill:14031001,tag:[2],flag:16,charges:2,cooldownKey:'transformed-dodge',automatic:true});
      actions.push(...common.actions(cinematics).filter(action=>action.kind==='ultimate'));
      return actions;
    },
    initialize(api){return {...common.initialize(api),form:'none',pending:'none',returnForm:'tank',until:0,formGeneration:0,
      stage:0,shots:0,specialUsed:false,lastP9:0,lastP12:0};},
    automatic(state,api){
      if(state.form!=='none'){
        if(api.time>state.until)return 'return';
        if(has(514012)&&!api.buffs.count(api.actor,14012011)&&api.skillReady!(`${state.form}-dodge`))return `${state.form}-dodge`;
        return state.form==='tank'?'tank-normal':'cannon-normal';
      }
      if(state.pending!=='none')return null;
      if(has(514012)&&!api.buffs.count(api.actor,14012011)&&api.skillReady!('dodge'))return 'dodge';
      return 'normal';
    },
    canCast(state,api,key){
      if(key==='skill-tank'||key==='skill-cannon')return state.form==='none'&&state.pending==='none';
      if(key==='normal')return state.form==='none'&&state.pending==='none';
      if(key==='tank-normal'||key==='cannon-normal')return state.form===key.split('-')[0]&&api.time<=state.until;
      if(key==='tank-skill'||key==='cannon-skill')return state.form===key.split('-')[0]&&api.time<=state.until&&!(key==='tank-skill'&&state.specialUsed);
      if(key==='return')return state.form!=='none'&&api.time>state.until;
      if(key==='dodge')return state.form==='none'&&state.pending==='none';
      if(key==='tank-dodge'||key==='cannon-dodge')return state.form===key.split('-')[0]&&api.time<=state.until;
      return true;
    },
    comboTag(state,api,key){
      if(key==='normal')return `140_Attack_${state.stage+1}`;
      if(key==='tank-normal'){
        const count=has(514004)?Math.min(2,api.buffs.count(api.actor,14004011)):0;
        return ['140_Attack_Tank','140_Attack_Tank_P04_2','140_Attack_Tank_P04_3'][count]!;
      }
      if(key==='return')return `140_Main_Skill_${state.returnForm==='tank'?'Tank':has(514006)?'Fly':'Cannon'}_End${has(514011)?'_P11':''}`;
      return null;
    },
    cast(state,api,key){
      if(key==='skill-tank'||key==='skill-cannon'){
        if(has(514007))api.buffs.add(api.actor,14007011,api.actor);
        return {...state,pending:key==='skill-tank'?'tank':'cannon'};
      }
      if(key==='return'||key==='ultimate'){
        state=leave(state,api);
        if(key==='ultimate')state={...state,...common.cast!(state,api,key)};
      }
      if(key==='tank-skill'){
        if(has(514007))api.buffs.add(api.actor,14007011,api.actor);
        if(earth)api.shield(14003011,api.actor);
      }
      if(key==='cannon-skill'&&has(514007))api.buffs.add(api.actor,14007011,api.actor);
      if(key.endsWith('dodge')&&has(514012)&&(state.lastP12<=0||api.time-state.lastP12>api.parameter(14012011))){
        api.buffs.add(api.actor,14012011,api.actor);return {...state,lastP12:api.time};
      }
      return {...state,shots:0};
    },
    phase:(state,_api,key,phase)=>key==='normal'&&phase==='anticipation'?{...state,stage:(state.stage+1)%3}:state,
    end(state,api,key,interrupted){
      if(key==='skill-tank'||key==='skill-cannon'){
        const form=state.pending,formGeneration=state.formGeneration+1;
        if(interrupted)return {...state,pending:'none'};
        if(form==='tank'){
          if(has(514004)){api.buffs.add(api.actor,14004011,api.actor);api.schedule('tank-stack',121/60,{formGeneration});}
          if(has(514009))api.buffs.add(api.actor,14009011,api.actor);
          if(has(514010)){
            api.shield(14010001,api.actor);api.schedule('tank-stationary',api.parameter(14010011)+1/60,{formGeneration});
          }
        }else if(form==='cannon'&&has(514006))api.buffs.add(api.actor,14006011,api.actor);
        if(has(514011))api.buffs.add(api.actor,14011011,api.actor);
        if(has(514012))api.resetCooldown('tank-dodge');
        return {...state,form,pending:'none',until:api.time+10,formGeneration,specialUsed:false};
      }
      if(key==='tank-skill'){api.removeShield!(14003011,api.actor);return {...state,specialUsed:true};}
      if(key==='ultimate')return {...state,...common.end!(state,api,key,interrupted)};
      return state;
    },
    custom(state,api,name){
      if(name==='Tank_Attack'||name==='Tank_Skill'){
        api.projectileAt!(name==='Tank_Attack'?'Bullet_140_Tank_Attack':'Bullet_140_Tank_Skill',{x:api.distance,z:0},{x:1,z:0});
        const shots=state.shots+1;
        if(has(514004)&&shots>1)api.removeStacks(api.actor,14004011,1);
        if(has(514008))api.area(name==='Tank_Attack'?'AreaEffect_14001_Tank_P08':'AreaEffect_14001_Tank_P08P03',api.actor,{x:0,z:0});
        return {...state,shots};
      }
      if(name==='140_P11_Shoot'&&has(514011))api.schedule('return-bombs',1);
      return {...state,...common.custom!(state,api,name)};
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(has(514001)&&earth&&tags.includes(P1))once.push({id:14001011,count:1});
      if(has(514002)&&tags.includes(CANNON))once.push({id:14002011,count:1});
      if(has(514003)&&earth&&tags.includes(P3))once.push({id:14003011,count:1});
      if(has(514004)&&tags.includes(P4))once.push({id:14004011,count:1});
      if(has(514009)&&tags.includes(TANK))once.push({id:14009001,count:1});
      if(has(514013)&&api.distance>api.parameter(14013011))once.push({id:14013001,count:1});
      return once;
    },
    afterHit(state,api,tags,hit){
      state={...state,...common.afterHit!(state,api,tags,hit)};
      if(has(514002)&&tags.includes(P2)){
        if(api.buffs.count('boss',14002012))api.hit(140502001);
        else{
          api.buffs.add('boss',14002011,api.actor);
          if(api.buffs.count('boss',14002011)>=20){
            api.buffs.remove('boss',14002011);api.buffs.add('boss',14002012,api.actor);api.buffs.add('boss',14002013,api.actor);
          }
        }
      }
      return state;
    },
    partyHit:(state,api,hit)=>({...state,...common.partyHit!(state,api,hit)}),
    mark:tags=>tags.includes(MARK)?{element:3,area:'AreaEffect_14001_LandTag1_Boom'}:null,
    markTriggered(state,api,element,tags,source){
      state={...state,...common.markTriggered!(state,api,element,tags,source)};
      if(source===api.actor&&element===3&&has(514005)&&tags.includes(CANNON))api.buffs.add(api.actor,14005011,api.actor);
      return state;
    },
    projectileEnd(state,api,name,_target,position={x:api.distance,z:0}){
      if(!has(514009))return state;
      if(name==='Bullet_140_Tank_Attack'&&(state.lastP9<=0||api.time-state.lastP9>api.parameter(14009011))){
        for(let i=0;i<5;i++)api.projectileAt!('Bullet_140_Tank_P09',randomPoint(api,position.x,position.z,4),position);
        return {...state,lastP9:api.time};
      }
      if(has(514003)&&name==='Bullet_140_Tank_Skill')
        for(let i=0;i<10;i++)api.projectileAt!('Bullet_140_Tank_P09',randomPoint(api,position.x,position.z,6),position);
      return state;
    },
    event(state,api,name,data){
      if(name==='return-bombs'){
        const aimed=api.distance<=11?1:0;
        if(aimed)api.projectileAt!('Bullet_140_P11_Boom',{x:api.distance,z:0});
        for(let i=aimed;i<6;i++)api.projectileAt!('Bullet_140_P11_Boom',randomPoint(api,0,0,11));
      }
      if(data.formGeneration!==state.formGeneration||state.form!=='tank')return state;
      if(name==='tank-stack'){api.buffs.add(api.actor,14004011,api.actor);api.schedule(name,121/60,data);}
      if(name==='tank-stationary'){api.buffs.add(api.actor,14010012,api.actor);api.schedule(name,api.parameter(14010011)+1/60,data);}
      return state;
    },
  };
}
