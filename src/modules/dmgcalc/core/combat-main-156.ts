import {combatTagHash as hash} from './combat-tags';
import {createCombatAmmo,consumeCombatAmmo,finishCombatReload,type CombatAmmoState} from './combat-ammo';
import {createSupport156} from './combat-support-156';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
import type {MainFactoryContext} from './combat-adapter-registry';
interface DollState extends Record<string,unknown>{ammo:CombatAmmoState;tag:string;dolls:number;lastEgg:number;inCD:boolean;reloadExtra:boolean}
const DOLL=hash('PenguinDollAtk'),NORMAL=hash('156NrmAtk'),ULT=hash('156UltraAtk'),MARK=hash('156AddLandMark1');
export function createMain156(potentials:Record<number,number>,context:MainFactoryContext):SupportCombatAdapter<DollState>{
  const has=(id:number)=>Boolean(potentials[id]);
  if(context.ammo===undefined)throw new Error('Missing native ammunition capacity 156');
  const common=createSupport156(Object.fromEntries(Object.entries(potentials).filter(([id])=>Number(id)>=515641)));
  const team=(api:SupportCombatApi,id:number)=>{for(const actor of api.party)api.buffs.add(actor,id,api.actor);};
  function dolls(state:DollState,api:SupportCombatApi,count:number){
    if(has(515606)&&Boolean(count)!==Boolean(state.dolls))for(const actor of api.party){
      if(count)api.buffs.add(actor,15606011,api.actor);else api.buffs.remove(actor,15606011);
    }
    return {...state,dolls:count};
  }
  return {
    potentials:[515601,515602,515603,515604,515605,515606,515607,515608,515609,515610,515611,515612,515613,515641,515642,515643],
    actions:cinematics=>[
      {kind:'normal',skill:15610000,tag:'Atk_Shot1',normal:true,automatic:true},
      {kind:'reload',skill:15610000,tag:'Atk_Shot1',reload:true,...(has(515604)?{reloadIndex:0}:{}),automatic:true,spBudget:null},
      ...(has(515604)?[{kind:'after-reload',skill:15631004,tag:'P4_Reload',flag:64,automatic:true}]:[]),
      {kind:'skill',skill:15631000,tag:'Skill_Mian_CallPenguinDoll',cooldownTiming:'end'},
      ...(has(515611)?[{kind:'dodge',skill:15620000,tag:[3],flag:16,charges:2,automatic:true,spBudget:null}]:[]),
      ...common.actions(cinematics).filter(action=>action.kind==='ultimate'),
    ],
    initialize(api){
      if(has(515612))for(const actor of api.actorsByElement(3))api.buffs.add(actor,15612011,api.actor);
      return {ammo:createCombatAmmo(context.ammo!),tag:'Atk_Shot1',dolls:0,lastEgg:0,inCD:false,reloadExtra:false};
    },
    automatic(state,api){
      if(api.activeAction()!==null)return state.ammo.value>0&&!state.reloadExtra?'normal':null;
      if(state.reloadExtra)return 'after-reload';
      if(has(515611)&&!api.buffs.count(api.actor,15611011)&&api.skillReady?.('dodge'))return 'dodge';
      return state.ammo.value<=0?'reload':'normal';
    },
    canCast(state,api,key){
      if(key==='normal')return state.ammo.value>0&&!state.reloadExtra;
      if(key==='reload')return state.ammo.value===0&&api.activeAction()===null;
      if(key==='after-reload')return state.reloadExtra;
      return true;
    },
    comboTag:(state,_api,key)=>key==='normal'?state.tag:null,
    cast(state,api,key){
      if(key==='normal'){
        api.randomPercent(); // Native list contains Atk_Shot1 twice, not Shot2.
        const tag=has(515603)&&api.randomPercent()<=api.parameter(state.inCD?15603012:15603011)?'Atk_Shot_P3':'Atk_Shot1';
        return {...state,tag};
      }
      if(key==='reload'){
        if(has(515607))api.buffs.add(api.actor,15607011,api.actor);
        if(has(515609))for(const actor of api.party.filter(actor=>actor!==api.main))api.buffs.add(actor,15609011,api.actor);
      }
      if(key==='skill'&&has(515613))team(api,15613011);
      if(key==='dodge'&&has(515611))team(api,15611011);
      if(key==='ultimate'&&has(515641))team(api,15641011);
      return state;
    },
    shot:(state,_api,cost)=>cost>0?{...state,ammo:consumeCombatAmmo(state.ammo,cost)}:state,
    phase(state,_api,key,phase){
      if(key==='reload'&&phase==='anticipation')return {...state,ammo:finishCombatReload(state.ammo)};
      return state;
    },
    end(state,api,key,interrupted){
      if(key==='reload'&&!interrupted)return {...state,reloadExtra:has(515604)};
      if(key==='after-reload'){team(api,15604011);return {...state,reloadExtra:false};}
      if(key==='skill')api.buffs.remove(api.actor,15690002);
      return state;
    },
    tick(state,api){
      const inCD=api.activeAction()!=='skill'&&!api.skillReady?.('skill');
      if(inCD!==state.inCD&&has(515610))for(const actor of api.party){
        if(inCD)api.buffs.add(actor,15610011,api.actor);else api.buffs.remove(actor,15610011);
      }
      return {...state,inCD};
    },
    custom(state,api,name){
      if(name==='CallPenguinDoll'){
        if(!api.independentCombo)throw new Error('Missing independent summon timeline runtime');
        const birth=api.independentCombo('Birth');
        api.schedule('doll-run',birth);
        return dolls(state,api,state.dolls+1);
      }
      if(name==='PenguinDoll_Healing'&&has(515602))api.buffs.add(api.actor,15602011,api.actor);
      if(name==='156SlowMoveStart')api.buffs.add(api.actor,15690002,api.actor);
      if(name==='156SlowMoveEnd')api.buffs.remove(api.actor,15690002);
      if(name==='156UltraBoom')team(api,15694011);
      return state;
    },
    event(state,api,name){
      if(name==='doll-run'){
        // Native timer checks before decrement: destruction is one logic
        // update after the three-second trace lease reaches zero.
        if(has(515602))api.independentCombo?.('Run_P2',{maximumSeconds:181/60});
        api.schedule('doll-death',181/60);
      }
      if(name==='doll-death'){
        const duration=api.independentCombo!('Dead');api.schedule('doll-ended',duration);
      }
      if(name==='doll-ended')return dolls(state,api,Math.max(0,state.dolls-1));
      return state;
    },
    replaceNoDamageHit:id=>({156310001:156310002,156310003:156310004} as Record<number,number>)[id],
    beforeHit:(_state,_api,tags)=>has(515605)&&tags.includes(DOLL)?[{id:15605001,count:1}]:[],
    afterHit(state,api,tags){
      if(has(515601)&&tags.includes(DOLL))api.buffs.add('boss',15601011,api.actor);
      if(has(515643)&&tags.includes(ULT)&&api.randomPercent()<=api.parameter(15643011))api.buffs.add('boss',15643011,api.actor);
      if(tags.includes(MARK))api.buffs.add('boss',6011,api.actor);
      if(has(515608)&&tags.includes(NORMAL)&&(state.lastEgg<=0||api.time-state.lastEgg>api.parameter(15608012))&&api.randomPercent()<=api.parameter(15608011)){
        api.projectile('Bullet_156_P8_Egg');return {...state,lastEgg:api.time};
      }
      return state;
    },
  };
}
