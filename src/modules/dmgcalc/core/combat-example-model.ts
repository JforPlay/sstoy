import { prepareCombatBuild, type CombatBuildExample, type CombatBuildTables } from './combat-build';
import { createCombatRuntime, type CombatAction, type CombatRuntimeState, type CombatRuntimeApi, type RuntimeEvent, type CombatScenario } from './combat-runtime';
import { compileCombo, chainCombatCombos, type CombatTimeline, type CombatTimelineEvent, type CompiledCombo } from './combat-timeline';
import { createSeinaRules, type SeinaScriptApi } from './combat-seina';
import { createHotaruRules, type HotaruScriptApi } from './combat-hotaru';
import { createTiliaRules, type TiliaScriptApi } from './combat-tilia';
import { createKasimiraSharedRules, createKasimiraSupportRules, planKasimiraSupportVolley, type KasimiraSupportApi } from './combat-kasimira';
import { combatTagHash } from './combat-tags';
import { nextCombatRandom } from './combat-random';
import {dispatchCombatProcs} from './combat-proc-dispatch';
import {reviewedBreakthroughRules} from './combat-breakthrough-rules';
import type {CombatProcOnce,CombatProcContext} from './combat-procs';
import {combatMainFactories,combatSupportFactories,legacyCombatSupports} from './combat-adapter-registry';
import {planCombatDrop} from './combat-drops';
import {createMain103} from './combat-main-103';
import {planStraightCombatProjectile} from './combat-projectile-path';
import {planCombatProjectileGeneration} from './combat-projectile-generation';
import {createCombatAreaGeometry,createCombatLandingGeometry} from './combat-area-geometry';
import {planCombatAreaGeneration} from './combat-area-generation';
import type {SupportCombatAdapter,SupportCombatApi,SupportAreaOptions} from './combat-support-adapter';
import {addCombatShield,expireCombatShields,combatShieldTotal,extendCombatShield,hasCombatShieldTag,type CombatShieldValue} from './combat-shields';
import { createGraySupportRules, type GrayApi } from './combat-gray';
import type { CombatConditionContext, ConditionActor } from './combat-conditions';
import { createRecordRules, type RecordRuleBuffs } from './combat-record-rules';
import { raidBossProfile, createRaidBossState, tickRaidBoss, damageRaidBoss,damageRaidToughness, initializeRaidAbility, raidAbilityCast, raidAbilityHit, raidAbilityMark } from './combat-boss';
import { addCombatBuff, removeCombatBuff, combatBuffCount, expireCombatBuffs, type CombatBuffDefinition } from './combat-buffs';
import { getCombatValue, type ValueMetadata, type CombatLevelContext } from './rotation-values';
import { collectCombatBuffAttributes, applyCombatAttributeEffect, addOnceCombatAttributes, staticPotentialEffects, type CombatConditionFacts, type CombatEffectValue, type CombatEffectMetadata, type ResolvedCombatAttributes } from './combat-effects';
import { combatCalculationRules, calculateResolvedCombatHit } from './combat-calculator';
import { readCombatAttribute } from './combat-attributes';
import {resolveCombatCooldown} from './combat-cooldowns';
import {resolveCombatCombo} from './combat-combos';
import { resolveCombatHit, type CombatHitDefinition } from './combat-hit';
import { planCombatWeapon, planCombatAreaBuffs, combatFixed, type ExtractedCombatWeapon } from './combat-weapons';

interface CharacterTimings {
  id: number; timelines: CombatTimeline[]; weapons: ExtractedCombatWeapon[];
  entities?:{name:string;type:string;pathId:string;data:Record<string,any>}[];
  reloadClips?:{group:string;default:string;alternates:string[]}[];
  comboAliases: { tag: string; source?:string;group?:string;keys: number[]; skillType: number; clips: string[];clipMode?:number;eventGroups?:string[] }[];
}
export interface ExampleCombatTables extends CombatBuildTables {
  actorScales?:Record<number,number>;
  skills: Record<number, any>; hits: Record<number, CombatHitDefinition>;
  buffDefinitions: Record<number, ValueMetadata>; buffValues: Record<number, CombatBuffDefinition>;
  effects: Record<number, CombatEffectMetadata>; effectValues: Record<number, CombatEffectValue>;
  onceDefinitions: Record<number, ValueMetadata>; onceValues: Record<number, Record<string, number>>;
  shieldDefinitions:Record<number,ValueMetadata>;shieldValues:Record<number,CombatShieldValue>;
  monsterAi?:Record<number,any>;monsterBranches?:Record<number,any>;
  parameters: Record<number, ValueMetadata>; parameterValues: Record<number, { CommonData: number }>;
  config: Record<string, { Value: string }>; attributeLimits: Record<number, any>; attributeSetLimits: Record<number, any>;
  timings: { rules: Record<string, number>; characters: CharacterTimings[] };
  bossTables: Record<string, any>;
}
export interface ExampleCombatOptions { boss: number; distance: number; cinematics: boolean; actorLevels?: number[]; skillLevels?: number[]; randomSeed?: number; searchDepth?:'standard'|'deep' }
export function createExampleCombatModel(example: CombatBuildExample, tables: ExampleCombatTables, options: ExampleCombatOptions) {
  const build = prepareCombatBuild(example, tables, options.actorLevels, options.skillLevels);
  const seinaMain=build.actors[0]?.id===162;
  const supportAdapters:Record<string,SupportCombatAdapter<Record<string,unknown>>>={};
  if(build.actors[0]?.id===103) {
    const ammo=tables.characters[103]!.Ammo;
    if(ammo===undefined) throw new Error('Missing native ammunition capacity 103');
    supportAdapters['103']=createMain103(build.actors[0].context.potentials,ammo);
  }
  const mainFactory=combatMainFactories[build.actors[0]!.id];
  if(mainFactory){
    const actor=build.actors[0]!;
    supportAdapters[String(actor.id)]=mainFactory(actor.context.potentials,{
      parameter:id=>parameter(String(actor.id),id),breakthrough:actor.context.limitBreak,glimmerId:tables.timings.rules.BuffId_Glimmer!,
      ammo:tables.characters[actor.id]!.Ammo,skillCooldown:id=>(tables.skills[id]!.SkillCD ?? 0)/10000,
      partyElements:build.actors.map(member=>tables.characters[member.id]!.EET!)});
  }
  for(const actor of build.actors.slice(1)) {
    const factory=combatSupportFactories[actor.id];
    if(factory)supportAdapters[String(actor.id)]=factory(actor.context.potentials,{
      parameter:id=>parameter(String(actor.id),id),breakthrough:actor.context.limitBreak,glimmerId:tables.timings.rules.BuffId_Glimmer!,
      partyElements:build.actors.map(member=>tables.characters[member.id]!.EET!)});
  }
  if ((!seinaMain && !supportAdapters[String(build.actors[0]?.id)]) || build.actors.slice(1).some(actor => !legacyCombatSupports.includes(actor.id) && !supportAdapters[String(actor.id)])) {
    throw new Error('선택한 여행가의 전투 규칙을 연결하는 중입니다. 예시 파티로 대체하지 않고, 연결되지 않은 규칙을 무시해서 계산하지 않습니다.');
  }
  if (example.live) {
    const supported: Record<number, number[]> = {
      162: [516201, 516202, 516203, 516204, 516205, 516206, 516207, 516208, 516209, 516210, 516211, 516212, 516213, 516241, 516242, 516243],
      115: [511521,511522,511523,511524,511525,511526,511527,511528,511529,511530,511531,511532,511533,511541,511542,511543],
      107: [510721,510722,510723,510724,510725,510726,510727,510728,510729,510730,510731,510732,510733,510741,510742,510743],
      108: [510821,510822,510823,510824,510825,510826,510827,510828,510829,510830,510831,510832,510833,510841,510842,510843],
      149: [514921,514922,514923,514924,514925,514926,514927,514928,514929,514930,514931,514932,514933,514941,514942,514943],
    };
    for (const actor of build.actors) {
      const allowed=supportAdapters[String(actor.id)]?.potentials ?? supported[actor.id]!;
      const unknown = Object.keys(actor.context.potentials).map(Number).filter(id => !allowed.includes(id));
      if (unknown.length) throw new Error(`여행가 ${actor.id}의 잠재력 ${unknown.join(', ')} 전투 규칙이 아직 연결되지 않았습니다. 선택을 무시하지 않고 계산을 중단했습니다.`);
    }
    if(seinaMain&&build.actors[0]!.context.potentials[516203]&&options.distance>=2.8)
      throw new Error('세이나(기원)의 돌진 일반 공격이 필요한 거리에서는 이 잠재력을 검증하지 못했습니다. 2.8 미만 거리에서 계산할 수 있습니다.');
  }
  const fps = 60, main = String(build.actors[0]!.id), hotaruId = '115', tiliaId = '107', kasimiraId = '108', grayId = '149';
  const party = build.actors.map(actor => String(actor.id));
  const cooldownBuffIds=new Set<number>();
  const energyBuffIds=new Set<number>();
  const hasHotaru = party.includes(hotaruId), hasTilia = party.includes(tiliaId), hasKasimira = party.includes(kasimiraId);
  const hasGray = party.includes(grayId)&&main!==grayId;
  const contexts: Record<string, CombatLevelContext> = Object.fromEntries(build.actors.map(actor => [String(actor.id), actor.context]));
  const partyPotentials=Object.assign({},...build.actors.map(actor=>actor.context.potentials));
  for(const [actor,context] of Object.entries(contexts)) contexts[actor]={...context,partyPotentials};
  contexts.boss = contexts[main]!;
  const base = Object.fromEntries(build.actors.map(actor => [String(actor.id), actor.base]));
  const boss = raidBossProfile(options.boss, tables.bossTables, tables.timings.rules);
  if (![100023, 100024, 100025, 100026].includes(boss.ability)) throw new Error(`보스 특수 효과 ${boss.ability}의 전투 규칙이 아직 연결되지 않았습니다.`);
  const calculation = combatCalculationRules(tables.config, tables.attributeLimits, tables.attributeSetLimits);
  const seina = createSeinaRules(contexts[main]!.potentials, contexts[main]!.limitBreak, tables.timings.rules.BuffId_Glimmer!);
  // Shared breakthrough hooks are dispatched once below. Individual adapters
  // retain only their skill, resource and potential mechanics in this model.
  const hotaru = createHotaruRules(contexts[hotaruId]?.potentials ?? {}, tables.timings.rules.BuffId_Glimmer!, 0);
  const lightParty = party.filter(id => tables.characters[Number(id)]?.EET === 5);
  const tilia = createTiliaRules(contexts[tiliaId]?.potentials ?? {}, 0, party, lightParty.length);
  const kasimira = createKasimiraSupportRules(contexts[kasimiraId]?.potentials ?? {}, combatTagHash('108_Ultra'));
  const kasimiraShared = createKasimiraSharedRules(contexts[kasimiraId]?.potentials ?? {}, 0, party);
  const gray = createGraySupportRules(contexts[grayId]?.potentials ?? {}, 0);
  const earthTag = combatTagHash('Earth');
  const earthBuffIds = new Set(Object.entries(tables.buffDefinitions).filter(([, row]) =>
    Object.entries(row).some(([key, value]) => key.startsWith('BuffTag') && value === earthTag)).map(([id]) => Number(id)));
  const taggedBuffCache=new Map<string,Set<number>>();
  const taggedBuffIds=(tag:string)=>{
    let ids=taggedBuffCache.get(tag);
    if(!ids) {
      const hash=combatTagHash(tag);
      ids=new Set(Object.entries(tables.buffDefinitions).filter(([,row])=>
        Object.entries(row).some(([key,value])=>key.startsWith('BuffTag') && value===hash)).map(([id])=>Number(id)));
      taggedBuffCache.set(tag,ids);
    }
    return ids;
  };
  const lightBuffIds=taggedBuffIds('Light'),lightMark1BuffIds=taggedBuffIds('LightMark1');
  const hasBuffTag=(state:CombatRuntimeState,owner:string,tag:string)=>{
    const ids=taggedBuffIds(tag);
    return Object.values(state.buffs).some(buff=>buff.owner===owner && ids.has(buff.id) && (buff.expires===null || buff.expires>time(state)));
  };
  const selections = example.live?.records ?? example.records;
  const mainRecords = selections.slice(0, 3);
  if (mainRecords.some(record => record.id && ![214039, 214038, 214066].includes(record.id))) throw new Error('선택한 메인 레코드의 전투 중 효과가 아직 연결되지 않았습니다. 다른 레코드로 대체하지 않았습니다.');
  const melody = (id: number) => { const record = mainRecords.find(record => record.id === id); return record ? record.limitBreak + 1 : 0; };
  const concertos = contexts[main]!.concertos;
  const records = createRecordRules({ summer: melody(214039), waves: melody(214038), star: melody(214066),
    flash: concertos[40661] ?? 0, sky: concertos[40391] ?? 0, dance: concertos[40381] ?? 0,
    tomorrow: concertos[40662] ?? 0, footsteps: concertos[40382] ?? 0, sunlight: concertos[40392] ?? 0 },
    build.actors.map(actor => ({ id: String(actor.id), light: tables.characters[actor.id]?.EET === 5,
      job: ({ 1: 'dealer', 2: 'balance', 3: 'support' } as const)[tables.characters[actor.id]?.Class as 1|2|3] ?? 'dealer' })), main);
  const time = (state: CombatRuntimeState) => state.tick / fps;
  const parameter = (actor: string, id: number) => getCombatValue(id, tables.parameters, tables.parameterValues, contexts[actor]!).CommonData / 10000;
  const procListeners=build.actors.filter(actor=>actor.id!==162).map(actor=>({actor:String(actor.id),character:actor.id,breakthrough:actor.context.limitBreak}));
  type ProcEvent={state:CombatRuntimeState;event:string;attacker:string;tags:number[];owner?:string;excludeOwner?:string;facts:CombatProcContext['facts']};
  let dispatchingProcs=false;
  const pendingProcs:ProcEvent[]=[];
  function proc(state:CombatRuntimeState,event:string,attacker=main,tags:number[]=[],owner?:string,excludeOwner?:string,facts:CombatProcContext['facts']={}):CombatProcOnce[] {
    pendingProcs.push({state,event,attacker,tags,owner,excludeOwner,facts});
    if(dispatchingProcs) return [];
    dispatchingProcs=true;
    const once:CombatProcOnce[]=[];
    try {
      let count=0;
      while(pendingProcs.length) {
        if(++count>10000) throw new Error('Runaway nested character proc events');
        const current=pendingProcs.shift()!, runtime=current.state;
        const result=dispatchCombatProcs(reviewedBreakthroughRules,procListeners,runtime.procs ?? {},{
          ...current,context:listener=>({attacker:current.attacker,target:typeof current.facts.procTarget==='string'?current.facts.procTarget:'boss',main,party,time:time(runtime),tags:current.tags,buffs:buffApi(runtime),
            facts:{eliteOrBoss:true,boss:true,lightCount:lightParty.length,
              allEarth:party.every(id=>tables.characters[Number(id)]?.EET===3),allFire:party.every(id=>tables.characters[Number(id)]?.EET===2),
              allWater:party.every(id=>tables.characters[Number(id)]?.EET===1),allDark:party.every(id=>tables.characters[Number(id)]?.EET===6),
              windCount:party.filter(id=>tables.characters[Number(id)]?.EET===4).length,
              mainHpFraction:1,hpFraction:1,hasShield:combatShieldTotal(runtime.shields ?? {},listener.actor,time(runtime))>0,
              firstStageUltraBuff:listener.character===139&&hasBuffTag(runtime,listener.actor,'139_Ultra_Buff'),
              hitTargetCount:1,waterMark:hasBuffTag(runtime,'boss','Water'),waterMark1:hasBuffTag(runtime,'boss','WaterMark1'),lightMark1:hasBuffTag(runtime,'boss','LightMark1'),
              earthMark1:hasBuffTag(runtime,'boss','EarthMark1'),windMark1:hasBuffTag(runtime,'boss','WindMark1'),fireMark:hasBuffTag(runtime,'boss','Fire'),
              coldOrFrozen:hasBuffTag(runtime,'boss','Cold')||hasBuffTag(runtime,'boss','Frozen'),
              waterMark1OrColdOrFrozen:hasBuffTag(runtime,'boss','WaterMark1')||hasBuffTag(runtime,'boss','Cold')||hasBuffTag(runtime,'boss','Frozen'),
              ...(supportAdapters[listener.actor]?.procFacts&&runtime.supportScripts?.[listener.actor]?supportAdapters[listener.actor]!.procFacts!(runtime.supportScripts[listener.actor]!):{}),...current.facts},
            groups:{friends:party,avatars:Object.entries(runtime.summons ?? {}).filter(([,summon])=>summon.owner===listener.actor&&summon.alive).map(([id])=>id),
              'owned-minions':Object.entries(runtime.summons ?? {}).filter(([,summon])=>summon.owner===listener.actor&&summon.alive).map(([id])=>id),'earth-players':party.filter(id=>tables.characters[Number(id)]?.EET===3),
              'fire-players':party.filter(id=>tables.characters[Number(id)]?.EET===2),
              'wind-players':party.filter(id=>tables.characters[Number(id)]?.EET===4),
              'dark-players':party.filter(id=>tables.characters[Number(id)]?.EET===6),
              'water-players':party.filter(id=>tables.characters[Number(id)]?.EET===1),
              'light-players':lightParty},parameter:id=>parameter(listener.actor,id),
            randomPercent:()=>{
              const random=nextCombatRandom(Number(runtime.script.randomSeed ?? 108162));
              runtime.script.randomSeed=random.seed;
              return random.percent;
            }}),
        });
        runtime.procs=result.state;
        once.push(...result.once);
      }
    } finally { dispatchingProcs=false;pendingProcs.length=0; }
    return once;
  }
  const timing = (actor: number) => tables.timings.characters.find(character => character.id === actor)!;
  const comboCache = new Map<string, CompiledCombo>();
  const getCombo = (actor: number, tag: string | number[], index = 0, attackSpeed = 1,bundleSource?:string,group?:string): CompiledCombo => {
    const key = JSON.stringify([actor,tag,index,attackSpeed,bundleSource,group]);
    const cached = comboCache.get(key);
    if (cached) return cached;
    const combo=resolveCombatCombo(timing(actor),tag,index,attackSpeed,fps,tables.timings.rules.Combat_HitboxContinuousDamageDetectInterval!,{source:bundleSource,group});
    comboCache.set(key, combo);
    return combo;
  };
  const rapier = seinaMain ? getCombo(162, contexts[main]!.potentials[516201] ? 'Skill_Main1_P1' : 'Skill_Main1') : undefined;
  const mainCombo = rapier ? chainCombatCombos([{ combo: rapier, until: rapier.activationEnd }, { combo: getCombo(162, 'Skill_Main2') }]) : undefined;
  const hotaruUltTag = `${options.cinematics ? 'Ultra_TL' : 'Ultra_NoTL_H6'}${contexts[hotaruId]?.potentials[511542] ? '_P42' : ''}`;
  const actionList: CombatAction[] = [];
  const define = (id: string, actor: string, skill: number, combo: CompiledCombo, flag: number, extra: Partial<CombatAction> = {}) => {
    const row = tables.skills[skill];
    if (!row) throw new Error(`Missing skill ${skill}`);
    actionList.push({ id, actor, combo, flag, cooldown: (row.SkillCD ?? 0) / 10000, cooldownTiming: 'start', spCost: row.UltraEnergy ?? 0,
      charges:row.SectionAmount || 1,useInterval:(row.UseInterval ?? 0)/10000,
      skillKey: String(skill), spBudget: row.GetEnergyLimit || null, ...extra });
  };
  if(seinaMain) {
    for (let stage = 0; stage < 4; stage++) define(`162:normal:${stage}`, main, 16210000, getCombo(162, seinaNormalTag(stage)), 2, { automatic: true });
    if(contexts[main]!.potentials[516204]) define('162:super-normal',main,16210000,getCombo(162,'Skill_Main_SuperZhong'),2,{automatic:true});
    define('162:skill', main, 16231000, mainCombo!, 4, { spBudget: contexts[main]!.potentials[516201] ? parameter(main, 16201011) * 10000 : tables.skills[16231000].GetEnergyLimit });
    define('162:extra', main, 16231002, getCombo(162, 'Skill_Main_SuperQing'), 4);
    define('162:ultimate:claymore', main, 16240000, getCombo(162, 'Ultra_Zhong'), 32, { cooldownKey: '162:ultimate' });
    define('162:ultimate:rapier', main, 16240000, getCombo(162, 'Ultra_Qing'), 32, { cooldownKey: '162:ultimate' });
  }
  if (hasHotaru) {
    const start = getCombo(115, hotaruUltTag, 0), loop = getCombo(115, hotaruUltTag, 1);
    const loops = Math.ceil(Math.max(0, 1.8 - start.duration) / loop.duration);
    const ultimate = chainCombatCombos([{ combo: start }, ...Array.from({ length: loops }, () => ({ combo: loop })),
      { combo: options.cinematics ? getCombo(115, 'Ultra_TL_H6') : getCombo(115, hotaruUltTag, 2) }]);
    define('115:skill', hotaruId, 11532001, getCombo(115, 'Support_Blade_Enter'), 4, { cooldownTiming: 'end' });
    define('115:ultimate', hotaruId, 11540000, ultimate, 32);
    for (let stage = 0; stage < 4; stage++) define(`115:normal:${stage}`, hotaruId, 11512000, getCombo(115, hotaru.normalTag(stage,lightParty.length===party.length)), 2, { automatic: true });
    if(contexts[hotaruId]!.potentials[511524]) define('115:area',hotaruId,11532003,getCombo(115,hotaru.areaTag(lightParty.length===party.length)),64,{automatic:true});
    define('115:exit', hotaruId, 11532002, getCombo(115, hotaru.exitTag), 64, { automatic: true });
  }
  if (hasTilia) {
    define('107:skill', tiliaId, 10732000, getCombo(107, [5, 23, 23]), 4);
    define('107:ultimate', tiliaId, 10740000, getCombo(107, [options.cinematics ? 20 : 21]), 32);
  }
  if (hasKasimira) {
    const tag = options.cinematics ? 'Ultra_TL_Loop' : 'Ultra_NoTL_Loop';
    // The first clip is the entrance. The coroutine advances five loop
    // completions, then starts the selected final shot as a new combo.
    const ultimate = chainCombatCombos([{ combo: getCombo(108, tag, 0) },
      ...Array.from({ length: 5 }, () => ({ combo: getCombo(108, tag, 1) })),
      { combo: getCombo(108, contexts[kasimiraId]!.potentials[510842] ? 'Ultra_P42_End' : 'Ultra_End') }]);
    define('108:skill', kasimiraId, 10832000, getCombo(108, 'B2_Skill'), 4);
    define('108:ultimate', kasimiraId, 10840000, ultimate, 32);
  }
  if (hasGray) {
    const skill = chainCombatCombos([{ combo: getCombo(149, gray.skillTag, 0) },
      ...Array.from({ length: gray.loopCount }, () => ({ combo: getCombo(149, gray.skillTag, 1) })),
      { combo: getCombo(149, gray.skillTag, 2) }]);
    define('149:skill', grayId, 14932000, skill, 4);
    define('149:ultimate', grayId, 14940000, getCombo(149, gray.ultimateTag(options.cinematics)), 32);
  }
  for(const [actor,adapter] of Object.entries(supportAdapters)) for(const action of adapter.actions(options.cinematics)) {
    let combo=getCombo(Number(actor),action.tag,0,1,undefined,action.group);
    if(action.chain) combo=chainCombatCombos(action.chain.flatMap(part=>{
      const combo=getCombo(Number(actor),part.tag,part.index ?? 0);
      const entry:CombatTimelineEvent={skinId:Number(actor)*100+1,index:-1,type:0,name:part.enterEvent ?? '',
        tag:'',hitDamageId:0,startSeconds:0,endSeconds:0,damageDetectIntervalSeconds:0};
      if(part.repeatSeconds!==undefined){
        const result:{combo:CompiledCombo;until:number}[]=[];let left=Math.ceil(part.repeatSeconds*fps)/fps;
        while(left>1e-9){const until=Math.min(left,combo.duration);result.push({combo,until});left-=until;}return result;
      }
      return [{combo:part.enterEvent?{...combo,events:[{time:0,event:entry,occurrence:0},...combo.events]}:combo,
        ...(part.until==='activation'?{until:combo.activationEnd}:{})}];
    }));
    if(action.reload) {
      const source=timing(Number(actor)),reloadGroup=source.reloadClips?.find(group=>group.default!=='0');
      const pointer=action.reloadIndex===undefined?reloadGroup?.default:reloadGroup?.alternates[action.reloadIndex];
      const reload=source.timelines.find(timeline=>timeline.pathId===pointer);
      if(!reload) throw new Error(`Missing native reload clip ${actor}`);
      combo=compileCombo(reload,false,1,Number(actor)*100+1,tables.timings.rules.Combat_HitboxContinuousDamageDetectInterval!,fps);
      combo.events=[]; // ActorAttackReloadState triggers visual effects only.
      combo={...combo,duration:combo.activationEnd}; // exits upon entering recovery
    }
    if(action.loopSeconds!==undefined || action.loopCount!==undefined || action.loopBodySeconds!==undefined) {
      if(!combo.loop) throw new Error(`Scripted loop action is not a native loop ${actor}/${action.kind}`);
      const alias=timing(Number(actor)).comboAliases.find(alias=>typeof action.tag==='string'?alias.tag===action.tag:JSON.stringify(alias.keys)===JSON.stringify(action.tag))!;
      const bodyIndex=action.loopBodyIndex ?? 1;
      if(bodyIndex<1||bodyIndex>=alias.clips.length-1)throw new Error(`Invalid native loop body ${actor}/${action.kind}`);
      const body=getCombo(Number(actor),action.tag,bodyIndex),end=getCombo(Number(actor),action.tag,alias.clips.length-1);
      const parts:{combo:CompiledCombo;until?:number}[]=[{combo}];
      if(action.loopCount!==undefined) for(let count=0;count<action.loopCount;count++) parts.push({combo:body});
      else {
        let remaining=action.loopBodySeconds!==undefined?Math.ceil(action.loopBodySeconds*fps)/fps:Math.ceil(action.loopSeconds!*fps)/fps-combo.duration;
        if(remaining<0) throw new Error(`Loop cancel occurs before anticipation ends ${actor}/${action.kind}`);
        while(remaining>1e-9){const until=Math.min(body.duration,remaining);parts.push({combo:body,until});remaining-=until;}
      }
      parts.push({combo:action.loopFinishTag?getCombo(Number(actor),action.loopFinishTag):end});combo=chainCombatCombos(parts);
    } else if(combo.loop&&!action.scriptedLoop) throw new Error(`Native loop ${actor}/${action.kind} needs its script completion condition`);
    define(`${actor}:${action.kind}`,actor,action.skill,combo,action.flag ?? (action.kind==='ultimate'?32:action.normal?2:action.automatic?64:4),
      {cooldownTiming:action.cooldownTiming ?? 'start',automatic:action.automatic,
        ...(action.charges===undefined?{}:{charges:action.charges}),
        ...(action.spCost===undefined?{}:{spCost:action.spCost}),
        ...(action.cooldownKey===undefined?{}:{cooldownKey:`${actor}:${action.cooldownKey}`}),
        ...(action.cooldown===undefined?{}:{cooldown:action.cooldown}),...(action.spBudget===undefined?{}:{spBudget:action.spBudget})});
  }

  // Initialization and event handlers are intentionally in one profile: no
  // main-only fallback is permitted for an unhandled support action.
  const buffApi = (state: CombatRuntimeState): RecordRuleBuffs => ({
    add(owner, id, source = owner) {
      const context = contexts[source];
      if (!context) throw new Error(`Missing buff source ${source}`);
      const definition = getCombatValue(id, tables.buffDefinitions, tables.buffValues, context);
      if((definition.Effects ?? []).some(effect=>getCombatValue(effect,tables.effects,tables.effectValues,context).EffectType===3))cooldownBuffIds.add(id);
      if((definition.Effects ?? []).some(effect=>getCombatValue(effect,tables.effects,tables.effectValues,context).EffectType===37))energyBuffIds.add(id);
      // The resolved value row has a level-specific ID. Buff identity remains
      // the base Buff ID for remove/count and subsequent level resolution.
      const previous=state.buffs;
      state.buffs = addCombatBuff(state.buffs, { ...definition, Id: id,ValueId:definition.Id,
        GroupId:Number((tables.buffDefinitions[id] as any)?.GroupId ?? 0) }, owner, source, time(state));
      // A refused addition at the stack/instance/group limit raises no native
      // ACTOR_GET_BUFF event. Do not grant wish stacks or listener procs for it.
      if(state.buffs===previous) return;
      if (lightMark1BuffIds.has(id) && state.records && party.includes(source)) state.records = records.applyLightMark(state.records, buffApi(state), source);
      if (hasTilia && lightMark1BuffIds.has(id) && source === tiliaId) tilia.onOwnMarkApplied(buffApi(state), tiliaId);
      if(lightMark1BuffIds.has(id) && source===tiliaId) proc(state,'own-light-mark-applied',source,[],tiliaId);
      for(const element of ['Water','Fire','Earth','Wind','Light','Dark']) {
        const name=element.toLowerCase(),player=party.includes(source);
        if(taggedBuffIds(element).has(id)) {
          proc(state,`${name}-buff-added`,source);
          if(owner==='boss')proc(state,`monster-${name}-buff-added`,source);
          if(player) {
            proc(state,`player-${name}-buff-added`,source);
            if(element==='Light')proc(state,'player-light-buff',source);
            if(owner==='boss') {
              proc(state,`player-${name}-buff-added-to-monster`,source);
              proc(state,`player-or-summon-${name}-buff-added-to-monster`,source);
            }
          }
        }
        if(player&&taggedBuffIds(`${element}Mark1`).has(id)) {
          proc(state,`own-${name}-mark-1-applied`,source,[],source);
          proc(state,`player-${name}-mark-1-applied`,source);
        }
      }
    },
    remove(owner, id) { state.buffs = removeCombatBuff(state.buffs, owner, id); },
    count(owner, id) { return combatBuffCount(state.buffs, owner, id, time(state)); },
  });
  const attributes = (state: CombatRuntimeState, actor: string, damageType?: number, conditions?: CombatConditionFacts): ResolvedCombatAttributes => {
    const source = actor === 'boss' ? { attributes: state.boss!.attributes, scoped: [] } : base[actor]!;
    const resolved=collectCombatBuffAttributes(source.attributes, actor, state.buffs, time(state), tables.buffDefinitions, tables.buffValues,
      tables.effects, tables.effectValues, contexts, damageType === undefined ? undefined : { damageType,conditions }, source.scoped);
    return source.cooldowns?.length?{...resolved,cooldowns:[...source.cooldowns,...(resolved.cooldowns ?? [])]}:resolved;
  };
  function summonAttributes(state:CombatRuntimeState,actor:string,entity:number,damageType?:number,conditions?:CombatConditionFacts){
    const key=`${actor}#${entity}`,summon=state.summons?.[key];
    if(!summon)throw new Error(`Missing native summon ${key}`);
    return collectCombatBuffAttributes(summon.attributes.attributes,key,state.buffs,time(state),tables.buffDefinitions,tables.buffValues,
      tables.effects,tables.effectValues,contexts,damageType===undefined?undefined:{damageType,conditions},summon.attributes.scoped);
  }
  function shield(state:CombatRuntimeState,id:number,owner:string,source:string,api?:CombatRuntimeApi,extraSeconds=0) {
    state.shields=addCombatShield(state.shields ?? {},id,owner,source,time(state),{
      definitions:tables.shieldDefinitions,values:tables.shieldValues,levels:contexts,limits:tables.attributeLimits,
      attributes:actor=>attributes(state,actor).attributes,
      hp:actor=>actor==='boss' ? state.boss!.hp : readCombatAttribute(attributes(state,actor).attributes,3,tables.attributeLimits),
    });
    if(extraSeconds) state.shields=extendCombatShield(state.shields,id,owner,extraSeconds,time(state));
    api?.schedule({kind:'shield-change',actor:source,data:{id,owner,source,added:1}},0);
  }
  for (const actor of party) for (const effect of records.staticEffects(actor)) {
    base[actor] = applyCombatAttributeEffect(base[actor]!, getCombatValue(effect, tables.effects, tables.effectValues, contexts[actor]!));
  }
  for (const actor of party) for (const effect of staticPotentialEffects(contexts[actor]!.potentials, tables.potentials, tables.effects)) {
    base[actor] = applyCombatAttributeEffect(base[actor]!, getCombatValue(effect, tables.effects, tables.effectValues, contexts[actor]!));
  }
  const allWeapons = tables.timings.characters.flatMap(character => character.weapons);
  function cancelWeapon(state:CombatRuntimeState,api:CombatRuntimeApi,id:number){
    const weapon=state.weapons?.[id];
    if(!weapon)return;
    delete state.weapons![id];
    if(supportAdapters[weapon.actor]?.weaponEnd)api.schedule({kind:'support-weapon-end',actor:weapon.actor,priority:0,data:{name:weapon.name,id}},0);
    for(const child of weapon.children ?? [])cancelWeapon(state,api,child);
    for(const change of weapon.exit){
      for(const id of change.remove)buffApi(state).remove(change.target,id);
      for(const id of change.add)buffApi(state).add(change.target,id,weapon.actor);
    }
    for(const area of weapon.finishAreas ?? [])api.schedule({kind:'generated-area',actor:weapon.actor,data:area},0);
    if(weapon.area)api.schedule({kind:'support-area-end',actor:weapon.actor,
      data:{name:weapon.name,cancelled:1,x:weapon.x ?? options.distance,z:weapon.z ?? 0,center:weapon.center}},0);
  }
  function spawnWeapon(state: CombatRuntimeState, api: CombatRuntimeApi, actor: string, name: string, override?: number, distance?: number, sword = false, center='boss',areaOptions:SupportAreaOptions={}) {
    let weapon = allWeapons.find(weapon => weapon.name === name);
    if (!weapon) throw new Error(`Missing example weapon ${name}`);
    const durationOverride=supportAdapters[actor]?.weaponDuration?.(name,supportApi(state,api,actor));
    if(durationOverride!==undefined)weapon={...weapon,components:weapon.components.map(component=>component.type==='AdventureRotateWeapon'
      ?{...component,data:{...component.data,_duration:durationOverride}}:component)};
    if(areaOptions.duration!==undefined) weapon={...weapon,components:weapon.components.map(component=>component.type==='AreaEffectEntity'
      ? {...component,data:{...component.data,duration:areaOptions.duration}} : component)};
    if(areaOptions.disableBuffs) weapon={...weapon,components:weapon.components.filter(component=>component.type!=='AreaEffect_BuffComponent')};
    if(areaOptions.disableGeneratedAreas) weapon={...weapon,components:weapon.components.filter(component=>component.type!=='AreaEffect_GenerateAreaEffectComponent')};
    if(areaOptions.hitInterval!==undefined) weapon={...weapon,components:weapon.components.map(component=>component.type==='AreaEffect_AttackComponent'
      ? {...component,data:{...component.data,hitInterval:areaOptions.hitInterval}} : component)};
    if(areaOptions.moveSpeed!==undefined) weapon={...weapon,components:weapon.components.map(component=>component.type==='AreaEffect_MoveComponent'
      ? {...component,data:{...component.data,speed:areaOptions.moveSpeed}} : component)};
    if(areaOptions.scale!==undefined){
      const scale=areaOptions.scale;
      if(!Number.isFinite(scale)||scale<=0)throw new Error(`Invalid area scale ${name}`);
      const old=weapon.components.find(component=>component.type==='Transform')?.data.m_LocalScale?.x ?? 1;
      weapon={...weapon,components:[...weapon.components.filter(component=>component.type!=='Transform'),{type:'Transform',data:{m_LocalScale:{x:old*scale}}}]};
    }
    if(areaOptions.growth)weapon={...weapon,components:[...weapon.components,{type:'AreaEffect_ScriptScale',data:areaOptions.growth}]};
    if(weapon.components.some(c=>c.type==='AreaEffectEntity'&&c.data.areaWithActorScale)){
      const scale=tables.actorScales?.[Number(actor)];
      if(!scale)throw new Error(`Missing native model scale ${actor}`);
      const transform=weapon.components.find(c=>c.type==='Transform')?.data.m_LocalScale?.x ?? 1;
      weapon={...weapon,components:[...weapon.components.filter(c=>c.type!=='Transform').map(c=>c.type==='AreaEffectEntity'?{...c,data:{...c.data,areaWithActorScale:0}}:c),
        {type:'Transform',data:{m_LocalScale:{x:transform*scale}}}]};
    }
    if(areaOptions.enemyEnterBuffs?.length) {
      const criteria={filterCriteriaList:[{targetType:16,elementType:254,monsterEpicType:30,operationType:0}],operationType:0};
      weapon={...weapon,components:[...weapon.components,{type:'AreaEffect_BuffComponent',data:{
        executeImmediately:true,addBuffIdList:areaOptions.enemyEnterBuffs,removeBuffIdList:[],addInterval:0,removeInterval:0,
        addCriteriaInfo:criteria,removeCriteriaInfo:criteria,triggerEnter:true,triggerExit:false,triggerEnterCriteriaInfo:criteria}}]};
    }
    if (name.startsWith('Bullet_107_Support_Skill_ThrowShield')) {
      const data = weapon.components.find(component => component.type === 'AdventureFlyShield')!.data;
      const speed = combatFixed(data.moveSpeed);
      // Stationary close-range model: first contact is at the main, then the
      // actual six-rebound main/boss sequence. Distance is an exposed setting.
      const firstMain = !name.endsWith('_P24') && Boolean(contexts[tiliaId]!.potentials[510723]);
      tilia.shieldTargets(data.reboundTime, firstMain).forEach((target, index) => api.schedule({ kind: '107:shield-contact', actor,
        data: { target, rebounds: index > data.reboundTime ? -1 : index - (firstMain ? 1 : 0) }, snapshot: attributes(state, actor), hitId: data.hitDamageId,
        feature: data.hitFeatureData, featureFlags: data.hitFlags ?? 0 }, Math.max(1 / fps, options.distance / speed) * (index + 1)));
      return;
    }
    const projectileAttributes:{id:number;count:number;source:string}[]=[];
    if(weapon.components.some(c=>/^Adventure.*(Bullet|Projectile)$/.test(c.type))){
      let speed=1;
      for(const [id,listener] of Object.entries(supportAdapters)){
        const modification=listener.projectileModifiers?.(state.supportScripts![id]!,supportApi(state,api,id),actor,name,distance ?? options.distance);
        if(modification){projectileAttributes.push(...modification.attributes);speed*=modification.speedMultiplier;}
      }
      if(speed!==1)weapon={...weapon,components:weapon.components.map(c=>c.type==='AdventureBullet'?{...c,data:{...c.data,moveSpeed:combatFixed(c.data.moveSpeed)*speed}}:c)};
    }
    const plan = planCombatWeapon(weapon, distance ?? options.distance, fps, override, allWeapons,
      {...tables.timings.rules,SingleEnemyMainRebound:1,AssumeContinuousRotateContact:1,AssumeBezier3DFirstContact:1});
    const weaponId=(state.weaponSequence ?? 0)+1;state.weaponSequence=weaponId;
    state.weapons ??={};
    const area=weapon.components.find(component=>component.type==='AreaEffectEntity')?.data;
    state.weapons[weaponId]={actor,name,area:Boolean(area),center,started:time(state),expires:time(state)+plan.duration,exit:[],...(areaOptions.growth?{growth:areaOptions.growth}:{})};
    // AdventureWeapon.Setup copies owner attributes before WEAPON_BORN.
    const snapshot = plan.snapshot ? areaOptions.entity===undefined?attributes(state, actor):summonAttributes(state,actor,areaOptions.entity) : undefined;
    if(snapshot)state.weapons[weaponId]!.snapshot=snapshot;
    const ownerAdapter=supportAdapters[actor];
    if(ownerAdapter?.weaponBegin)api.schedule({kind:'support-weapon-begin',actor,priority:0,data:{name,id:weaponId}},0);
    const schedule=(event:Omit<RuntimeEvent,'sequence'|'tick'>,delay:number)=>api.schedule({...event,weaponId},delay);
    const collectSword=actor===main&&seinaMain&&contexts[main]!.potentials[516204]&&name==='AreaEffect_162_LeiDianZhongJian_Hold';
    const positioned=area && (collectSword || center!=='boss' || areaOptions.x!==undefined || areaOptions.z!==undefined);
    const centerX=areaOptions.x ?? (center==='boss'?options.distance:0),centerZ=areaOptions.z ?? 0;
    const landing=!area&&areaOptions.x!==undefined?createCombatLandingGeometry(weapon,{x:centerX,z:centerZ,angle:areaOptions.angle},fps):undefined;
    const geometry=positioned?createCombatAreaGeometry(weapon,{x:centerX,z:centerZ,angle:areaOptions.angle},fps,{
      owner:{x:0,z:0},main:{x:0,z:0},target:{x:options.distance,z:0}}):undefined;
    state.weapons[weaponId]!.x=centerX;state.weapons[weaponId]!.z=centerZ;
    if(collectSword&&geometry?.contains({x:0,z:0},0)) schedule({kind:'162:collect-sword',actor},0);
    if(area) {
      const angle=areaOptions.angle ?? 0;
      for(const generation of planCombatAreaGeneration(weapon,allWeapons,plan.duration,fps)) {
        if(generation.finish && geometry?.moving) throw new Error(`Moving area ${name} needs cancellation-position generation handling`);
        const position=geometry?.entityPositionAt(generation.time) ?? {x:centerX,z:centerZ};
        const actualAngle=geometry?.angleAt(generation.time) ?? angle,actualRadians=actualAngle*Math.PI/180;
        const x=position.x+Math.cos(actualRadians)*generation.offset.z-Math.sin(actualRadians)*generation.offset.x;
        const z=position.z+Math.sin(actualRadians)*generation.offset.z+Math.cos(actualRadians)*generation.offset.x;
        const child={name:generation.name,x,z,angle:actualAngle+generation.angle};
        schedule({kind:'generated-area',actor,data:child},generation.time);
        if(generation.finish)(state.weapons[weaponId]!.finishAreas ??=[]).push(child);
      }
    }
    const bossInArea=!geometry || geometry.contains({x:options.distance,z:0},0);
    for (const impact of plan.impacts.filter(impact=>(!geometry||geometry.contains({x:options.distance,z:0},impact.time))
      &&(!landing||landing.contains({x:options.distance,z:0},impact.time)))) schedule({ kind: 'impact', actor, snapshot: impact.snapshot ? snapshot : undefined,
      hitId: impact.hitId, scalingActor:areaOptions.scalingActor, feature: impact.feature, featureFlags: impact.featureFlags, additionalAttributes:[...(areaOptions.additionalAttributes??[]),...projectileAttributes], data: { weapon: name,
        ...(areaOptions.entity===undefined?{}:{minionEntity:areaOptions.entity}),
        ...(impact.sharedImmunity?{immunityGroup:impact.sharedImmunity.group,immunityDuration:impact.sharedImmunity.duration}:{}) } }, impact.time);
    if (actor === kasimiraId && name === 'Bullet_108_B2_Skill') schedule({ kind: '108:bomb-finish', actor }, plan.duration);
    const candidates=party.map(id=>({id,player:true,main:id===main,element:tables.characters[Number(id)]!.EET!,summoner:null,minion:false}));
    const bossTarget={id:'boss',player:false,main:false,element:tables.bossTables.adjustments[boss.monsterId]?.EET ?? 0,
      monsterEpic:tables.bossTables.monsters[boss.monsterId]?.EpicLv,summoner:null,minion:false};
    const collisionActors=[...candidates,bossTarget];
    const areaTargets=area ? geometry?.moving?collisionActors:collisionActors.filter(target=>target.id==='boss' ? bossInArea : geometry?geometry.contains({x:0,z:0},0):Math.hypot(centerX,centerZ)<combatFixed(area.hitBoxRadius)) : [];
    for (const change of planCombatAreaBuffs(weapon, fps,{owner:candidates.find(target=>target.id===actor)!,candidates:areaTargets,
      moving:geometry?.moving,contains:geometry?(id,at)=>geometry.contains({x:id==='boss'?options.distance:0,z:0},at):undefined,
      context:{actors:collisionActors,relation:(from,to)=>(from==='boss')===(to==='boss')?'friend':'enemy'}})) {
      if(change.tracking){
        schedule({kind:'area-exit-tracking',actor,data:{key:change.exitKey!,target:change.target!,enter:change.tracking==='enter'?1:0,
          add:change.add.join(','),remove:change.remove.join(',')}},change.time);
        continue;
      }
      for (const id of change.add) schedule({ kind: 'area-buff', actor, data: { id, remove: 0,target:change.target ?? 'boss' } }, change.time);
      for (const id of change.remove) schedule({ kind: 'area-buff', actor, data: { id, remove: 1,target:change.target ?? 'boss' } }, change.time);
      if(!geometry?.moving && change.time===plan.duration) state.weapons[weaponId]!.exit.push({target:change.target ?? 'boss',add:change.add,remove:change.remove});
    }
    if (plan.finishArea) {
      if(landing)schedule({kind:'generated-area',actor,data:{name:plan.finishArea,x:centerX,z:centerZ,angle:areaOptions.angle ?? 0}},plan.duration);
      else schedule({ kind: 'weapon-spawn', actor, data: { name: plan.finishArea, distance: 0 } }, plan.duration);
    }
    if(area && (supportAdapters[actor] || actor===main&&seinaMain&&name==='AreaEffect_162_LeiDianZhongJian_Hold')) {
      schedule({kind:'support-area-end',actor,data:{name,x:centerX,z:centerZ,center}},plan.duration);
    }
    if(supportAdapters[actor] && weapon.components.some(component=>['AdventureProjectile','AdventureFbxFollowBullet','AdventureBezierBullet'].includes(component.type))) {
      schedule({kind:'support-projectile-end',actor,data:{name,target:'boss',x:centerX,z:centerZ}},plan.duration);
    }
    if (sword && seina.returningSword()) {
      const data = weapon.components.find(component => component.type === 'AdventureBullet')!.data;
      const returnDistance = Math.max(0, combatFixed(data.moveSpeed) * combatFixed(data.lifeTime) - options.distance);
      schedule({ kind: 'weapon-spawn', actor, data: { name: 'Bullet_162_JianQi_Back_Heng', distance: returnDistance } }, plan.duration);
    }
    schedule({kind:'weapon-lifetime-end',actor},plan.duration);
      if (name === 'AreaEffect_107_Support_Skill_P25_Boom') tilia.activateP25(tiliaApi(state, api));
    return weaponId;
  }
  function seinaApi(state: CombatRuntimeState, api: CombatRuntimeApi): SeinaScriptApi {
    return { time: time(state), actor: main, balanceActors: party.filter(id => tables.characters[Number(id)]?.Class === 2), lightActorCount: lightParty.length, buffs: buffApi(state),
      parameter: id => parameter(main, id),
      startBurstRegen(generation) { api.schedule({ kind: '162:regen', actor: main, data: { generation } }, parameter(main, 16243011)); },
      sword(id) { spawnWeapon(state, api, main, 'Bullet_162_JianQi_Heng', id, options.distance, true); },
      area(name,forwardOffset) {
        if(name==='AreaEffect_162_LeiDianZhongJian_Fall_Skil_Main'){
          const random=nextCombatRandom(Number(state.script.randomSeed ?? 108162));
          state.script.randomSeed=random.seed;
          const angle=random.percent/100*2*Math.PI;
          spawnWeapon(state,api,main,name,undefined,0,false,'boss',{x:options.distance+3*Math.cos(angle),z:3*Math.sin(angle)});
        }else spawnWeapon(state, api, main, name, undefined, 0,false,'boss',forwardOffset===undefined?{}:{x:forwardOffset,z:0});
      },
    };
  }
  function hotaruApi(state: CombatRuntimeState, api: CombatRuntimeApi): HotaruScriptApi {
    return { time: time(state), actor: hotaruId, party, allLight: lightParty.length === party.length, buffs: buffApi(state),
      lightActors:lightParty,mainLight:lightParty.includes(main),bossHpFraction:state.boss!.hp/state.boss!.maxHp,distance:options.distance,
      parameter: id => parameter(hotaruId, id), resetSupportCooldown() { api.resetCooldown('115:skill'); },
      projectile(name) { spawnWeapon(state, api, hotaruId, name); },
      area(name) { spawnWeapon(state, api, hotaruId, name, undefined, 0); },
      flyingBatch(first) {
        const pattern = hotaru.flyingPattern(first,lightParty.length===party.length);
        for (let index = 0; index < pattern.count; index++) api.schedule({ kind: 'weapon-spawn', actor: hotaruId,
          data: { name: pattern.projectile, distance: 30 } }, pattern.delay + index * pattern.interval);
      },
      areaAttack() { api.schedule({kind:'script-cast',actor:hotaruId,data:{action:'115:area'}},0); },
      shield:id=>shield(state,id,main,hotaruId,api),
    };
  }
  function tiliaApi(state: CombatRuntimeState, api: CombatRuntimeApi): TiliaScriptApi {
    return { time: time(state), actor: tiliaId, main, buffs: buffApi(state), parameter: id => parameter(tiliaId, id),
      directSp(raw) { api.directSp(tiliaId, raw); },
      areaDuration(name) { return combatFixed(allWeapons.find(weapon => weapon.name === name)!.components.find(component => component.type === 'AreaEffectEntity')!.data.duration); },
      reduceSupportCooldown(seconds) { api.reduceCooldown('107:skill', seconds); },
      projectile(name) { spawnWeapon(state, api, tiliaId, name); },
      area(name, delayFrames = 0) {
        if (delayFrames) api.schedule({ kind: 'weapon-spawn', actor: tiliaId, data: { name, distance: 0 } }, delayFrames / fps);
        else spawnWeapon(state, api, tiliaId, name, undefined, 0);
      },
    };
  }
  function kasimiraApi(state: CombatRuntimeState, api: CombatRuntimeApi): KasimiraSupportApi {
    return { actor: kasimiraId, time: time(state), buffs: buffApi(state), parameter: id => parameter(kasimiraId, id),
      randomPercent() {
        const result = nextCombatRandom(Number(state.script.randomSeed ?? 108162));
        state.script.randomSeed = result.seed;
        return result.percent;
      },
      resetSupportCooldown() { api.resetCooldown('108:skill'); },
      area(name) { spawnWeapon(state, api, kasimiraId, name, undefined, 0); },
      deathExplosion(hitId, _radius, targetBuff) {
        api.schedule({ kind: 'impact', actor: kasimiraId, hitId, feature: { buffIdsForTarget: [targetBuff] }, featureFlags: 0x20 }, 0);
      },
    };
  }
  function grayApi(state: CombatRuntimeState, api?: CombatRuntimeApi): GrayApi {
    return { actor: grayId, time: time(state), distance: options.distance,
      earthActors: party.filter(id => tables.characters[Number(id)]?.EET === 3).length,
      buffs: buffApi(state), parameter: id => parameter(grayId, id),
      area(name) {
        if (!api) throw new Error('Gray area event requires the runtime scheduler');
        spawnWeapon(state, api, grayId, name, undefined, 0);
      },
    };
  }
  function supportApi(state:CombatRuntimeState,api:CombatRuntimeApi,actor:string):SupportCombatApi {
    const areaData=(name:string)=>{
      const data=allWeapons.find(weapon=>weapon.name===name)?.components.find(component=>component.type==='AreaEffectEntity')?.data;
      if(!data || data.duration===undefined) throw new Error(`Missing support area configuration ${name}`);
      return data;
    };
    return {actor,main,party,lightActors:lightParty,time:time(state),distance:options.distance,buffs:buffApi(state),
      parameter:id=>parameter(actor,id),
      area(name,target='boss',areaOptions={}) {
        if(target!=='boss' && !party.includes(target)) throw new Error(`Unknown support area target ${target}`);
        spawnWeapon(state,api,actor,name,areaOptions.hitId,0,false,target,areaOptions);
        return areaOptions.duration ?? combatFixed(areaData(name).duration);
      },
      stopWeapons(prefix,exact=false) {
        for(const [key,weapon] of Object.entries(state.weapons ?? {})) if(weapon.actor===actor && (exact?weapon.name===prefix:weapon.name.startsWith(prefix))) {
          cancelWeapon(state,api,Number(key));
        }
      },
      areaRadius:name=>combatFixed(areaData(name).hitBoxRadius),
      stopAreasByTag(tag){
        const hash=combatTagHash(tag);
        for(const [key,weapon] of Object.entries(state.weapons ?? {})){
          if(weapon.actor!==actor||!weapon.area)continue;
          const data=areaData(weapon.name);
          if(data.areaTag===tag||data.areaHashCode===hash||data.areaChildTagList?.includes(tag)||data.areaChildHashCodeList?.includes(hash))
            cancelWeapon(state,api,Number(key));
        }
      },
      activeAreas(tag){return Object.values(state.weapons ?? {}).filter(w=>w.area&&w.expires>time(state)&&areaData(w.name).areaTag===tag).length;},
      areaContains(tag,target){
        return Object.values(state.weapons ?? {}).some(w=>{
          if(!w.area||w.expires<=time(state)||areaData(w.name).areaTag!==tag)return false;
          const original=allWeapons.find(item=>item.name===w.name)!;
          const weapon=w.growth?{...original,components:[...original.components,{type:'AreaEffect_ScriptScale',data:w.growth}]}:original;
          const geometry=createCombatAreaGeometry(weapon,{x:w.x ?? 0,z:w.z ?? 0},fps,{owner:{x:0,z:0},main:{x:0,z:0},target:{x:options.distance,z:0}});
          return geometry.contains({x:target==='boss'?options.distance:0,z:0},time(state)-(w.started ?? 0));
        });
      },
      extendAreas(tag,seconds){
        if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid area extension');
        for(const [key,w] of Object.entries(state.weapons ?? {})){
          if(!w.area||areaData(w.name).areaTag!==tag)continue;
          const weaponId=Number(key),started=w.started ?? 0,oldDuration=w.expires-started;
          const expires=w.expires+Math.ceil(seconds*fps)/fps,duration=expires-started;
          const original=allWeapons.find(item=>item.name===w.name)!;
          if(original.components.some(c=>c.type==='AreaEffect_MoveComponent'))throw new Error(`Moving area extension needs a path handler: ${w.name}`);
          const weapon={...original,components:original.components.map(c=>c.type==='AreaEffectEntity'?{...c,data:{...c.data,duration}}:c)};
          const plan=planCombatWeapon(weapon,0,fps,undefined,allWeapons,tables.timings.rules);
          const oldEnd=Math.round(w.expires*fps),newEnd=Math.round(expires*fps);
          state.queue=state.queue.map(e=>e.weaponId===weaponId&&e.tick===oldEnd&&e.kind!=='impact'?{...e,tick:newEnd}:e);
          for(const impact of plan.impacts)if(impact.time>=oldDuration-1e-9)
            api.schedule({kind:'impact',actor:w.actor,weaponId,hitId:impact.hitId,snapshot:impact.snapshot?w.snapshot:undefined,feature:impact.feature,featureFlags:impact.featureFlags,data:{weapon:w.name}},started+impact.time-time(state));
          // Tona's ultimate emits child areas; the parent has no attack
          // component. Extending only its expiry would add no actual hits.
          for(const generation of planCombatAreaGeneration(weapon,allWeapons,duration,fps))
            if(!generation.finish&&generation.time>=oldDuration-1e-9)
              api.schedule({kind:'generated-area',actor:w.actor,weaponId,data:{name:generation.name,
                x:(w.x ?? 0)+generation.offset.z,z:(w.z ?? 0)+generation.offset.x,angle:generation.angle}},started+generation.time-time(state));
          state.weapons![weaponId]={...w,expires};
        }
      },
      buffTagCount(owner,tag){const ids=taggedBuffIds(tag);return [...ids].reduce((n,id)=>n+buffApi(state).count(owner,id),0);},
      removeBuffTag(owner,tag){for(const id of taggedBuffIds(tag))buffApi(state).remove(owner,id);},
      projectile(name,target='boss',travelDistance,projectileOptions={}) {
        if(target!=='boss') {
          if(!party.includes(target)) throw new Error(`Unknown projectile target ${target}`);
          const weapon=allWeapons.find(weapon=>weapon.name===name);
          if(!weapon) throw new Error(`Missing support projectile ${name}`);
          const plan=planCombatWeapon(weapon,travelDistance??0,fps,undefined,allWeapons,tables.timings.rules);
          // A friendly delivery has no enemy impact. Native OnBulletFinish is
          // delivered separately after its actual projectile flight timer.
          api.schedule({kind:'support-projectile-end',actor,data:{name,target}},plan.duration);
          return;
        }
        spawnWeapon(state,api,actor,name,undefined,travelDistance,false,'boss',projectileOptions);
      },
      projectileAt(name,target,origin={x:0,z:0}){
        spawnWeapon(state,api,actor,name,undefined,Math.hypot(target.x-origin.x,target.z-origin.z),false,'boss',target);
      },
      projectileAs(source,name,distance){spawnWeapon(state,api,source,name,undefined,distance,false,'boss',{scalingActor:actor});},
      drop(name,position,buffId){
        const weapon=allWeapons.find(weapon=>weapon.name===name),data=weapon?.components.find(component=>component.type==='DropEntity')?.data;
        if(!weapon||!data)throw new Error(`Missing native drop ${name}`);
        const random=()=>{const next=nextCombatRandom(Number(state.script.randomSeed ?? 108162));state.script.randomSeed=next.seed;return next.percent/100;};
        // Current raid profile is an unobstructed floor. Keep random landing
        // position separate from the pickup test, rather than auto-collecting.
        const angle=random()*2*Math.PI,radius=Number(data.minDropDis)+(Number(data.maxDropDis)-Number(data.minDropDis))*random();
        const landing={x:position.x+Math.cos(angle)*radius,z:position.z+Math.sin(angle)*radius,y:position.y ?? 0};
        const plan=planCombatDrop(weapon,landing,{x:0,z:0},fps);
        state.drops ??={};
        const existing=Object.entries(state.drops).filter(([,drop])=>drop.name===name).sort((a,b)=>a[1].created-b[1].created||Number(a[0])-Number(b[0]));
        if(existing.length>=plan.maximum && existing[0]){
          const [oldId,old]=existing[0];delete state.drops[Number(oldId)];
          api.schedule({kind:'drop-finish',actor:old.actor,data:{name:old.name,picked:0}},0);
        }
        const id=(state.dropSequence ?? 0)+1;state.dropSequence=id;
        state.drops[id]={actor,name,created:state.tick};
        state.counts[`drop:${name}:generated`]=(state.counts[`drop:${name}:generated`] ?? 0)+1;
        api.schedule({kind:'drop-finish',actor,data:{id,name,picked:plan.picked?1:0,buff:buffId ?? plan.buff}},plan.time);
      },
      directionalProjectile(name,path) {
        const weapon=allWeapons.find(weapon=>weapon.name===name);
        if(!weapon) throw new Error(`Missing directional projectile ${name}`);
        const plan=planStraightCombatProjectile(weapon,{x:path.x,z:path.z},{x:path.dx,z:path.dz},[
          {id:'boss',position:{x:options.distance,z:0}},...party.map(id=>({id,position:{x:0,z:0},friendly:true}))],fps,tables.timings.rules,{x:options.distance,z:0});
        const weaponId=(state.weaponSequence ?? 0)+1;state.weaponSequence=weaponId;state.weapons ??={};
        state.weapons[weaponId]={actor,name,area:false,center:'boss',expires:time(state)+plan.duration,exit:[]};
        for(const hit of plan.hits) {
          if(hit.target==='boss' && (path.hitId ?? plan.data.hitDamageId)) api.schedule({kind:'impact',actor,weaponId,hitId:path.hitId ?? plan.data.hitDamageId,
            snapshot:!plan.data.useOwnerActorInfo?attributes(state,actor):undefined,feature:plan.data.hitFeatureData,featureFlags:plan.data.hitFlags,
            data:{weapon:name,...(path.tagUid===undefined?{}:{tagUid:path.tagUid})}},hit.time);
        }
        for(const hit of plan.buffContacts) for(const id of hit.target==='boss'?path.enemyBuffs ?? []:path.friendBuffs ?? [])
          api.schedule({kind:'area-buff',actor,weaponId,data:{id,remove:0,target:hit.target}},hit.time);
        const angle=Math.atan2(path.dz,path.dx)*180/Math.PI;
        for(const generated of planCombatProjectileGeneration(weapon,allWeapons,plan.duration,plan.positionAt,fps))
          api.schedule({kind:'generated-area',actor,weaponId,data:{name:generated.name,...generated.position,angle,bind:generated.bound?1:0}},generated.time);
        const pointer=weapon.components.find(component=>component.type==='WeaponFeatureFinishTriggerArea')?.data.areaEffectPrefab?.m_PathID;
        if(pointer && pointer!=='0') {
          const area=allWeapons.find(weapon=>weapon.pathId===pointer);
          if(!area) throw new Error(`Missing directional projectile finish area ${pointer}`);
          api.schedule({kind:'directional-finish-area',actor,weaponId,data:{name:area.name,...plan.end}},plan.duration);
        }
        api.schedule({kind:'weapon-lifetime-end',actor,weaponId},plan.duration);
      },
      projectilePosition(name,path,elapsed){
        const weapon=allWeapons.find(weapon=>weapon.name===name);
        if(!weapon)throw new Error(`Missing directional projectile ${name}`);
        const plan=planStraightCombatProjectile(weapon,{x:path.x,z:path.z},{x:path.dx,z:path.dz},[],fps,tables.timings.rules,{x:options.distance,z:0});
        return elapsed<plan.duration?plan.positionAt(elapsed):null;
      },
      skillReady(key){
        const action=actionList.find(action=>action.id===`${actor}:${key}`);
        if(!action)return false;
        const id=action.cooldownKey ?? action.id;
        return state.tick>=Math.max(state.ready[id] ?? 0,state.useReady?.[id] ?? 0)
          &&state.pausedCooldowns?.[id]===undefined&&state.sp.ledger.pools[actor]!.value>=action.spCost;
      },
      chargeCount:key=>api.chargeCount(`${actor}:${key}`),
      stopWeapon:id=>{if(state.weapons?.[id]?.actor===actor)cancelWeapon(state,api,id);},
      ultimateCooling(owner){const action=actionList.find(a=>a.id===`${owner}:ultimate`);return Boolean(action&&state.tick<(state.ready[action.cooldownKey??action.id]??0));},
      consumeCharge:key=>api.consumeCharge(`${actor}:${key}`),
      attribute:type=>readCombatAttribute(attributes(state,actor).attributes,type,tables.attributeLimits),
      initialAttribute:type=>{
        const snapshot=state.initialAttributes?.[actor];
        if(!snapshot)throw new Error(`Initial attribute snapshot is not ready: ${actor}`);
        return readCombatAttribute(snapshot.attributes,type,tables.attributeLimits,false);
      },
      buffAttribute(id,type){
        let value:ResolvedCombatAttributes={attributes:{},scoped:[]};
        const buff=getCombatValue(id,tables.buffDefinitions,tables.buffValues,contexts[actor]!);
        for(const effect of buff.Effects ?? [])value=applyCombatAttributeEffect(value,getCombatValue(effect,tables.effects,tables.effectValues,contexts[actor]!));
        const attr=value.attributes[type];
        return {base:attr?.base ?? 0,percent:attr?.percent ?? 0,absolute:attr?.absolute ?? 0};
      },
      summonAi(id){
        const monster=tables.bossTables.monsters[id],row=monster&&tables.monsterAi?.[(monster as any).FAId];
        if(!row)throw new Error(`Missing native summoned AI ${id}`);
        const branch=(row.ActionBranchIds as number[] ?? []).map(id=>tables.monsterBranches?.[id]).find(branch=>branch&&tables.skills[branch.SkillId]?.FCPath?.includes('NormalAttack'));
        if(!branch&&row.ActionBranchIds?.length)throw new Error(`Missing native summoned normal branch ${id}`);
        if(!branch&&!row.ActionAIPath)throw new Error(`Missing native summoned controller ${id}`);
        const [,character,group]=String(row.ComboGroupPath).split('/');
        return {source:`char_${character}_${group?.toLowerCase()}.unity3d`,thinkSeconds:(row.ThinkInterval ?? 0)/10000,
          normalCooldown:(branch?.CD ?? 0)/10000,initialCooldown:(branch?.InitCD ?? 0)/10000,
          ...(!branch?{customController:String(row.ActionAIPath)}:{})};
      },
      independentLease(key,until){state.script[`lease:${actor}:${key}`]=until;},
      onceDot(buff,hit,period){api.schedule({kind:'native-dot-start',actor,hitId:hit,data:{buff,period}},1/fps);},
      summon(entity,buffs){
        const snapshot=state.initialAttributes?.[actor];
        if(!snapshot)throw new Error(`Initial summon snapshot missing for ${actor}`);
        state.summons ??={};const key=`${actor}#${entity}`;
        state.summons[key]={owner:actor,entity,alive:true,attributes:snapshot};
        for(const id of buffs)buffApi(state).add(key,id,actor);
      },
      despawn(entity){const key=`${actor}#${entity}`,summon=state.summons?.[key];if(summon)state.summons![key]={...summon,alive:false};},
      summonAttribute:(entity,type)=>readCombatAttribute(summonAttributes(state,actor,entity).attributes,type,tables.attributeLimits,false),
      minionHit:(entity,id)=>api.schedule({kind:'impact',actor,hitId:id,data:{minionEntity:entity}},0),
      independentAllowed(tag,elapsed,skill,source,speed=1){
        const combo=getCombo(Number(actor),tag,0,speed,source);
        if(elapsed>=combo.duration)return true;
        const phase=combo.phases.filter(p=>p.time<=elapsed+1e-9).at(-1);
        return Boolean(phase&&(phase.execute&64)&&(phase.break&64)&&(!phase.executeSkills.length||phase.executeSkills.includes(skill))&&(!phase.breakSkills.length||phase.breakSkills.includes(skill)));
      },
      independentCombo(tag,{maximumSeconds,source,speed,lease,index=0,entity}={}){
        const combo=getCombo(Number(actor),tag,index,speed ?? 1,source);
        const duration=maximumSeconds===undefined?combo.duration:Math.min(combo.duration,maximumSeconds);
        if(!Number.isFinite(duration)||duration<=0)throw new Error(`Invalid independent combo duration ${tag}`);
        for(const frame of combo.events)if(frame.time<duration)
          api.schedule({kind:'combo',actor,comboEvent:frame.event,data:{independentTag:typeof tag==='string'?tag:'',
            independentKeys:Array.isArray(tag)?tag.join(','):'',independentIndex:index,
            independentStarted:time(state),independentSource:source ?? '',independentSpeed:speed ?? 1,independentLease:lease ?? '',
            ...(entity===undefined?{}:{independentEntity:entity})}},frame.time);
        return duration;
      },
      shield:(id,target,extraSeconds)=>shield(state,id,target,actor,api,extraSeconds),
      removeShield(id,target){
        const key=`${target}:${id}`,shield=state.shields?.[key];
        if(!shield)return;
        state.shields={...state.shields};delete state.shields[key];
        api.schedule({kind:'shield-change',actor:shield.source,data:{id,owner:target,source:shield.source,added:0}},0);
      },
      hasShieldTag:(owner,tag)=>hasCombatShieldTag(state.shields ?? {},owner,combatTagHash(tag),time(state),tables.shieldDefinitions),
      hit:(id,removeBuffsAfterHit,feature)=>api.schedule({kind:'impact',actor,hitId:id,priority:0,removeBuffsAfterHit,feature,featureFlags:feature?0x20:0},0),
      hitAs:(source,id)=>api.schedule({kind:'impact',actor:source,scalingActor:actor,hitId:id,priority:0},0),
      toughnessDamage:percent=>{state.boss=damageRaidToughness(state.boss!,boss,Math.max(0,percent)*
        (readCombatAttribute(state.boss!.attributes,42,tables.attributeLimits)||boss.toughness),time(state),buffApi(state));},
      bossHasToughness:()=>state.boss!.brokenUntil<=time(state)&&state.boss!.toughness>0,
      bossHpPercent:()=>state.boss!.hp/state.boss!.maxHp,
      buffDuration:id=>(getCombatValue(id,tables.buffDefinitions,tables.buffValues,contexts[actor]!).Time ?? 0)/10000,
      extendBuff(owner,id,seconds){
        if(!Number.isFinite(seconds))throw new Error('Invalid buff duration extension');
        for(const [key,buff] of Object.entries(state.buffs))if(buff.owner===owner&&buff.id===id&&buff.expires!==null)
          state.buffs[key]={...buff,expires:buff.expires+seconds};
      },
      bossBroken:()=>state.boss!.brokenUntil>time(state),
      actorActive:id=>id===main||(id===hotaruId?Boolean(state.hotaru?.onField):Boolean(state.motions[id])),
      buffLimit:id=>getCombatValue(id,tables.buffDefinitions,tables.buffValues,contexts[actor]!).LaminatedNum!,
      directSp:(target,amount)=>api.directSp(target,amount),
      removeStacks:(owner,id,count)=>{state.buffs=removeCombatBuff(state.buffs,owner,id,count,time(state));},
      reduceCooldown:(seconds,key='skill')=>api.reduceCooldown(`${actor}:${key}`,seconds),
      randomPercent(){
        const random=nextCombatRandom(Number(state.script.randomSeed ?? 108162));
        state.script.randomSeed=random.seed;return random.percent;
      },
      actorsByElement:element=>party.filter(id=>tables.characters[Number(id)]?.EET===element),
      actorInfo:id=>({element:tables.characters[Number(id)]!.EET ?? 0,job:tables.characters[Number(id)]!.Class ?? 0}),
      ultimateReady(){
        const pool=state.sp.ledger.pools[actor]!,action=actionList.find(action=>action.id===`${actor}:ultimate`)!;
        return pool.value>=action.spCost && state.tick>=(state.ready[action.cooldownKey ?? action.id] ?? 0);
      },
      cast:key=>api.schedule({kind:'script-cast',actor,data:{action:`${actor}:${key}`}},0),
      hasBuffTag:(owner,tag)=>hasBuffTag(state,owner,tag),
      activeAction:()=>state.motions[actor]?.action.slice(actor.length+1) ?? null,
      interrupt:()=>api.schedule({kind:'script-interrupt',actor},0),
      resetCooldown:(key='skill')=>api.resetCooldown(`${actor}:${key}`),
      restartCooldown:(key='skill')=>api.restartCooldown(`${actor}:${key}`),
      pauseCooldown:(key='skill')=>api.pauseCooldown(`${actor}:${key}`),
      resumeCooldown:(key='skill')=>api.resumeCooldown(`${actor}:${key}`),
      retainCooldownPercent:(percent,key='skill')=>api.retainCooldownPercent(`${actor}:${key}`,percent),
      schedule:(name,seconds,data={})=>api.schedule({kind:'support-script-event',actor,data:{...data,name}},seconds),
      emitProc:(name,facts={},participants={})=>{proc(state,name,participants.attacker??actor,[],actor,undefined,{...facts,...(participants.target?{procTarget:participants.target}:{})});},
      entityData(name){
        const source=timing(Number(actor));
        const candidates=[...(source.entities ?? []),...source.weapons.flatMap(weapon=>weapon.components
          .filter(component=>['FlowerEntity','ScatteringDartsEntity'].includes(component.type))
          .map(component=>({name:weapon.name,type:component.type,data:component.data})))];
        const entities=[...new Map(candidates.filter(entity=>entity.name===name||entity.type===name)
          .map(entity=>[`${entity.type}:${entity.data.m_GameObject?.m_PathID ?? entity.name}`,entity])).values()];
        if(entities.length!==1)throw new Error(`Missing or ambiguous native special entity ${actor}/${name}`);
        return entities[0]!.data;
      },
      weaponName(pathId){
        const weapon=allWeapons.find(weapon=>weapon.pathId===pathId);
        if(!weapon)throw new Error(`Missing native special-entity projectile ${pathId}`);
        return weapon.name;
      },
      weaponData(name,type){const component=allWeapons.find(w=>w.name===name)?.components.find(c=>c.type===type);if(!component)throw new Error(`Missing weapon component ${name}/${type}`);return component.data;},
    };
  }
  function hitConditions(state: CombatRuntimeState, event: RuntimeEvent, hit: ReturnType<typeof resolveCombatHit>, definition: CombatHitDefinition): CombatConditionContext {
    const buffs = (owner: string) => Object.values(state.buffs).filter(buff=>buff.owner===owner && (buff.expires===null || buff.expires>time(state)))
      .map(buff=>({id:buff.id,group:Number((tables.buffDefinitions[buff.id] as any)?.GroupId ?? 0),stacks:buff.stacks,
        tags:Object.entries(tables.buffDefinitions[buff.id] ?? {}).filter(([key])=>key.startsWith('BuffTag')).map(([,value])=>Number(value))}));
    const actors: ConditionActor[] = party.map(id=>{
      const character = tables.characters[Number(id)]!, pool = state.sp.ledger.pools[id]!;
      return {id,player:true,main:id===main,hp:readCombatAttribute(attributes(state,id).attributes,3,tables.attributeLimits),hpFraction:1,
        element:character.EET ?? 0,job:character.Class ?? 0,faction:character.Faction ?? 0,broken:false,
        active:id===main || (id===hotaruId ? Boolean(state.hotaru?.onField) : Boolean(state.motions[id])),
        spPercent:pool.capacity ? pool.value/pool.capacity*100 : 0,buffs:buffs(id),shield:combatShieldTotal(state.shields ?? {},id,time(state))};
    });
    actors.push({id:'boss',player:false,main:false,hp:state.boss!.hp,hpFraction:state.boss!.hp/state.boss!.maxHp,
      element:tables.bossTables.adjustments[boss.monsterId]?.EET ?? 0,job:0,faction:tables.bossTables.monsters[boss.monsterId]?.Faction ?? 0,
      active:true,broken:state.boss!.brokenUntil>time(state),spPercent:0,buffs:buffs('boss'),weakElements:boss.weakElements});
    for(const [id,summon] of Object.entries(state.summons ?? {})){
      const character=tables.characters[Number(summon.owner)]!;
      actors.push({id,player:false,main:false,hp:readCombatAttribute(summon.attributes.attributes,3,tables.attributeLimits),hpFraction:1,
        element:character.EET ?? 0,job:character.Class ?? 0,faction:character.Faction ?? 0,active:true,broken:false,spPercent:0,buffs:buffs(id)});
    }
    const summons=Object.entries(state.summons ?? {}).filter(([,summon])=>summon.alive).map(([id,summon])=>({actor:id,owner:summon.owner,friendly:true}));
    const entity=event.data?.minionEntity ?? event.data?.independentEntity;
    const owner=entity===undefined?event.actor:`${event.actor}#${entity}`;
    return {owner,source:owner,enemy:'boss',actors,summons,
      hit:{id:definition.Id,damageType:hit.damageType,slot:(definition as any).SkillSlotType ?? 0,elements:[hit.element],
        distanceType:(definition as any).DistanceType ?? 0,tags:hit.tags},
      distance:(from,to)=>from===to ? 0 : from==='boss' || to==='boss' ? options.distance : 0};
  }
  function resolveHit(state: CombatRuntimeState, event: RuntimeEvent, api: CombatRuntimeApi) {
    if(event.data?.immunityGroup!==undefined){
      const key=`area-immunity:${event.data.immunityGroup}:boss`,last=state.script[key];
      const duration=Number(event.data.immunityDuration)||tables.timings.rules.Combat_HitboxDamageImmuneDuration!;
      if(!Number.isFinite(duration))throw new Error('Missing shared area hit immunity');
      if(typeof last==='number'&&time(state)<=last+duration+1e-9)return;
      state.script[key]=time(state);
    }
    const definition=tables.hits[event.hitId!];
    if (!definition) throw new Error(`Missing actual hit ${event.hitId}`);
    const hitContext=contexts[event.scalingActor ?? event.actor]!;
    const hit = resolveCombatHit(definition, hitContext);
    const hitInfo={actor:event.actor,damageType:hit.damageType,element:hit.element,slot:(definition as any).SkillSlotType ?? 0,tags:hit.tags,
      ...(event.weaponId===undefined?{}:{weaponId:event.weaponId}),
      ...(typeof event.data?.weapon==='string'?{weapon:event.data.weapon}:{}),
      ...(typeof event.data?.tagUid==='number'?{tagUid:event.data.tagUid}:{})};
    const hitFacts={damageType:hit.damageType,element:hit.element,slot:hitInfo.slot};
    const entity=event.data?.minionEntity ?? event.data?.independentEntity;
    if(entity!==undefined){
      // A native summon is not its owner: no player-only P5/P7/P42, record
      // hit counters, player SP, or support main-hit events are dispatched.
      const id=Number(entity),key=`${event.actor}#${id}`;
      const minionAdapter=supportAdapters[event.actor],minionApi=supportApi(state,api,event.actor);
      if(minionAdapter?.prepareMinionHit)state.supportScripts![event.actor]=minionAdapter.prepareMinionHit(state.supportScripts![event.actor]!,minionApi,id,hitInfo);
      const conditions=()=>hitConditions(state,event,hit,definition);
      let source=event.snapshot ?? summonAttributes(state,event.actor,id,hit.damageType,conditions);
      if(event.snapshot)source=collectCombatBuffAttributes(source.attributes,key,state.buffs,time(state),tables.buffDefinitions,tables.buffValues,
        tables.effects,tables.effectValues,contexts,{damageType:hit.damageType,conditions},source.scoped,true);
      for(const extra of minionAdapter?.beforeMinionHit?.(state.supportScripts![event.actor]!,minionApi,id,hitInfo)??[])
        source=addOnceCombatAttributes(source,getCombatValue(extra.id,tables.onceDefinitions,tables.onceValues,contexts[extra.source??event.actor]!),extra.count);
      for(const extra of proc(state,'before-player-or-minion-hit',event.actor,hit.tags,undefined,undefined,hitFacts))
        source=addOnceCombatAttributes(source,getCombatValue(extra.id,tables.onceDefinitions,tables.onceValues,contexts[extra.source]!),extra.count);
      for(const extra of proc(state,'before-own-or-minion-hit',event.actor,hit.tags,event.actor,undefined,hitFacts))
        source=addOnceCombatAttributes(source,getCombatValue(extra.id,tables.onceDefinitions,tables.onceValues,contexts[extra.source]!),extra.count);
      const result=calculateResolvedCombatHit(definition,hitContext,source,attributes(state,'boss',hit.damageType,conditions),calculation,false);
      api.damage(result.average);
      if(result.average>0){state.hitCounts ??={};const countKey=`${key}:${definition.Id}`;state.hitCounts[countKey]=(state.hitCounts[countKey] ?? 0)+1;}
      state.boss=damageRaidBoss(state.boss!,boss,result.average,readCombatAttribute(source.attributes,43,tables.attributeLimits),time(state),buffApi(state));
      state.boss=raidAbilityHit(state.boss,boss,hit.damageType,time(state),buffApi(state));
      if(minionAdapter?.afterMinionHit){
        const context=supportApi(state,api,event.actor),crit=context.randomPercent()<=result.critChance*100;
        state.supportScripts![event.actor]=minionAdapter.afterMinionHit(state.supportScripts![event.actor]!,context,id,hitInfo,crit);
      }
      resolveAdapterMark(state,event,api,hit.tags);
      const feature=event.feature;
      if(feature&&(event.featureFlags ?? 0)&0x10){
        for(const buff of feature.buffIdsForSelf ?? [])buffApi(state).add(key,buff,event.actor);
        for(const buff of feature.buffIdsForTarget ?? [])buffApi(state).add('boss',buff,event.actor);
      }
      return;
    }
    // ReceiveAttack precedes BeforeHit/ReceiveDamage in the client. Debuffs
    // applied here can affect this very hit, not just the following projectile.
    if (event.actor === kasimiraId) {
      const context = kasimiraApi(state, api);
      kasimiraShared.attacked(context, hit.tags, 'boss');
      state.kasimira = kasimira.attacked(state.kasimira!, context, hit.tags, 'boss');
    }
    const adapter=supportAdapters[event.actor];
    if(adapter?.attacked) state.supportScripts![event.actor]=adapter.attacked(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),hit.tags,hitInfo);
    if((definition.EffectType ?? 1)>=5){
      // ReceiveAttack also fires for native non-damaging hitboxes, but
      // BeforeHit, SP gain, critical and damage-post listeners do not.
      // Effect 7 first applies its features, then dispatches NO_DAMAGE;
      // character scripts may synchronously issue a fresh owner hit.
      if(definition.EffectType===6||definition.EffectType===7)applyHitFeatures(state,event);
      const replacement=definition.EffectType===7?adapter?.replaceNoDamageHit?.(event.hitId!):undefined;
      if(replacement){
        const data={...event.data};delete data.immunityGroup;delete data.immunityDuration;delete data.weapon;
        resolveHit(state,{...event,hitId:replacement,snapshot:undefined,feature:undefined,featureFlags:0,
          additionalAttributes:undefined,addBuffsAfterHit:undefined,removeBuffsAfterHit:undefined,data},api);
      }
      return;
    }
    const conditions = () => hitConditions(state,event,hit,definition);
    const onceAttributes:{id:number;count:number;source:string}[]=(event.additionalAttributes ?? []).map(effect=>({...effect,source:effect.source??event.actor}));
    const once = event.actor === main && seinaMain ? seina.beforeHit(seinaApi(state, api), hit.tags)
      : event.actor === hotaruId ? hotaru.beforeHit(hotaruApi(state, api), hit.tags)
      : event.actor === tiliaId ? tilia.beforeHit(tiliaApi(state, api), hit.tags) : [];
    for (const additional of once) onceAttributes.push({...additional,source:event.actor});
    if (hasKasimira) {
      const context = kasimiraApi(state, api);
      const broken = state.boss!.brokenUntil > time(state);
      const additional = kasimira.beforePartyHit(state.kasimira!, context, tables.characters[Number(event.actor)]!.EET ?? 0,
        (definition as any).SkillSlotType ?? 0, broken);
      if (event.actor === kasimiraId) additional.push(...kasimiraShared.beforeSelfHit(context,hit.tags),
        ...kasimira.beforeSelfHit(hit.tags, hit.element, broken));
      for (const id of additional) onceAttributes.push({id,count:1,source:kasimiraId});
    }
    if (hasGray&&event.actor === grayId) for (const additional of gray.beforeHit(state.gray!, grayApi(state, api), hit.tags, state.boss!.hp / state.boss!.maxHp)) {
      onceAttributes.push({...additional,source:grayId});
    }
    for(const additional of proc(state,'before-own-hit',event.actor,hit.tags,event.actor,undefined,hitFacts)) {
      onceAttributes.push(additional);
    }
    for(const additional of proc(state,'before-party-hit',event.actor,hit.tags,undefined,undefined,hitFacts)) {
      onceAttributes.push(additional);
    }
    for(const additional of proc(state,'before-other-party-hit',event.actor,hit.tags,undefined,event.actor,hitFacts)) {
      onceAttributes.push(additional);
    }
    onceAttributes.push(...proc(state,'before-player-or-minion-hit',event.actor,hit.tags,undefined,undefined,hitFacts));
    onceAttributes.push(...proc(state,'before-own-or-minion-hit',event.actor,hit.tags,event.actor,undefined,hitFacts));
    if(adapter?.prepareHit)state.supportScripts![event.actor]=adapter.prepareHit(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),hit.tags);
    for(const additional of adapter?.beforeHit?.(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),hit.tags) ?? []) {
      onceAttributes.push({...additional,source:event.actor});
    }
    for(const [actor,listener] of Object.entries(supportAdapters))if(listener.preparePartyHit)
      state.supportScripts![actor]=listener.preparePartyHit(state.supportScripts![actor]!,supportApi(state,api,actor),hitInfo);
    for(const [actor,listener] of Object.entries(supportAdapters)) for(const additional of listener.beforePartyHit?.(state.supportScripts![actor]!,supportApi(state,api,actor),hitInfo) ?? []) {
      onceAttributes.push({...additional,source:additional.source ?? actor});
    }
    // Native BeforeSettlement is after BeforeHit but before GetBothAllInfo /
    // CalculateDamage. Buff changes here affect this hit; once attributes
    // already selected in BeforeHit survive without re-running their gates.
    onceAttributes.push(...proc(state,'before-own-settlement',event.actor,hit.tags,event.actor,undefined,hitFacts));
    onceAttributes.push(...proc(state,'before-party-settlement',event.actor,hit.tags,undefined,undefined,hitFacts));
    for(const [actor,listener] of Object.entries(supportAdapters))if(listener.beforePartySettlement)
      state.supportScripts![actor]=listener.beforePartySettlement(state.supportScripts![actor]!,supportApi(state,api,actor),hitInfo);
    let source=event.snapshot ?? attributes(state,event.actor,hit.damageType,conditions);
    if(event.snapshot) source=collectCombatBuffAttributes(source.attributes,event.actor,state.buffs,time(state),tables.buffDefinitions,
      tables.buffValues,tables.effects,tables.effectValues,contexts,{damageType:hit.damageType,conditions},source.scoped,true);
    for(const additional of onceAttributes) source=addOnceCombatAttributes(source,
      getCombatValue(additional.id,tables.onceDefinitions,tables.onceValues,contexts[additional.source]!),additional.count);
    const target = attributes(state, 'boss', hit.damageType,conditions);
    const result = calculateResolvedCombatHit(definition, hitContext, source, target, calculation);
    // The native crit event occurs after GetBothAllInfo, before RealDamage /
    // ReceiveDamage. Keep this hit's captured attributes, but update resources
    // and buffs before damage-post listeners see the hit.
    const needsCriticalEvent=Boolean(adapter?.crit)||Object.values(supportAdapters).some(listener=>listener.partyCrit)||procListeners.some(listener=>(reviewedBreakthroughRules[listener.character] ?? []).some(rule=>
      listener.breakthrough>=(rule.breakthrough ?? 0)&&(rule.event==='party-crit'||rule.event==='own-crit'&&listener.actor===event.actor)));
    if(needsCriticalEvent) {
      const context=supportApi(state,api,event.actor);
      if(context.randomPercent()<=result.critChance*100) {
        proc(state,'own-crit',event.actor,hit.tags,event.actor,undefined,hitFacts);
        proc(state,'party-crit',event.actor,hit.tags,undefined,undefined,hitFacts);
        if(adapter?.crit)state.supportScripts![event.actor]=adapter.crit(state.supportScripts![event.actor]!,context,hitInfo);
        for(const [actor,listener] of Object.entries(supportAdapters))if(listener.partyCrit)
          state.supportScripts![actor]=listener.partyCrit(state.supportScripts![actor]!,supportApi(state,api,actor),hitInfo);
      }
    }
    api.damage(result.average);
    if(result.average>0){
      const key=`${event.actor}:${definition.Id}`;state.hitCounts ??={};
      state.hitCounts[key]=(state.hitCounts[key] ?? 0)+1;
    }
    state.boss = damageRaidBoss(state.boss!, boss, result.average, readCombatAttribute(source.attributes, 43, tables.attributeLimits), time(state), buffApi(state));
    if (hit.energy) api.hitSp({ ...event, skillKey: hit.skillKey }, hit.energy);
    state.boss = raidAbilityHit(state.boss, boss, hit.damageType, time(state), buffApi(state));
    if (hasTilia && (buffApi(state).count('boss', 3011) || buffApi(state).count('boss', 3012))) tilia.onMarkedTargetHit(tiliaApi(state, api), event.actor);
    if(buffApi(state).count('boss',3011) || buffApi(state).count('boss',3012)) proc(state,'marked-target-hit',event.actor);
    proc(state,'own-hit',event.actor,hit.tags,event.actor,undefined,hitFacts);
    proc(state,'party-hit',event.actor,hit.tags,undefined,undefined,hitFacts);
    for(const [actor,listener] of Object.entries(supportAdapters))if(listener.partyHit)
      state.supportScripts![actor]=listener.partyHit(state.supportScripts![actor]!,supportApi(state,api,actor),hitInfo);
    if(event.actor===main) for(const [actor,listener] of Object.entries(supportAdapters)) {
      if(listener.mainHit) state.supportScripts![actor]=listener.mainHit(state.supportScripts![actor]!,supportApi(state,api,actor));
    }
    if(adapter?.afterHit) state.supportScripts![event.actor]=adapter.afterHit(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),hit.tags,hitInfo);
    resolveAdapterMark(state,event,api,hit.tags);
    if (event.actor === main) {
      if(seinaMain) state.seina = seina.afterHit(state.seina!, seinaApi(state, api), hit.tags);
      if (seinaMain && seina.canTriggerMark(hit.tags) && buffApi(state).count('boss', 3011)
        && (state.script.lastMark === undefined || time(state) - Number(state.script.lastMark) > tables.timings.rules.TriggerElementMarkCD!)) {
        buffApi(state).remove('boss', 3011);
        // Spawn/copy mark attributes BEFORE the mark-trigger event grants wishes.
        spawnWeapon(state, api, main, 'AreaEffect_162_LightTrigger_Boom', undefined, 0);
        state.script.lastMark = time(state);
        state.records = records.triggerLightMark(state.records!, buffApi(state), main, true);
        seina.onMarkTrigger(seinaApi(state, api));
        state.seina=seina.onMarkSword(state.seina!,seinaApi(state,api));
        if (hasTilia) state.tilia = tilia.lightMarkTriggered(state.tilia!, tiliaApi(state, api));
        if (hasHotaru) hotaru.onLightMarkTriggered(hotaruApi(state, api));
        if(hasHotaru) hotaru.onMainMark(hotaruApi(state,api),2,Boolean(state.motions[hotaruId]));
        proc(state,'light-mark-triggered',main,hit.tags);
        raidAbilityMark(boss, main, buffApi(state));
      }
      if (hasHotaru) state.hotaru = hotaru.onMainHit(state.hotaru!, hotaruApi(state, api), hit.damageType);
    } else if (event.actor === hotaruId) {
      if (hotaru.canApplyMark(hit.tags)) buffApi(state).add('boss', 3011, hotaruId);
      state.hotaru=hotaru.afterHit(state.hotaru!,hotaruApi(state, api), hit.tags);
    } else if (event.actor === tiliaId) {
      tilia.afterHit(tiliaApi(state, api), hit.tags);
    } else if (event.actor === kasimiraId) {
      const context = kasimiraApi(state, api);
      state.kasimiraShared = kasimiraShared.afterSelfHit(state.kasimiraShared!, context, hit.tags);
      kasimira.afterSelfHit(context, hit.tags, 'boss');
      if (kasimiraShared.canTriggerFireMark(hit.tags) && buffApi(state).count('boss', 1011)
        && (state.script.lastFireMark === undefined || time(state) - Number(state.script.lastFireMark) > tables.timings.rules.TriggerElementMarkCD!)) {
        buffApi(state).remove('boss', 1011);
        state.script.lastFireMark = time(state);
        api.schedule({ kind: 'impact', actor: kasimiraId, hitId: kasimiraShared.fireMarkHit.hitId }, 0);
      }
    } else if (hasGray&&event.actor === grayId) {
      state.gray = gray.afterHit(state.gray!, grayApi(state, api), hit.tags);
      const marked = Object.values(state.buffs).some(buff => buff.owner === 'boss' && earthBuffIds.has(buff.id) && (buff.expires === null || buff.expires > time(state)));
      if (gray.canTriggerEarthMark(hit.tags) && marked
        && (state.script.lastEarthMark === undefined || time(state) - Number(state.script.lastEarthMark) > tables.timings.rules.TriggerElementMarkCD!)) {
        // Gray adds P31/P42 buffs before removing the mark and spawning it.
        gray.ownEarthMarkTriggered(grayApi(state, api));
        proc(state,'own-earth-mark',grayId,hit.tags,grayId);
        proc(state,'earth-mark-triggered',grayId,hit.tags);
        api.schedule({kind:'support-mark-triggered',actor:grayId,data:{element:3}},0);
        for (const id of earthBuffIds) buffApi(state).remove('boss', id);
        state.script.lastEarthMark = time(state);
        spawnWeapon(state, api, grayId, gray.markArea, undefined, 0);
      }
    }
    state.records = records.hit(state.records!, buffApi(state), event.actor, 'boss', hit.damageType, (definition as any).SkillSlotType ?? 0);
    applyHitFeatures(state,event);
    for(const buff of event.addBuffsAfterHit ?? [])buffApi(state).add(buff.owner,buff.id,event.actor);
    for(const buff of event.removeBuffsAfterHit ?? []) buffApi(state).remove(buff.owner,buff.id);
  }
  function resolveAdapterMark(state:CombatRuntimeState,event:RuntimeEvent,api:CombatRuntimeApi,tags:number[]){
    const adapter=supportAdapters[event.actor],context=supportApi(state,api,event.actor);
    const mark=adapter?.mark?.(tags,state.supportScripts![event.actor]!,context);
    if(!mark)return;
    const elementTag=({1:'Water',2:'Fire',3:'Earth',4:'Wind',5:'Light',6:'Dark'} as Record<number,string>)[mark.element]!;
    const ids=taggedBuffIds(mark.buffTag ?? elementTag),key=`mark:${event.actor}`;
    if(![...ids].some(id=>buffApi(state).count('boss',id)>0)||state.script[key]!==undefined&&time(state)-Number(state.script[key])<=tables.timings.rules.TriggerElementMarkCD!)return;
    if(adapter?.beforeMark)state.supportScripts![event.actor]=adapter.beforeMark(state.supportScripts![event.actor]!,context,tags);
    const name=elementTag.toLowerCase();
    proc(state,`before-own-${name}-mark`,event.actor,tags,event.actor);
    proc(state,`before-own-${name}-mark-${mark.variant ?? 1}`,event.actor,tags,event.actor);
    if(!mark.removeAfterHit)for(const id of ids)buffApi(state).remove('boss',id);
    state.script[key]=time(state);
    if(mark.applyBuff)for(const id of [mark.applyBuff].flat())buffApi(state).add('boss',id,event.actor);
    if(mark.area){
      const angle=mark.radius?context.randomPercent()/100*Math.PI*2:0;
      spawnWeapon(state,api,event.actor,mark.area,undefined,0,false,'boss',mark.radius?{x:options.distance+Math.cos(angle)*mark.radius,z:Math.sin(angle)*mark.radius}:{});
    }else if(mark.hit)api.schedule({kind:'impact',actor:event.actor,hitId:mark.hit,priority:0,
      addBuffsAfterHit:mark.afterHitBuffs?.map(id=>({owner:'boss',id})),removeBuffsAfterHit:mark.removeAfterHit?[...ids].map(id=>({owner:'boss',id})):undefined},0);
    else throw new Error(`Missing mark damage handler ${event.actor}`);
    api.schedule({kind:'support-mark-triggered',actor:event.actor,data:{element:mark.element,variant:mark.variant ?? 1,own:1,tags:tags.join(',')}},0);
  }
  function applyHitFeatures(state:CombatRuntimeState,event:RuntimeEvent){
    const feature = event.feature;
    if (feature) {
      const flags = event.featureFlags ?? 0;
      if (flags & 0x10) for (const id of feature.buffIdsForSelf ?? []) buffApi(state).add(event.actor, id, event.actor);
      if (flags & 0x20) for (const id of feature.buffIdsForTarget ?? []) buffApi(state).add('boss', id, event.actor);
      if (flags & 0x40) for (const id of feature.removeBuffIdsForSelf ?? []) buffApi(state).remove(event.actor, id);
      if (flags & 0x80) for (const id of feature.removeBuffIdsForTarget ?? []) buffApi(state).remove('boss', id);
    }
  }
  function seinaNormalTag(stage:number){
    return `162Atk${stage+1}${stage<3&&contexts[main]!.potentials[516204]?'_P3':''}`;
  }
  const scenario: CombatScenario = {
    fps,
    actors: party.map((id, index) => {
      const actor = build.actors.find(actor => String(actor.id) === id)!;
      const character = tables.characters[actor.id]!;
      const ultimates=actionList.filter(action=>action.actor===id&&action.flag===32);
      const spCapacity=ultimates.length?Math.max(...ultimates.map(action=>action.spCost))
        :tables.skills[(index ? character.AssistUltimateId : character.UltimateId)!]!.UltraEnergy;
      return { id, main: index === 0, spCapacity,
        efficiency: index ? .75 + actor.supportSpBonus : 1 + actor.mainSpBonus };
    }),
    actions: actionList,
    spRecipients(state){return scenario.actors.map(actor=>{
      let additive=0,percent=0,absolute=0;
      for(const buff of Object.values(state.buffs)){
        if(buff.owner!==actor.id||!energyBuffIds.has(buff.id)||(buff.expires!==null&&buff.expires<=time(state)))continue;
        const context=contexts[buff.source]!,definition=buff.valueId?tables.buffValues[buff.valueId]!:getCombatValue(buff.id,tables.buffDefinitions,tables.buffValues,context);
        for(const id of definition.Effects??[]){const value=getCombatValue(id,tables.effects,tables.effectValues,context);
          if(value.EffectType!==37||value.EffectTypeFirstSubtype!==(actor.main?1:0))continue;
          if(Number(value.EffectTypeParam2||0)!==0)throw new Error(`Player energy conversion requires native source ${id}`);
          const n=Number(value.EffectTypeParam1||0)*buff.stacks;
          if(value.EffectTypeSecondSubtype===1)additive+=n;else if(value.EffectTypeSecondSubtype===2)percent+=n;else if(value.EffectTypeSecondSubtype===3)absolute+=n;
        }
      }
      return {pool:actor.id,role:actor.main?'main' as const:'support' as const,efficiency:Math.max(0,(actor.efficiency+additive)*(1+percent)+absolute),alive:true,recoveryBlocked:false};
    });},
    cooldown(state,action){
      if(!action.cooldown||action.flag===2)return action.cooldown;
      if(!base[action.actor]?.cooldowns?.length&&!Object.values(state.buffs).some(buff=>buff.owner===action.actor&&cooldownBuffIds.has(buff.id)))return action.cooldown;
      const changes=attributes(state,action.actor).cooldowns ?? [];
      return resolveCombatCooldown(action.cooldown,action.flag===16?1:action.flag===32?4:2,changes);
    },
    continuation(state,action,api){
      const adapter=supportAdapters[action.actor],key=action.id.slice(action.actor.length+1);
      const next=adapter?.continuation?.(state.supportScripts![action.actor]!,supportApi(state,api,action.actor),key);
      if(!next)return null;
      state.supportScripts![action.actor]=next.state;
      return getCombo(Number(action.actor),next.tag,next.index ?? 0);
    },
    comboFor(state, action,api) {
      const adapter=supportAdapters[action.actor],key=action.id.slice(action.actor.length+1);
      const tag=adapter?.comboTag?.(state.supportScripts![action.actor]!,supportApi(state,api,action.actor),key);
      if(tag) return getCombo(Number(action.actor),tag,0,action.flag===2?readCombatAttribute(attributes(state,action.actor).attributes,47,tables.attributeLimits):1);
      if (action.flag !== 2) return action.combo;
      const speed = readCombatAttribute(attributes(state, action.actor).attributes, 47, tables.attributeLimits);
      const stage = Number(action.id.split(':')[2]);
      if (action.actor === main && seinaMain) return getCombo(162,action.id==='162:super-normal'?'Skill_Main_SuperZhong':seinaNormalTag(stage),0,speed);
      if (action.actor === hotaruId) return getCombo(115, hotaru.normalTag(stage,lightParty.length===party.length), 0, speed);
      return action.combo;
    },
    initialize(state, api) {
      state.boss = createRaidBossState(boss);
      state.supportScripts={};
      state.shields={};
      state.weapons={};state.weaponSequence=0;
      state.records = records.initial(buffApi(state));
      if(seinaMain) state.seina = seina.initialize(seinaApi(state, api));
      if (hasHotaru) state.hotaru = hotaru.initialize(hotaruApi(state, api));
      if (hasTilia) state.tilia = tilia.initialize(tiliaApi(state, api));
      if (hasKasimira) {
        state.kasimira = kasimira.initial();
        state.kasimiraShared = kasimiraShared.initial();
      }
      if (hasGray) state.gray = gray.initialize(grayApi(state, api));
      for(const [actor,adapter] of Object.entries(supportAdapters)) state.supportScripts[actor]=adapter.initialize(supportApi(state,api,actor));
      state.script.normalStage = 0;
      state.script.randomSeed = options.randomSeed ?? 108162;
      proc(state,'initialize');
      state.script.lastNormalEnd = 0;
      initializeRaidAbility(boss, main, buffApi(state));
      // AttributeList.CopyOwnerValue flattens the resolved value into each
      // entry's origin. Later buffs never mutate this initial snapshot.
      state.initialAttributes=Object.fromEntries(party.map(actor=>{
        const source=attributes(state,actor);
        return [actor,{attributes:Object.fromEntries(Array.from({length:96},(_,index)=>{
          const type=index+1;
          return [type,{origin:readCombatAttribute(source.attributes,type,tables.attributeLimits),base:0,percent:0,absolute:0}];
        })),scoped:source.scoped.map(value=>({...value}))}];
      }));
      api.schedule({ kind: 'profile-tick', actor: main }, 0);
    },
    automatic(state, actor,api) {
      const adapter=supportAdapters[actor];
      if(adapter?.automatic) {
        const key=adapter.automatic(state.supportScripts![actor]!,supportApi(state,api,actor));
        const action=key?actionList.find(action=>action.id===`${actor}:${key}`):undefined;
        const motion=state.motions[actor];
        // Buff-maintenance automation must not cancel a selected skill before
        // its shot. Explicit policy actions still use native interruption rules.
        if(action?.flag===16&&motion&&actionList.find(action=>action.id===motion.action)?.flag!==2)return null;
        return key?`${actor}:${key}`:null;
      }
      if (actor === main) {
        if(!seinaMain) return null;
        if(contexts[main]!.potentials[516204] && buffApi(state).count(main,16204011)>=
          getCombatValue(16204011,tables.buffDefinitions,tables.buffValues,contexts[main]!).LaminatedNum!) return '162:super-normal';
        let stage = Number(state.script.normalStage ?? 0);
        if (time(state) - Number(state.script.lastNormalEnd ?? 0) > 2 && !state.motions[main]?.action.startsWith('162:normal')) stage = 0;
        return `162:normal:${stage}`;
      }
      if (actor === hotaruId && state.hotaru!.onField && state.hotaru!.stanceUntil > 0) {
        if (time(state) >= state.hotaru!.stanceUntil) return '115:exit';
        return `115:normal:${state.hotaru!.stage}`;
      }
      return null;
    },
    canCast(state, action,api) {
      const adapter=supportAdapters[action.actor];
      if(adapter?.canCast && !adapter.canCast(state.supportScripts![action.actor]!,supportApi(state,api,action.actor),action.id.slice(action.actor.length+1))) return false;
      if (seinaMain && action.id === '162:skill') return state.seina!.extraBoundAt === null;
      if (action.id === '162:extra') return state.seina!.extraBoundAt !== null;
      if (action.id.startsWith('162:ultimate:')) return action.id.endsWith(state.seina!.form);
      if (action.id === '115:exit') return state.hotaru!.onField && state.hotaru!.stanceUntil > 0 && time(state) >= state.hotaru!.stanceUntil;
      if(action.id==='115:area') return state.hotaru!.onField && state.hotaru!.stanceUntil>time(state);
      if (action.id.startsWith('115:normal:')) return state.hotaru!.onField && time(state) < state.hotaru!.stanceUntil;
      return true;
    },
    onChargeConsumed(state,action,api){
      if(action.flag!==4)return;
      for(const [actor,listener] of Object.entries(supportAdapters))if(listener.partySkillChargeConsumed)
        state.supportScripts![actor]=listener.partySkillChargeConsumed(state.supportScripts![actor]!,supportApi(state,api,actor),action.actor);
    },
    onCast(state, action, api) {
      const ultimate = action.id.includes('ultimate');
      if (ultimate && hasTilia && action.actor === main) tilia.onMainUltimate(tiliaApi(state, api));
      if(ultimate && action.actor===main) proc(state,'main-ultimate',action.actor);
      if (hasTilia && action.actor === tiliaId) {
        tilia.enterField(tiliaApi(state, api));
        if (ultimate) tilia.castUltimate(tiliaApi(state, api));
      }
      if (ultimate && hasKasimira && action.actor !== kasimiraId) kasimiraShared.otherActorUltimate(kasimiraApi(state, api));
      if(ultimate) proc(state,'other-ultimate',action.actor,[],undefined,action.actor);
      const skill = action.flag===4;
      if(skill) proc(state,'party-skill-cast',action.actor);
      if(skill) for(const [actor,listener] of Object.entries(supportAdapters))if(listener.partySkillCast)
        state.supportScripts![actor]=listener.partySkillCast(state.supportScripts![actor]!,supportApi(state,api,actor),action.actor);
      if(skill) proc(state,'own-skill-cast',action.actor,[],action.actor);
      if(ultimate) proc(state,'own-ultimate-start',action.actor,[],action.actor);
      if(ultimate) proc(state,'own-ultimate-cast',action.actor,[],action.actor);
      if(ultimate) proc(state,'party-ultimate-cast',action.actor);
      if(ultimate) for(const [actor,listener] of Object.entries(supportAdapters))if(listener.partyUltimateCast)
        state.supportScripts![actor]=listener.partyUltimateCast(state.supportScripts![actor]!,supportApi(state,api,actor),action.actor);
      const adapter=supportAdapters[action.actor];
      if(adapter?.cast) state.supportScripts![action.actor]=adapter.cast(state.supportScripts![action.actor]!,supportApi(state,api,action.actor),action.id.slice(action.actor.length+1));
      if (skill || ultimate) state.records = records.cast(state.records!, buffApi(state), action.actor, ultimate ? 'ultimate' : 'skill');
      if (hasGray && (skill || ultimate)) state.gray = gray.cast(state.gray!, grayApi(state, api), action.actor, ultimate ? 'ultimate' : 'skill');
      raidAbilityCast(boss, action.actor === main && ultimate, main, buffApi(state));
      if(action.id==='162:super-normal'){
        buffApi(state).remove(main,16204011);
        if(contexts[main]!.potentials[516210]) state.seina={...state.seina!,form:'claymore'};
      }
      if (seinaMain && (action.id === '162:skill' || action.id === '162:extra' || action.id.startsWith('162:ultimate:'))) {
        state.seina = seina.cast(state.seina!, seinaApi(state, api), ultimate ? 'ultimate' : action.id.endsWith('extra') ? 'extra' : 'main', rapier!.activationEnd);
      } else if (action.id === '115:skill') state.hotaru = hotaru.castSkill(hotaru.enterField(state.hotaru!, hotaruApi(state, api)),hotaruApi(state,api));
      else if (action.id === '115:ultimate') state.hotaru = hotaru.ultimate(state.hotaru!, hotaruApi(state, api));
      else if (action.id === '115:exit') state.hotaru = { ...state.hotaru!, stanceUntil: 0 };
      else if (action.id === '107:skill') state.tilia = tilia.castSkill(state.tilia!);
      else if (action.id === '108:skill') state.kasimira = kasimira.cast(state.kasimira!, kasimiraApi(state, api));
    },
    onActionEnd(state, action, interrupted, api) {
      const adapter=supportAdapters[action.actor];
      if(adapter?.end) state.supportScripts![action.actor]=adapter.end(state.supportScripts![action.actor]!,supportApi(state,api,action.actor),action.id.slice(action.actor.length+1),interrupted);
      if (action.id === '115:skill') hotaru.onEntryEnd(hotaruApi(state, api));
      if(action.id==='115:skill') proc(state,'entry-end',action.actor,[],action.actor);
      if (action.id.startsWith('162:normal:')||action.id==='162:super-normal') state.script.lastNormalEnd = time(state);
      if (seinaMain && action.id === '162:skill') state.seina = seina.endMain(state.seina!, seinaApi(state, api));
      if (action.id.includes('ultimate')) state.records = records.end(state.records!, action.actor, 'ultimate');
      if(action.flag===4) proc(state,'own-skill-end',action.actor,[],action.actor);
      if(action.id.includes('ultimate')) proc(state,'own-ultimate-end',action.actor,[],action.actor);
      if (action.id === '115:skill' && !interrupted) {
        state.hotaru = hotaru.enterStance(state.hotaru!, hotaruApi(state, api));
        api.schedule({ kind: '115:round', actor: hotaruId, data: { generation: state.hotaru.stanceGeneration } }, 3);
      } else if (action.id === '115:ultimate') state.hotaru = hotaru.ultimateEnd(state.hotaru!, hotaruApi(state, api));
      else if (action.id === '115:exit') state.hotaru = hotaru.leave(state.hotaru!, hotaruApi(state, api));
      else if (action.id === '108:ultimate') kasimiraShared.ownUltimateEnd(kasimiraApi(state, api));
    },
    onEvent(state, event, api) {
      switch (event.kind) {
        case 'script-interrupt':api.interrupt(event.actor);break;
        case 'generated-area': {
          const child=spawnWeapon(state,api,event.actor,String(event.data!.name),undefined,0,false,'boss',{
            x:Number(event.data!.x),z:Number(event.data!.z),angle:Number(event.data!.angle)});
          const parent=event.weaponId!==undefined?state.weapons?.[event.weaponId]:undefined;
          if(event.data!.bind&&parent&&child!==undefined)state.weapons![event.weaponId!]={...parent,children:[...(parent.children ?? []),child]};
          break;
        }
        case 'directional-finish-area':spawnWeapon(state,api,event.actor,String(event.data!.name),undefined,0,false,'boss',{x:Number(event.data!.x),z:Number(event.data!.z)});break;
        case 'shield-change': {
          const data=event.data!,id=Number(data.id),owner=String(data.owner),source=String(data.source),added=Boolean(data.added);
          const tags=Object.entries(tables.shieldDefinitions[id] ?? {}).filter(([key])=>key.startsWith('ShieldTag')).map(([,value])=>Number(value));
          for(const [actor,adapter] of Object.entries(supportAdapters)) if(adapter.shieldChanged) state.supportScripts![actor]=adapter.shieldChanged(
            state.supportScripts![actor]!,supportApi(state,api,actor),{id,owner,source,tags},added);
          if(owner===main && tags.includes(combatTagHash('127_SupportSkill'))) proc(state,`main-own-support-shield-${added?'added':'removed'}`,source,[], '127');
          break;
        }
        case 'profile-tick': {
          if (hasGray) for (const buff of Object.values(state.buffs)) {
            if (buff.expires !== null && buff.expires <= time(state)) {
              const hitId = gray.naturalExpiryHit(buff.id);
              if (hitId) api.schedule({ kind: 'impact', actor: grayId, hitId }, 0);
            }
          }
          state.buffs = expireCombatBuffs(state.buffs, time(state));
          const previousShields=state.shields ?? {};
          state.shields=expireCombatShields(previousShields,time(state));
          for(const [key,shield] of Object.entries(previousShields)) if(!state.shields[key]) api.schedule({kind:'shield-change',actor:shield.source,
            data:{id:shield.id,owner:shield.owner,source:shield.source,added:0}},0);
          state.boss = tickRaidBoss(state.boss!, boss, time(state), buffApi(state));
          if(hasHotaru) state.hotaru=hotaru.tick(state.hotaru!,hotaruApi(state,api));
          for(const [actor,adapter] of Object.entries(supportAdapters)) if(adapter.tick) state.supportScripts![actor]=adapter.tick(state.supportScripts![actor]!,supportApi(state,api,actor));
          if(seinaMain) {
            const stackDefinition = getCombatValue(16202011, tables.buffDefinitions, tables.buffValues, contexts[main]!);
            state.seina = seina.tick(state.seina!, seinaApi(state, api), stackDefinition.LaminatedNum!, tables.skills[16231002].UseTimeHint / 10000);
          }
          api.schedule({ kind: 'profile-tick', actor: main }, 1 / fps);
          break;
        }
        case '162:regen':
          if (event.data!.generation === state.seina!.burstGeneration && buffApi(state).count(main, seina.burstBuff)) {
            api.directSp(main, parameter(main, 16243002) * 10000);
            api.schedule({ ...event, data: event.data }, parameter(main, 16243011));
          }
          break;
        case '115:round':
          if (event.data!.generation === state.hotaru!.stanceGeneration && time(state) < state.hotaru!.stanceUntil) {
            hotaruApi(state, api).flyingBatch(false);
            api.schedule({ kind: '115:round', actor: hotaruId, data: event.data }, 3);
          }
          break;
        case 'weapon-spawn':
          spawnWeapon(state, api, event.actor, String(event.data!.name), undefined, Number(event.data!.distance ?? options.distance));
          break;
        case '108:bomb-finish': kasimira.bulletFinished(kasimiraApi(state, api), true, 'Bullet108B2Skill'); break;
        case 'area-buff':
          if (event.data!.remove) buffApi(state).remove(String(event.data!.target ?? 'boss'), Number(event.data!.id));
          else buffApi(state).add(String(event.data!.target ?? 'boss'), Number(event.data!.id), event.actor);
          break;
        case 'area-exit-tracking': {
          const weapon=state.weapons![event.weaponId!]!,key=String(event.data!.key);
          const exit=weapon.exit.filter(change=>change.key!==key);
          if(event.data!.enter)exit.push({key,target:String(event.data!.target),
            add:String(event.data!.add).split(',').filter(Boolean).map(Number),remove:String(event.data!.remove).split(',').filter(Boolean).map(Number)});
          state.weapons![event.weaponId!]={...weapon,exit};
          break;
        }
        case 'impact': resolveHit(state, event, api); break;
        case '162:collect-sword':
          cancelWeapon(state,api,event.weaponId!);
          api.schedule({kind:'area-buff',actor:main,data:{id:16204011,target:main,remove:0}},.3);
          break;
        case 'weapon-lifetime-end': {
          const weapon=state.weapons![event.weaponId!]!,adapter=supportAdapters[event.actor];
          if(adapter?.weaponEnd)api.schedule({kind:'support-weapon-end',actor:event.actor,priority:0,data:{name:weapon.name,id:event.weaponId!}},0);
          for(const child of state.weapons?.[event.weaponId!]?.children ?? [])cancelWeapon(state,api,child);
          delete state.weapons![event.weaponId!];break;
        }
        case 'support-weapon-begin':
        case 'support-weapon-end': {
          const adapter=supportAdapters[event.actor],handler=event.kind==='support-weapon-begin'?adapter?.weaponBegin:adapter?.weaponEnd;
          if(handler)state.supportScripts![event.actor]=handler(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),String(event.data!.name),Number(event.data!.id));
          break;
        }
        case 'script-cast': api.cast(String(event.data!.action),true);break;
        case 'support-area-end': {
          if(seinaMain&&event.actor===main&&event.data!.name==='AreaEffect_162_LeiDianZhongJian_Hold'&&contexts[main]!.potentials[516209]){
            const x=Number(event.data!.x),z=Number(event.data!.z);
            supportApi(state,api,main).directionalProjectile('Bullet_162_P9_LeiDian',{x,z,dx:options.distance-x,dz:-z});
          }
          const adapter=supportAdapters[event.actor];
          if(adapter?.areaEnd) state.supportScripts![event.actor]=adapter.areaEnd(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),String(event.data!.name),{x:Number(event.data!.x ?? options.distance),z:Number(event.data!.z ?? 0),center:String(event.data!.center ?? 'boss')});
          break;
        }
        case 'support-projectile-end': {
          const adapter=supportAdapters[event.actor];
          if(adapter?.projectileEnd) state.supportScripts![event.actor]=adapter.projectileEnd(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),String(event.data!.name),String(event.data!.target),
            event.data!.x===undefined?undefined:{x:Number(event.data!.x),z:Number(event.data!.z)});
          break;
        }
        case 'drop-finish': {
          if(event.data!.id!==undefined){
            const id=Number(event.data!.id);
            if(!state.drops?.[id])break;
            delete state.drops[id];
          }
          const picked=Boolean(event.data!.picked);
          const countKey=`drop:${String(event.data!.name)}:${picked?'picked':'expired'}`;
          state.counts[countKey]=(state.counts[countKey] ?? 0)+1;
          if(picked&&event.data!.buff)buffApi(state).add(main,Number(event.data!.buff),event.actor);
          const adapter=supportAdapters[event.actor];
          if(adapter?.dropEnd)state.supportScripts![event.actor]=adapter.dropEnd(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),String(event.data!.name),picked);
          break;
        }
        case 'native-dot-start': {
          const buff=Number(event.data!.buff),period=Number(event.data!.period),duration=supportApi(state,api,event.actor).buffDuration!(buff);
          if(!buffApi(state).count('boss',buff))break;
          const definition=tables.hits[event.hitId!]!,hit=resolveCombatHit(definition,contexts[event.actor]!);
          const source=attributes(state,event.actor,hit.damageType),result=calculateResolvedCombatHit(definition,contexts[event.actor]!,source,attributes(state,'boss',hit.damageType),calculation);
          const damage=Math.max(1,Math.floor(result.base/Math.max(1,Math.ceil(duration/period))));
          for(let t=0;t<duration-1/fps;t+=period)api.schedule({kind:'native-dot-tick',actor:event.actor,data:{buff,damage,toughness:readCombatAttribute(source.attributes,43,tables.attributeLimits)}},t);
          break;
        }
        case 'native-dot-tick': {
          if(!buffApi(state).count('boss',Number(event.data!.buff)))break;
          const damage=Number(event.data!.damage);api.damage(damage);
          state.boss=damageRaidBoss(state.boss!,boss,damage,Number(event.data!.toughness),time(state),buffApi(state));
          break;
        }
        case 'support-script-event': {
          const adapter=supportAdapters[event.actor];
          if(adapter?.event) state.supportScripts![event.actor]=adapter.event(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),String(event.data!.name),event.data!);
          break;
        }
        case 'support-mark-triggered': {
          const element=Number(event.data!.element),tags=String(event.data!.tags ?? '').split(',').filter(Boolean).map(Number);
          if(event.data!.own) {
            const name=({1:'water',2:'fire',3:'earth',4:'wind',5:'light',6:'dark'} as Record<number,string>)[element]!;
            if(element===5){
              state.records=records.triggerLightMark(state.records!,buffApi(state),event.actor,event.actor==='162');
              if(hasTilia)state.tilia=tilia.lightMarkTriggered(state.tilia!,tiliaApi(state,api));
              if(hasHotaru)hotaru.onLightMarkTriggered(hotaruApi(state,api));
              if(event.actor===main)raidAbilityMark(boss,main,buffApi(state));
            }
            proc(state,`${name}-mark-triggered`,event.actor,tags);
            proc(state,`player-${name}-mark-triggered`,event.actor,tags);
            proc(state,`own-${name}-mark`,event.actor,tags,event.actor);
            proc(state,`own-${name}-mark-${Number(event.data!.variant ?? 1)}`,event.actor,tags,event.actor);
          }
          for(const [actor,adapter] of Object.entries(supportAdapters)) if(adapter.markTriggered) state.supportScripts![actor]=adapter.markTriggered(state.supportScripts![actor]!,supportApi(state,api,actor),element,tags,event.actor);
          break;
        }
        case '107:shield-contact': {
          const target = event.data!.target as 'main' | 'boss';
          state.tilia = tilia.shieldHit(state.tilia!, tiliaApi(state, api), target, state.boss!.hp / state.boss!.maxHp, true, Number(event.data!.rebounds ?? 0));
          if (target === 'boss') resolveHit(state, event, api);
          break;
        }
        case 'anticipation-end':
          {
            const adapter=supportAdapters[event.actor];
            if(adapter?.phase) state.supportScripts![event.actor]=adapter.phase(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),event.action!.slice(event.actor.length+1),'anticipation');
          }
          if (event.action?.startsWith('162:normal:')) state.script.normalStage = (Number(event.action.split(':')[2]) + 1) % 4;
          if (event.action?.startsWith('115:normal:')) state.hotaru = { ...state.hotaru!, stage: (Number(event.action.split(':')[2]) + 1) % 4 };
          break;
        case 'activation-end': {
          const adapter=supportAdapters[event.actor];
          if(adapter?.phase) state.supportScripts![event.actor]=adapter.phase(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),event.action!.slice(event.actor.length+1),'activation');
          break;
        }
        case 'combo': {
          if(event.data?.independentLease&&Number(state.script[`lease:${event.actor}:${event.data.independentLease}`] ?? 0)<=time(state))break;
          if(event.data?.independentEntity!==undefined&&!state.summons?.[`${event.actor}#${event.data.independentEntity}`]?.alive)break;
          const combo = event.comboEvent! as CombatTimelineEvent & { hitFlags?: number; hitFeatureData?: Record<string, any>; buffIds?: number[]; bulletPrefab?: { m_PathID: string }; areaEffectPrefab?:{m_PathID:string}; bulletCount?: number;shieldId?:number;toTeam?:boolean };
          if (combo.type === 1) resolveHit(state, { ...event, hitId: combo.hitDamageId, feature: combo.hitFeatureData, featureFlags: combo.hitFlags ?? 0 }, api);
          else if (combo.type === 0) {
            if (event.actor === main && seinaMain) seina.custom(seinaApi(state, api), combo.name,event.action);
            else if (event.actor === hotaruId) state.hotaru=hotaru.custom(state.hotaru!,hotaruApi(state, api), combo.name);
            else if (event.actor === tiliaId) tilia.custom(tiliaApi(state, api), combo.name);
            else if (hasGray&&event.actor === grayId) gray.custom(grayApi(state, api), combo.name);
            else if (event.actor === kasimiraId && combo.name === 'ShootStart') {
              const context = kasimiraApi(state, api), potentials = contexts[kasimiraId]!.potentials;
              const launches = planKasimiraSupportVolley(potentials, potentials[510829] ? parameter(kasimiraId, 10852901) : 0,
                potentials[510829] ? context.randomPercent() : 100);
              for (const launch of launches) api.schedule({ kind: 'weapon-spawn', actor: kasimiraId,
                data: { name: launch.projectile } }, launch.time);
            }
            const adapter=supportAdapters[event.actor];
            if(adapter?.custom) state.supportScripts![event.actor]=adapter.custom(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),combo.name,event.data);
          } else if (combo.type === 5) {
            // The event tag is an editor label (for example 重攻击), not
            // necessarily a resource alias. The serialized prefab is primary.
            const weapon=allWeapons.find(weapon=>weapon.pathId===combo.areaEffectPrefab?.m_PathID)
              ?? allWeapons.find(weapon=>weapon.name===combo.tag);
            if(!weapon) throw new Error(`Missing combo area ${combo.areaEffectPrefab?.m_PathID ?? combo.tag}`);
            const independent=event.data?.independentStarted!==undefined;
            const motion=independent?{combo:getCombo(Number(event.actor),event.data!.independentKeys?String(event.data!.independentKeys).split(',').map(Number):String(event.data!.independentTag),
              Number(event.data!.independentIndex ?? 0),Number(event.data!.independentSpeed ?? 1),String(event.data!.independentSource)||undefined),started:Number(event.data!.independentStarted)*fps}:state.motions[event.actor]!;
            const areaOptions=supportAdapters[event.actor]?.comboArea?.(weapon.name,motion.combo,
              (state.tick-motion.started)/fps,options.distance);
            spawnWeapon(state,api,event.actor,weapon.name,undefined,0,false,'boss',{...areaOptions,...(event.data?.independentEntity===undefined?{}:{entity:Number(event.data.independentEntity)})});
          }
          else if (combo.type === 2 && combo.bulletPrefab?.m_PathID !== '0') {
            const adapter=supportAdapters[event.actor];
            if(adapter?.shot)state.supportScripts![event.actor]=adapter.shot(state.supportScripts![event.actor]!,supportApi(state,api,event.actor),combo.reduceAmmoCount ?? 0);
            const weapon = allWeapons.find(weapon => weapon.pathId === combo.bulletPrefab?.m_PathID);
            if (!weapon) throw new Error(`Missing combo projectile ${combo.bulletPrefab?.m_PathID}`);
            for (let index = 0; index < Math.max(1, combo.bulletCount ?? 1); index++) spawnWeapon(state, api, event.actor, weapon.name,undefined,undefined,false,'boss',event.data?.independentEntity===undefined?{}:{entity:Number(event.data.independentEntity)});
          } else if (combo.type === 3) for (const id of combo.buffIds ?? []) buffApi(state).add(event.data?.independentEntity===undefined?event.actor:`${event.actor}#${event.data.independentEntity}`, id, event.actor);
          else if(combo.type===7 && combo.shieldId) for(const owner of combo.toTeam?party:[event.actor]) shield(state,combo.shieldId,owner,event.actor,api);
          if(event.data?.independentStarted===undefined&&(combo.type===20||combo.triggerFateCardTheme&&[0,1,2,5].includes(combo.type))){
            const flags={normal:Boolean(combo.normalAttackTriggerForFateCard),dodge:Boolean(combo.dodgeTriggerForFateCard),
              skill:Boolean(combo.skillTriggerForFateCard),ultimate:Boolean(combo.ultimateTriggerForFateCard)};
            if(Object.values(flags).some(Boolean))for(const [actor,listener] of Object.entries(supportAdapters))if(listener.gameplayTrigger)
              state.supportScripts![actor]=listener.gameplayTrigger(state.supportScripts![actor]!,supportApi(state,api,actor),flags);
          }
          break;
        }
        default: throw new Error(`Unrouted example event ${event.kind}`);
      }
    },
  };
  return { model: createCombatRuntime(scenario), build, boss, scenario, base, attributes, buffApi,
    rules: { seina, hotaru, tilia, kasimira, kasimiraShared, gray, records }, helpers: { parameter, getCombo, rapier }, contexts, calculation };
}
