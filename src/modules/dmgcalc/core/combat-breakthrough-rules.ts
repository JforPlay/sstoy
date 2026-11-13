import type { CombatProcRule,CombatProcContext } from './combat-procs';
import { combatTagHash } from './combat-tags';
const ultra108=combatTagHash('108_Ultra'), skill108=combatTagHash('108_Skill');
const fact=(context:CombatProcContext,key:string) => {
  const value=context.facts[key];
  if (value===undefined) throw new Error(`Missing proc fact ${context.actor}/${key}`);
  return value;
};

/** Only reviewed event/condition mappings belong here. Data existence is not
 * enough to synthesize a rule for another character by changing ID prefixes. */
export const kasimiraBreakthroughRules:readonly CombatProcRule[] = [
  {id:'108:lb1',event:'own-hit',breakthrough:1,when:c=>c.tags.includes(ultra108),probability:{parameter:10896111},
    effects:[{kind:'add-buff',id:10896111,recipient:'party'}]},
  {id:'108:lb2',event:'before-own-hit',breakthrough:2,when:c=>c.tags.includes(skill108) && c.buffs.count(c.target,1011)>0,
    effects:[{kind:'once',id:10896211}]},
  {id:'108:lb3',event:'own-hit',breakthrough:3,probability:{parameter:10896311},
    effects:[{kind:'add-buff',id:10896311,recipient:'party'}]},
  {id:'108:lb4',event:'own-hit',breakthrough:4,when:c=>c.tags.includes(skill108),cooldown:{parameter:10896411,zeroIsUnset:true},
    effects:[{kind:'add-buff',id:10896411}]},
  {id:'108:lb5:on',event:'other-ultimate',breakthrough:5,effects:[{kind:'add-buff',id:10896511}]},
  {id:'108:lb5:off',event:'own-ultimate-end',breakthrough:5,effects:[{kind:'remove-buff',id:10896511}]},
];

export const grayBreakthroughRules:readonly CombatProcRule[] = [
  {id:'149:lb1',event:'own-hit',breakthrough:1,when:c=>c.tags.includes(combatTagHash('149_Skill')),
    cooldown:{seconds:1},effects:[{kind:'add-buff',id:14996111}]},
  {id:'149:lb2',event:'own-earth-mark',breakthrough:2,effects:[{kind:'add-buff',id:14996211}]},
  {id:'149:lb3',event:'own-hit',breakthrough:3,when:c=>c.tags.includes(combatTagHash('149_Ultra')),effects:[{kind:'add-buff',id:14996311}]},
  {id:'149:lb4',event:'earth-buff-added',breakthrough:4,effects:[{kind:'add-buff',id:14996411}]},
  {id:'149:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:14996511}]},
];

export const tiliaBreakthroughRules:readonly CombatProcRule[] = [
  {id:'107:lb1',event:'marked-target-hit',breakthrough:1,effects:[{kind:'add-buff',id:10796111,recipient:'attacker'}]},
  {id:'107:lb2',event:'main-ultimate',breakthrough:2,effects:[{kind:'add-buff',id:10796211,recipient:'main'}]},
  {id:'107:lb3',event:'own-light-mark-applied',breakthrough:3,effects:[{kind:'add-buff',id:10796311,recipient:'party'}]},
  {id:'107:lb4',event:'light-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:10796411,recipient:'main'}]},
  {id:'107:lb5',event:'initialize',breakthrough:5,when:c=>Number(fact(c,'lightCount'))>=3,effects:[{kind:'add-buff',id:10796511,recipient:'party'}]},
];

export const hotaruBreakthroughRules:readonly CombatProcRule[] = [
  {id:'115:lb1',event:'light-mark-triggered',breakthrough:1,effects:[{kind:'add-buff',id:11596111,recipient:'target'}]},
  {id:'115:lb2',event:'entry-end',breakthrough:2,effects:[{kind:'add-buff',id:11596211}]},
  {id:'115:lb3',event:'own-hit',breakthrough:3,effects:[{kind:'add-buff',id:11596311,recipient:'target'}]},
  {id:'115:lb4',event:'player-light-buff',breakthrough:4,effects:[{kind:'add-buff',id:11596411}]},
  {id:'115:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:11596511}]},
];

/** Shared _10301/Parallel.cs hooks; exact tags are source strings, not names
 * guessed from the Korean description. Casting adapters emit these events. */
export const kohakuBreakthroughRules:readonly CombatProcRule[] = [
  {id:'103:lb1',event:'own-hit',breakthrough:1,effects:[{kind:'add-buff',id:10396111}]},
  {id:'103:lb2',event:'own-fire-mark-1',breakthrough:2,effects:[{kind:'add-buff',id:10396211}]},
  {id:'103:lb3',event:'own-skill-cast',breakthrough:3,effects:[{kind:'add-buff',id:10396311}]},
  {id:'103:lb4',event:'own-hit',breakthrough:4,when:c=>c.tags.includes(combatTagHash('Ultra')),effects:[{kind:'add-buff',id:10396411}]},
  {id:'103:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true && c.tags.includes(combatTagHash('Ultra')),
    effects:[{kind:'once',id:10396511}]},
];

/** _11001/Parallel.cs explicitly maintains fsEntitys. These avatar recipients
 * are mandatory facts, not all party members or arbitrary friendly summons. */
export const character110BreakthroughRules:readonly CombatProcRule[] = [
  {id:'110:lb1',event:'before-own-dark-mark',breakthrough:1,effects:[{kind:'add-buff',id:11096111},{kind:'add-buff',id:11096121,recipient:'group:avatars'}]},
  {id:'110:lb2',event:'own-avatar-spawned',breakthrough:2,effects:[{kind:'add-buff',id:11096211},{kind:'add-buff',id:11096221,recipient:'group:avatars'}]},
  {id:'110:lb3',event:'own-skill-cast',breakthrough:3,effects:[{kind:'add-buff',id:11096311},{kind:'add-buff',id:11096321,recipient:'group:avatars'}]},
  {id:'110:lb4',event:'monster-dark-buff-added',breakthrough:4,effects:[{kind:'add-buff',id:11096411}]},
  {id:'110:lb5',event:'initialize',breakthrough:5,when:c=>fact(c,'allDark')===true,effects:[{kind:'add-buff',id:11096511}]},
];

export const character111BreakthroughRules:readonly CombatProcRule[] = [
  {id:'111:lb1:on',event:'own-ultra-area-start',breakthrough:1,effects:[{kind:'add-buff',id:11196111,recipient:'party'}]},
  {id:'111:lb1:off',event:'own-ultra-area-end',breakthrough:1,when:c=>fact(c,'ultraAreaCount')===0,effects:[{kind:'remove-buff',id:11196111,recipient:'party'}]},
  {id:'111:lb2',event:'before-own-hit',breakthrough:2,when:c=>fact(c,'waterMark1')===true,effects:[{kind:'once',id:11196211}]},
  {id:'111:lb3',event:'own-hit',breakthrough:3,when:c=>c.tags.includes(combatTagHash('Skill')),probability:{parameter:11196311,inclusive:false},
    effects:[{kind:'add-buff',id:11196311,recipient:'party'}]},
  {id:'111:lb4',event:'water-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:11196411}]},
  {id:'111:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'boss')===false,effects:[{kind:'once',id:11196511}]},
];

export const character112BreakthroughRules:readonly CombatProcRule[] = [
  {id:'112:lb1',event:'own-hit',breakthrough:1,when:c=>c.tags.includes(combatTagHash('UltraAtk')) && !c.buffs.count(c.actor,11296111),
    effects:[{kind:'add-buff',id:11296111}]},
  {id:'112:lb2',event:'own-wind-mark-1',breakthrough:2,effects:[{kind:'add-buff',id:11296211}]},
  {id:'112:lb3',event:'own-hit',breakthrough:3,effects:[{kind:'add-buff',id:11296311}]},
  {id:'112:lb4',event:'own-killing-hit',breakthrough:4,effects:[{kind:'add-buff',id:11296411}]},
  {id:'112:lb5',event:'own-hit',breakthrough:5,when:c=>c.tags.includes(combatTagHash('NrmAtk')) && !c.buffs.count(c.actor,11296511),
    effects:[{kind:'add-buff',id:11296511}]},
];

export const character113BreakthroughRules:readonly CombatProcRule[] = [
  {id:'113:lb1',event:'own-ultimate-cast',breakthrough:1,effects:[{kind:'add-buff',id:11396111}]},
  {id:'113:lb2',event:'own-water-mark-1',breakthrough:2,effects:[{kind:'add-buff',id:11396211}]},
  {id:'113:lb3:on',event:'own-hit',breakthrough:3,when:c=>c.tags.some(tag=>[combatTagHash('MC'),combatTagHash('SS')].includes(tag)),effects:[{kind:'add-buff',id:11396311}]},
  {id:'113:lb3:off',event:'own-ultimate-end',breakthrough:3,effects:[{kind:'remove-buff',id:11396311}]},
  {id:'113:lb4',event:'own-hit',breakthrough:4,when:c=>c.tags.includes(combatTagHash('NA')),effects:[{kind:'add-buff',id:11396411}]},
  {id:'113:lb5',event:'own-killing-hit',breakthrough:5,effects:[{kind:'add-buff',id:11396511}]},
];

export const character114BreakthroughRules:readonly CombatProcRule[] = [
  {id:'114:lb1',event:'player-fire-buff-added',breakthrough:1,effects:[{kind:'add-buff',id:11496111}]},
  {id:'114:lb2',event:'own-crit',breakthrough:2,effects:[{kind:'add-buff',id:11496211}]},
  {id:'114:lb3',event:'own-skill-cast',breakthrough:3,effects:[{kind:'add-buff',id:11496311}]},
  {id:'114:lb4',event:'before-own-hit',breakthrough:4,when:c=>c.tags.includes(combatTagHash('Ultra')) && c.buffs.count(c.actor,11440003)>0,effects:[{kind:'once',id:11496411}]},
  {id:'114:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:11496511}]},
];

export const character116BreakthroughRules:readonly CombatProcRule[] = [
  {id:'116:lb1',event:'own-hit',breakthrough:1,when:c=>c.tags.includes(combatTagHash('116_SP')),effects:[{kind:'add-buff',id:11696111,recipient:'party'}]},
  {id:'116:lb2',event:'earth-mark-triggered',breakthrough:2,effects:[{kind:'add-buff',id:11696211}]},
  {id:'116:lb3',event:'party-hit',breakthrough:3,when:c=>fact(c,'slot')===4,every:20,effects:[{kind:'add-buff',id:11696311,recipient:'party'}]},
  {id:'116:lb4',event:'before-own-hit',breakthrough:4,when:c=>fact(c,'earthMark1')===true,effects:[{kind:'once',id:11696411}]},
  {id:'116:lb5',event:'own-hit',breakthrough:5,when:c=>c.tags.includes(combatTagHash('116_SP')),effects:[{kind:'add-buff',id:11696511}]},
];

export const character117BreakthroughRules:readonly CombatProcRule[] = [
  {id:'117:lb1:on',event:'own-ultra-projectile-spawned',breakthrough:1,effects:[{kind:'add-buff',id:11796111,recipient:'party'}]},
  {id:'117:lb1:off',event:'own-ultra-projectile-finished',breakthrough:1,effects:[{kind:'remove-buff',id:11796111,recipient:'party'}]},
  {id:'117:lb2',event:'before-own-hit',breakthrough:2,when:c=>fact(c,'lightMark1')===true && c.tags.includes(combatTagHash('117_Ultra_Hit')),effects:[{kind:'once',id:11796211}]},
  {id:'117:lb3',event:'own-hit',breakthrough:3,when:c=>c.tags.includes(combatTagHash('117_Ultra_Hit')),effects:[{kind:'add-buff',id:11796311,recipient:'target'}]},
  {id:'117:lb4',event:'light-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:11796411}]},
  {id:'117:lb5:on',event:'own-killing-hit',breakthrough:5,effects:[{kind:'add-buff',id:11796511}]},
  {id:'117:lb5:off',event:'own-ultra-projectile-finished',breakthrough:5,effects:[{kind:'remove-buff',id:11796511}]},
];

export const character118BreakthroughRules:readonly CombatProcRule[] = [
  {id:'118:lb1',event:'dark-mark-triggered',breakthrough:1,effects:[{kind:'add-buff',id:11896111,recipient:'party'}]},
  {id:'118:lb2:single',event:'before-own-hit',breakthrough:2,when:c=>c.tags.some(tag=>[combatTagHash('118_Sup_Atk'),combatTagHash('118_Main_Atk')].includes(tag)) && Number(fact(c,'hitTargetCount'))<=1,
    effects:[{kind:'once',id:11896221}]},
  {id:'118:lb2:multi',event:'before-own-hit',breakthrough:2,when:c=>c.tags.some(tag=>[combatTagHash('118_Sup_Atk'),combatTagHash('118_Main_Atk')].includes(tag)) && Number(fact(c,'hitTargetCount'))>1,
    effects:[{kind:'once',id:11896211}]},
  {id:'118:lb3',event:'own-ultimate-cast',breakthrough:3,effects:[{kind:'add-buff',id:11896311,recipient:'party'}]},
  {id:'118:lb4',event:'dark-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:11896411}]},
  {id:'118:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:11896511}]},
];

export const character119BreakthroughRules:readonly CombatProcRule[] = [
  {id:'119:lb1:on',event:'own-summon-event',breakthrough:1,effects:[{kind:'add-buff',id:11996111}]},
  {id:'119:lb1:off',event:'own-summon-died',breakthrough:1,when:c=>fact(c,'remainingOwnedSummons')===0,effects:[{kind:'remove-buff',id:11996111}]},
  {id:'119:lb2',event:'own-wind-mark-2',breakthrough:2,effects:[{kind:'add-buff',id:11996211}]},
  {id:'119:lb3:skill',event:'own-skill-cast',breakthrough:3,effects:[{kind:'add-buff',id:11996311}]},
  {id:'119:lb3:ult',event:'own-ultimate-cast',breakthrough:3,effects:[{kind:'add-buff',id:11996311}]},
  {id:'119:lb4',event:'before-own-settlement',breakthrough:4,when:c=>c.tags.includes(combatTagHash('119NrmAtk')),effects:[{kind:'add-buff',id:11996411}]},
  {id:'119:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:11996511}]},
];

export const character120BreakthroughRules:readonly CombatProcRule[] = [
  {id:'120:lb1',event:'before-party-hit',breakthrough:1,when:c=>Number(fact(c,'huaWeaponCount'))>0,effects:[{kind:'once',id:12096111}]},
  {id:'120:lb2',event:'own-killing-hit',breakthrough:2,effects:[{kind:'add-buff',id:12096211}]},
  {id:'120:lb3',event:'before-own-hit',breakthrough:3,when:c=>c.tags.includes(combatTagHash('120_UltraHitTag')),
    uniqueBy:'target',resetOn:'own-ultimate-cast',effects:[{kind:'add-buff',id:12096311,recipient:'party'}]},
  {id:'120:lb4',event:'wind-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:12096411}]},
  {id:'120:lb5',event:'before-party-hit',breakthrough:5,when:c=>fact(c,'boss')===false,effects:[{kind:'once',id:12096511}]},
];

export const character123BreakthroughRules:readonly CombatProcRule[] = [
  {id:'123:lb1',event:'own-hit',breakthrough:1,when:c=>c.tags.includes(combatTagHash('123NrmUltraBoom')) && !c.buffs.count(c.actor,12396111),effects:[{kind:'add-buff',id:12396111,recipient:'party'}]},
  {id:'123:lb2',event:'own-wind-mark-1-applied',breakthrough:2,effects:[{kind:'add-buff',id:12396211,recipient:'party'}]},
  {id:'123:lb3',event:'own-ultimate-clear-bullets',breakthrough:3,when:c=>Number(fact(c,'blockedBulletCount'))>0,effects:[{kind:'add-buff',id:12396311,recipient:'main'}]},
  {id:'123:lb4',event:'wind-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:12396411,recipient:'main'}]},
  {id:'123:lb5',event:'initialize',breakthrough:5,when:c=>Number(fact(c,'windCount'))>=3,effects:[{kind:'add-buff',id:12396511,recipient:'party'}]},
];

export const character125BreakthroughRules:readonly CombatProcRule[] = [
  {id:'125:lb1',event:'own-hit',breakthrough:1,when:c=>c.tags.includes(combatTagHash('Ultra_Catch')),effects:[{kind:'add-buff',id:12596111,recipient:'target'}]},
  {id:'125:lb2',event:'own-hit',breakthrough:2,when:c=>fact(c,'coldOrFrozen')===true,effects:[{kind:'add-buff',id:12596211}]},
  {id:'125:lb3',event:'own-hit',breakthrough:3,when:c=>c.tags.includes(combatTagHash('125_Skill')),effects:[{kind:'add-buff',id:12596311,recipient:'target'}]},
  {id:'125:lb4:on',event:'own-berserk-enter',breakthrough:4,effects:[{kind:'add-buff',id:12596411}]},
  {id:'125:lb4:off',event:'own-berserk-exit',breakthrough:4,effects:[{kind:'remove-buff',id:12596411}]},
  {id:'125:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:12596511}]},
];

export const character126BreakthroughRules:readonly CombatProcRule[] = [
  {id:'126:lb1',event:'before-party-settlement',breakthrough:1,when:c=>fact(c,'fireMark')===true,effects:[{kind:'add-buff',id:12696111,recipient:'attacker'}]},
  {id:'126:lb2',event:'before-party-hit',breakthrough:2,when:c=>c.attacker===c.main && Number(fact(c,'mainHpFraction'))>=0.5,effects:[{kind:'once',id:12696211,source:'main'}]},
  {id:'126:lb3',event:'own-fire-mark-1-applied',breakthrough:3,effects:[{kind:'add-buff',id:12696311,recipient:'party'}]},
  {id:'126:lb4',event:'fire-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:12696411,recipient:'main'}]},
  {id:'126:lb5',event:'initialize',breakthrough:5,when:c=>fact(c,'allFire')===true,effects:[{kind:'add-buff',id:12696511,recipient:'party'}]},
];

export const character127BreakthroughRules:readonly CombatProcRule[] = [
  {id:'127:lb1:own',event:'before-own-hit',breakthrough:1,when:c=>fact(c,'waterMark1OrColdOrFrozen')===true,effects:[{kind:'once',id:12796111}]},
  {id:'127:lb1:other',event:'before-other-party-hit',breakthrough:1,when:c=>fact(c,'waterMark1OrColdOrFrozen')===true,effects:[{kind:'once',id:12796111,source:'attacker'}]},
  {id:'127:lb2:on',event:'main-own-support-shield-added',breakthrough:2,effects:[{kind:'add-buff',id:12796211,recipient:'main'}]},
  {id:'127:lb2:off',event:'main-own-support-shield-removed',breakthrough:2,effects:[{kind:'remove-buff',id:12796211,recipient:'main'}]},
  {id:'127:lb3',event:'own-hit',breakthrough:3,when:c=>c.tags.includes(combatTagHash('WaterTag1')),effects:[{kind:'add-buff',id:12796311,recipient:'party'}]},
  {id:'127:lb4',event:'water-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:12796411,recipient:'main'}]},
  {id:'127:lb5',event:'initialize',breakthrough:5,when:c=>fact(c,'allWater')===true,effects:[{kind:'add-buff',id:12796511,recipient:'party'}]},
];

export const character130BreakthroughRules:readonly CombatProcRule[] = [
  {id:'130:lb1',event:'player-water-mark-triggered',breakthrough:1,effects:[{kind:'add-buff',id:13096111,recipient:'target'}]},
  {id:'130:lb2',event:'own-skill-cast',breakthrough:2,effects:[{kind:'add-buff',id:13096211}]},
  {id:'130:lb3',event:'own-hit',breakthrough:3,when:c=>fact(c,'damageType')===2,effects:[{kind:'add-buff',id:13096311,recipient:'target'}]},
  {id:'130:lb4',event:'player-water-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:13096411}]},
  {id:'130:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:13096511}]},
];

export const character132BreakthroughRules:readonly CombatProcRule[] = [
  {id:'132:lb1',event:'light-mark-triggered',breakthrough:1,effects:[{kind:'add-buff',id:13296111,recipient:'target'}]},
  {id:'132:lb2',event:'own-ultimate-start',breakthrough:2,effects:[{kind:'add-buff',id:13296211}]},
  {id:'132:lb3',event:'own-hit',breakthrough:3,when:c=>c.tags.includes(combatTagHash('132_Ultra')),effects:[{kind:'add-buff',id:13296311,recipient:'target'}]},
  {id:'132:lb4',event:'party-skill-cast',breakthrough:4,effects:[{kind:'add-buff',id:13296411}]},
  {id:'132:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:13296511}]},
];

export const character134BreakthroughRules:readonly CombatProcRule[] = [
  {id:'134:lb1',event:'own-fire-mark-2',breakthrough:1,effects:[{kind:'add-buff',id:13496111}]},
  {id:'134:lb2:on',event:'own-skill-end',breakthrough:2,effects:[{kind:'add-buff',id:13496211}]},
  {id:'134:lb2:off',event:'own-ultimate-end',breakthrough:2,effects:[{kind:'remove-buff',id:13496211}]},
  {id:'134:lb3',event:'own-ultimate-start',breakthrough:3,effects:[{kind:'add-buff',id:13496311}]},
  {id:'134:lb4',event:'monster-fire-buff-added',breakthrough:4,effects:[{kind:'add-buff',id:13496411}]},
  {id:'134:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:13496511}]},
];

export const character139BreakthroughRules:readonly CombatProcRule[] = [
  {id:'139:lb1:skill',event:'before-own-hit',breakthrough:1,when:c=>fact(c,'damageType')===2,effects:[{kind:'once',id:13996111}]},
  {id:'139:lb1:stage',event:'before-own-hit',breakthrough:1,when:c=>fact(c,'firstStageUltraBuff')===true,effects:[{kind:'once',id:13996121}]},
  {id:'139:lb2:first',event:'own-ultimate-first-stage-start',breakthrough:2,effects:[{kind:'add-buff',id:13996221}]},
  {id:'139:lb2:second',event:'own-ultimate-second-stage-start',breakthrough:2,effects:[{kind:'add-buff',id:13996211}]},
  {id:'139:lb3',event:'player-water-buff-added-to-monster',breakthrough:3,effects:[{kind:'add-buff',id:13996311}]},
  {id:'139:lb4:cast',event:'own-ultimate-cast',breakthrough:4,effects:[{kind:'add-buff',id:13996411}]},
  {id:'139:lb4:mark',event:'before-own-water-mark-2',breakthrough:4,effects:[{kind:'add-buff',id:13996411}]},
  {id:'139:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:13996511}]},
];

export const character140BreakthroughRules:readonly CombatProcRule[] = [
  {id:'140:lb1',event:'own-earth-mark',breakthrough:1,effects:[{kind:'add-buff',id:14096111}]},
  {id:'140:lb2',event:'own-hit',breakthrough:2,effects:[{kind:'add-buff',id:14096211}]},
  {id:'140:lb3',event:'own-skill-cast',breakthrough:3,effects:[{kind:'add-buff',id:14096311}]},
  {id:'140:lb4',event:'player-earth-buff-added',breakthrough:4,effects:[{kind:'add-buff',id:14096411}]},
  {id:'140:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:14096511}]},
];

export const character141BreakthroughRules:readonly CombatProcRule[] = [
  {id:'141:lb1',event:'before-player-or-minion-hit',breakthrough:1,when:c=>fact(c,'fireMark')===true,effects:[{kind:'once',id:14196111}]},
  {id:'141:lb2',event:'before-own-hit',breakthrough:2,when:c=>c.tags.includes(combatTagHash('141_Ultra_Hurt')),effects:[{kind:'once',id:14196211}]},
  {id:'141:lb3',event:'own-ultimate-start',breakthrough:3,effects:[{kind:'add-buff',id:14196311,recipient:'group:friends'}]},
  {id:'141:lb4',event:'fire-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:14196411},{kind:'add-buff',id:14196411,recipient:'group:owned-minions'}]},
  {id:'141:lb5',event:'before-own-or-minion-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:14196511}]},
];

export const character142BreakthroughRules:readonly CombatProcRule[] = [
  {id:'142:lb1',event:'own-skill-cast',breakthrough:1,effects:[{kind:'add-buff',id:14296111,recipient:'party'}]},
  {id:'142:lb2',event:'own-ultimate-cast',breakthrough:2,effects:[{kind:'add-buff',id:14296211,recipient:'main'}]},
  {id:'142:lb3',event:'player-dark-mark-1-applied',breakthrough:3,effects:[{kind:'add-buff',id:14296311,recipient:'party'}]},
  {id:'142:lb4',event:'own-hit',breakthrough:4,probability:{percent:25,inclusive:false},effects:[{kind:'add-buff',id:14296411,recipient:'main'}]},
  {id:'142:lb5',event:'initialize',breakthrough:5,when:c=>fact(c,'allDark')===true,effects:[{kind:'add-buff',id:14296511,recipient:'party'}]},
];

export const character143BreakthroughRules:readonly CombatProcRule[] = [
  {id:'143:lb1',event:'own-wind-mark',breakthrough:1,effects:[{kind:'add-buff',id:14396111}]},
  {id:'143:lb2',event:'own-hit',breakthrough:2,when:c=>fact(c,'damageType')===2,effects:[{kind:'add-buff',id:14396211}]},
  {id:'143:lb3',event:'player-or-summon-wind-buff-added-to-monster',breakthrough:3,effects:[{kind:'add-buff',id:14396311}]},
  {id:'143:lb4',event:'own-hit',breakthrough:4,when:c=>fact(c,'damageType')===1,effects:[{kind:'add-buff',id:14396411}]},
  {id:'143:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'element')===4 && fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:14396511}]},
];

export const character144BreakthroughRules:readonly CombatProcRule[] = [
  {id:'144:lb1',event:'own-ultimate-end',breakthrough:1,effects:[{kind:'add-buff',id:14496111}]},
  {id:'144:lb2',event:'own-water-mark-1',breakthrough:2,effects:[{kind:'add-buff',id:14496211}]},
  {id:'144:lb3',event:'own-hit',breakthrough:3,when:c=>c.tags.includes(combatTagHash('144_B2_Shadow')),effects:[{kind:'add-buff',id:14496311}]},
  {id:'144:lb4:on',event:'own-water-mark-1',breakthrough:4,effects:[{kind:'add-buff',id:14496411}]},
  {id:'144:lb4:off',event:'own-ultimate-end',breakthrough:4,effects:[{kind:'remove-buff',id:14496411}]},
  {id:'144:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:14496511}]},
];

export const character145BreakthroughRules:readonly CombatProcRule[] = [
  {id:'145:lb1',event:'own-hit',breakthrough:1,when:c=>fact(c,'damageType')===2,effects:[{kind:'add-buff',id:14596111,recipient:'target'}]},
  {id:'145:lb2',event:'party-ultimate-cast',breakthrough:2,effects:[{kind:'add-buff',id:14596211}]},
  {id:'145:lb3',event:'own-hit',breakthrough:3,when:c=>fact(c,'damageType')===3,effects:[{kind:'add-buff',id:14596311,recipient:'group:dark-players'}]},
  {id:'145:lb4',event:'dark-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:14596411}]},
  {id:'145:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:14596511}]},
];

export const character133BreakthroughRules:readonly CombatProcRule[] = [
  {id:'133:lb1:on',event:'qualified-ultra-tornado-spawned',breakthrough:1,when:c=>fact(c,'ultraTornadoCount')===1,effects:[{kind:'add-buff',id:13396111,recipient:'party'}]},
  {id:'133:lb1:off',event:'qualified-ultra-tornado-finished',breakthrough:1,when:c=>fact(c,'ultraTornadoCount')===0,effects:[{kind:'remove-buff',id:13396111,recipient:'party'}]},
  {id:'133:lb2:count',event:'own-hit',breakthrough:2,when:c=>c.tags.includes(combatTagHash('133_TalentSkill')),counters:[{key:'133:skill-hits',add:1}],effects:[]},
  {id:'133:lb2:cast',event:'own-skill-cast',breakthrough:2,when:(c,s)=>c.time>0 && (s.counters['133:skill-hits'] ?? 0)>=c.parameter(13396212),
    cooldown:{parameter:13396211},counters:[{key:'133:skill-hits',set:0}],effects:[{kind:'add-buff',id:13396211}]},
  {id:'133:lb3',event:'own-hit',breakthrough:3,when:c=>c.tags.includes(combatTagHash('133_TalentSkill')),effects:[{kind:'add-buff',id:13396311,recipient:'target'}]},
  {id:'133:lb4',event:'wind-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:13396411}]},
  {id:'133:lb5',event:'before-own-hit',breakthrough:5,when:c=>c.tags.includes(combatTagHash('133Hit')) && fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:13396511}]},
];

export const character135BreakthroughRules:readonly CombatProcRule[] = [
  {id:'135:lb1',event:'qualified-summon-spawned',breakthrough:1,effects:[{kind:'add-buff',id:13596111,recipient:'group:friends'}]},
  {id:'135:lb2',event:'qualified-summon-spawned',breakthrough:2,effects:[{kind:'add-buff',id:13596211,recipient:'target'}]},
  {id:'135:lb3',event:'qualified-summon-died',breakthrough:3,effects:[{kind:'add-buff',id:13596311,recipient:'group:friends'}]},
  {id:'135:lb4',event:'qualified-summon-attack',breakthrough:4,effects:[{kind:'add-buff',id:13596411},{kind:'add-buff',id:13596411,recipient:'attacker'}]},
  {id:'135:lb5:buff',event:'qualified-summon-spawned',breakthrough:5,when:c=>c.buffs.count(c.actor,13596521)>0,effects:[{kind:'add-buff',id:13596511,recipient:'target'}]},
  {id:'135:lb5:count',event:'qualified-summon-spawned',breakthrough:5,when:c=>!c.buffs.count(c.actor,13596521),counters:[{key:'135:summons',add:1}],effects:[]},
  {id:'135:lb5:mark',event:'qualified-summon-spawned',breakthrough:5,when:(_c,s)=>(s.counters['135:summons'] ?? 0)>=5,
    cooldown:{parameter:13596511,zeroIsUnset:true},counters:[{key:'135:summons',set:0}],effects:[{kind:'add-buff',id:13596521}]},
];

export const character147BreakthroughRules:readonly CombatProcRule[] = [
  {id:'147:lb1',event:'own-dark-mark',breakthrough:1,effects:[{kind:'add-buff',id:14796111}]},
  {id:'147:lb2',event:'own-ultimate-end',breakthrough:2,effects:[{kind:'add-buff',id:14796211}]},
  {id:'147:lb3:on',event:'own-killing-hit',breakthrough:3,effects:[{kind:'add-buff',id:14796311}]},
  {id:'147:lb3:off',event:'own-ultimate-end',breakthrough:3,effects:[{kind:'remove-buff',id:14796311}]},
  {id:'147:lb4',event:'own-hit',breakthrough:4,when:c=>c.tags.some(tag=>[combatTagHash('147NrmAtk'),combatTagHash('147NrmAtkP1')].includes(tag)),effects:[{kind:'add-buff',id:14796411}]},
  {id:'147:lb5',event:'own-skill-end',breakthrough:5,effects:[{kind:'add-buff',id:14796511}]},
];

export const character150BreakthroughRules:readonly CombatProcRule[] = [
  {id:'150:lb1',event:'own-hit',breakthrough:1,effects:[{kind:'add-buff',id:15096111}]},
  {id:'150:lb2',event:'own-light-mark-1',breakthrough:2,effects:[{kind:'add-buff',id:15096211}]},
  {id:'150:lb3',event:'own-ultimate-start',breakthrough:3,effects:[{kind:'add-buff',id:15096311}]},
  {id:'150:lb4',event:'player-light-buff',breakthrough:4,effects:[{kind:'add-buff',id:15096411}]},
  {id:'150:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:15096511}]},
];

export const character155BreakthroughRules:readonly CombatProcRule[] = [
  {id:'155:lb1',event:'own-hit',breakthrough:1,when:c=>c.tags.includes(combatTagHash('155_Ultra')),effects:[{kind:'add-buff',id:15596111}]},
  {id:'155:lb2',event:'before-own-hit',breakthrough:2,when:c=>c.tags.includes(combatTagHash('155_Ultra')) && fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:15596211}]},
  {id:'155:lb3',event:'own-light-mark',breakthrough:3,effects:[{kind:'add-buff',id:15596311}]},
  {id:'155:lb4:on',event:'own-hit',breakthrough:4,when:c=>fact(c,'slot')===2,effects:[{kind:'add-buff',id:15596411}]},
  {id:'155:lb4:off',event:'own-ultimate-end',breakthrough:4,effects:[{kind:'remove-buff',id:15596411}]},
  {id:'155:lb5',event:'player-light-buff',breakthrough:5,effects:[{kind:'add-buff',id:15596511}]},
];

export const character156BreakthroughRules:readonly CombatProcRule[] = [
  {id:'156:lb5:initial',event:'initialize',breakthrough:5,when:c=>fact(c,'allEarth')===true,effects:[{kind:'add-buff',id:15696511,recipient:'group:friends'}]},
  {id:'156:lb1',event:'earth-mark-triggered',breakthrough:1,effects:[{kind:'add-buff',id:15696111,recipient:'group:friends'}]},
  {id:'156:lb2:hit',event:'own-hit',breakthrough:2,when:c=>c.tags.includes(combatTagHash('156UltraAtk')),effects:[{kind:'add-buff',id:15696211,recipient:'target'}]},
  {id:'156:lb2:once',event:'before-party-hit',breakthrough:2,when:c=>c.attacker===c.main && c.buffs.count(c.target,15696211)>0,effects:[{kind:'once',id:15696211}]},
  {id:'156:lb3',event:'own-earth-mark-1-applied',breakthrough:3,effects:[{kind:'add-buff',id:15696311,recipient:'target'}]},
  {id:'156:lb4',event:'own-hit',breakthrough:4,when:c=>c.tags.includes(combatTagHash('SkillType')),effects:[{kind:'add-buff',id:15696411,recipient:'main'}]},
  {id:'156:lb5',event:'player-minion-spawned',breakthrough:5,when:c=>fact(c,'allEarth')===true,effects:[{kind:'add-buff',id:15696511,recipient:'target'}]},
];

export const character157BreakthroughRules:readonly CombatProcRule[] = [
  {id:'157:lb1',event:'player-dark-buff-added-to-monster',breakthrough:1,effects:[{kind:'add-buff',id:15796111}]},
  {id:'157:lb2',event:'own-hit',breakthrough:2,when:c=>[1,3].includes(Number(fact(c,'damageType'))),effects:[{kind:'add-buff',id:15796211}]},
  {id:'157:lb3',event:'own-dark-mark',breakthrough:3,effects:[{kind:'add-buff',id:15796311}]},
  {id:'157:lb4',event:'own-ultimate-end',breakthrough:4,effects:[{kind:'add-buff',id:15796411}]},
  {id:'157:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:15796511}]},
];

export const character158BreakthroughRules:readonly CombatProcRule[] = [
  {id:'158:lb1:on',event:'owned-minion-count-changed',breakthrough:1,when:c=>Number(fact(c,'ownedMinionCount'))>0,effects:[{kind:'add-buff',id:15896111,recipient:'group:fire-players'}]},
  {id:'158:lb1:off',event:'owned-minion-count-changed',breakthrough:1,when:c=>fact(c,'ownedMinionCount')===0,effects:[{kind:'remove-buff',id:15896111,recipient:'group:fire-players'}]},
  {id:'158:lb2',event:'fire-mark-triggered',breakthrough:2,effects:[{kind:'add-buff',id:15896211},{kind:'add-buff',id:15896221,recipient:'group:owned-minions'}]},
  // Native numbering intentionally differs: talent three uses OnceId 15896511.
  {id:'158:lb3',event:'before-own-or-minion-hit',breakthrough:3,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:15896511}]},
  {id:'158:lb4:on',event:'own-shield-state-changed',breakthrough:4,when:c=>fact(c,'hasShield')===true,effects:[{kind:'add-buff',id:15896411},{kind:'add-buff',id:15896411,recipient:'group:owned-minions'}]},
  {id:'158:lb4:off',event:'own-shield-state-changed',breakthrough:4,when:c=>fact(c,'hasShield')===false,effects:[{kind:'remove-buff',id:15896411},{kind:'remove-buff',id:15896411,recipient:'group:owned-minions'}]},
  {id:'158:lb5',event:'own-transform-skill-created',breakthrough:5,effects:[{kind:'add-buff',id:15896311,recipient:'group:fire-players'}]},
];

export const character159BreakthroughRules:readonly CombatProcRule[] = [
  {id:'159:lb1',event:'own-hit',breakthrough:1,when:c=>fact(c,'damageType')===2,effects:[{kind:'add-buff',id:15996111,recipient:'target'}]},
  {id:'159:lb2:on',event:'player-earth-buff-added',breakthrough:2,effects:[{kind:'add-buff',id:15996211}]},
  {id:'159:lb2:once',event:'before-party-hit',breakthrough:2,when:c=>c.buffs.count(c.actor,15996211)>0,effects:[{kind:'once',id:15996211}]},
  {id:'159:lb3',event:'own-hit',breakthrough:3,when:c=>fact(c,'damageType')===3,effects:[{kind:'add-buff',id:15996311,recipient:'target'}]},
  {id:'159:lb4',event:'own-skill-cast',breakthrough:4,effects:[{kind:'add-buff',id:15996411}]},
  {id:'159:lb5',event:'before-party-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:15996511}]},
];

export const character160BreakthroughRules:readonly CombatProcRule[] = [
  {id:'160:lb1',event:'own-water-mark-1-applied',breakthrough:1,effects:[{kind:'add-buff',id:16096111,recipient:'party'}]},
  {id:'160:lb2',event:'player-water-mark-triggered',breakthrough:2,effects:[{kind:'add-buff',id:16096211,recipient:'target'}]},
  {id:'160:lb3',event:'party-hit',breakthrough:3,when:c=>fact(c,'waterMark')===true,effects:[{kind:'add-buff',id:16096311,recipient:'attacker'}]},
  {id:'160:lb4:on',event:'own-onfield-talent-tick',breakthrough:4,effects:[{kind:'add-buff',id:16096411,recipient:'main'}]},
  {id:'160:lb4:off',event:'own-leave-field',breakthrough:4,effects:[{kind:'remove-buff',id:16096411,recipient:'main'}]},
  {id:'160:lb5',event:'own-hit',breakthrough:5,when:c=>fact(c,'damageType')===2,effects:[{kind:'add-buff',id:16096511,recipient:'target'}]},
];

/** 11/13 client ParallelScript: note the legacy m2/m4 field names do not
 * match their final talent levels. Keep the actual initialized buff IDs. */
export const character161BreakthroughRules:readonly CombatProcRule[] = [
  {id:'161:lb1',event:'player-earth-buff-added',breakthrough:1,effects:[{kind:'add-buff',id:16196111,recipient:'target'}]},
  {id:'161:lb2',event:'own-hit',breakthrough:2,when:c=>fact(c,'damageType')===1,effects:[{kind:'add-buff',id:16196212}]},
  {id:'161:lb3',event:'own-skill-cast',breakthrough:3,effects:[{kind:'add-buff',id:16196311,recipient:'group:earth-players'}]},
  {id:'161:lb4:party',event:'earth-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:16196211,recipient:'party'}]},
  {id:'161:lb4:self',event:'earth-mark-triggered',breakthrough:4,effects:[{kind:'add-buff',id:16196411}]},
  {id:'161:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'damageType')===1&&fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:16196511}]},
];

export const character137BreakthroughRules:readonly CombatProcRule[] = [
  {id:'137:lb1',event:'own-hit',breakthrough:1,when:c=>c.tags.some(tag=>[combatTagHash('137NrmAtk'),combatTagHash('137UAVAllAtk')].includes(tag)),effects:[{kind:'add-buff',id:13796111,recipient:'target'}]},
  {id:'137:lb2',event:'player-wind-mark-triggered',breakthrough:2,effects:[{kind:'add-buff',id:13796211}]},
  {id:'137:lb3',event:'player-wind-buff-added',breakthrough:3,effects:[{kind:'add-buff',id:13796311,recipient:'group:wind-players'}]},
  {id:'137:lb4',event:'own-skill-cast',breakthrough:4,effects:[{kind:'add-buff',id:13796411}]},
  {id:'137:lb5',event:'before-own-hit',breakthrough:5,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:13796511}]},
];

export const character162BreakthroughRules:readonly CombatProcRule[] = [
  {id:'162:lb1:once',event:'before-own-hit',breakthrough:1,when:c=>fact(c,'burstUltraBuff')===true,effects:[{kind:'once',id:16296111}]},
  {id:'162:lb1:burst',event:'own-hit',breakthrough:1,when:c=>!c.buffs.count(c.actor,16296111) && fact(c,'burstPotential43')===false,
    effects:[{kind:'add-buff',id:16296111},{kind:'add-buff',id:16290003}]},
  {id:'162:lb1:burst43',event:'own-hit',breakthrough:1,when:c=>!c.buffs.count(c.actor,16296111) && fact(c,'burstPotential43')===true,
    effects:[{kind:'add-buff',id:16296111},{kind:'add-buff',id:16243011}]},
  {id:'162:lb2:init',event:'initialize',breakthrough:2,effects:[{kind:'add-buff',id:16296211}]},
  {id:'162:lb2:rapier',event:'before-own-hit',breakthrough:2,when:c=>c.tags.includes(combatTagHash('QingSuper')) && fact(c,'glimmer')===true,effects:[{kind:'once',id:16296211}]},
  {id:'162:lb2:claymore',event:'before-own-hit',breakthrough:2,when:c=>c.tags.includes(combatTagHash('ZhongSuper')) && fact(c,'glimmer')===true,effects:[{kind:'once',id:16296221}]},
  {id:'162:lb3',event:'before-own-hit',breakthrough:3,when:c=>fact(c,'eliteOrBoss')===true,effects:[{kind:'once',id:16296311}]},
  {id:'162:lb4',event:'own-light-mark',breakthrough:4,effects:[{kind:'add-buff',id:16296411}]},
  {id:'162:lb5:rapier',event:'before-own-hit',breakthrough:5,when:c=>c.tags.includes(combatTagHash('QingAndQi')) && Number(fact(c,'hpFraction'))>=0.2,effects:[{kind:'once',id:16296511}]},
  {id:'162:lb5:claymore',event:'before-own-hit',breakthrough:5,when:c=>c.tags.includes(combatTagHash('Zhong')) && Number(fact(c,'hpFraction'))>=0.2,effects:[{kind:'once',id:16296521}]},
];

/** Registry presence means a reviewed proc mapping, not a complete casting,
 * resource, movement, summon or potential adapter for that character. */
export const reviewedBreakthroughRules:Readonly<Record<number,readonly CombatProcRule[]>> = {
  103:kohakuBreakthroughRules,107:tiliaBreakthroughRules,108:kasimiraBreakthroughRules,110:character110BreakthroughRules,
  111:character111BreakthroughRules,112:character112BreakthroughRules,113:character113BreakthroughRules,114:character114BreakthroughRules,
  115:hotaruBreakthroughRules,116:character116BreakthroughRules,117:character117BreakthroughRules,118:character118BreakthroughRules,
  119:character119BreakthroughRules,120:character120BreakthroughRules,123:character123BreakthroughRules,
  125:character125BreakthroughRules,126:character126BreakthroughRules,127:character127BreakthroughRules,130:character130BreakthroughRules,149:grayBreakthroughRules,
  132:character132BreakthroughRules,134:character134BreakthroughRules,139:character139BreakthroughRules,140:character140BreakthroughRules,
  141:character141BreakthroughRules,142:character142BreakthroughRules,143:character143BreakthroughRules,144:character144BreakthroughRules,145:character145BreakthroughRules,
  133:character133BreakthroughRules,135:character135BreakthroughRules,147:character147BreakthroughRules,150:character150BreakthroughRules,
  155:character155BreakthroughRules,156:character156BreakthroughRules,157:character157BreakthroughRules,158:character158BreakthroughRules,
  159:character159BreakthroughRules,160:character160BreakthroughRules,161:character161BreakthroughRules,
  137:character137BreakthroughRules,162:character162BreakthroughRules,
};
