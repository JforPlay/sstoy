import { describe, expect, it } from 'vitest';
import { combatConditionTargets, matchCombatCondition, matchCombatEffectConditions, type ConditionActor, type CombatConditionContext } from '../core/combat-conditions';
import { combatTagHash } from '../core/combat-tags';
const main: ConditionActor = {id:'main',player:true,main:true,hp:100,hpFraction:1,element:5,job:1,faction:1,active:true,broken:false,spPercent:50,
  buffs:[{id:3011,group:3011,tags:[combatTagHash('Light')],stacks:3}],shield:0,tags:[]};
const support: ConditionActor = {...main,id:'support',main:false,active:false};
const boss: ConditionActor = {...main,id:'boss',player:false,main:false,element:3,hp:49,hpFraction:.49,weakElements:[1,5],broken:true};
const context = (): CombatConditionContext => ({owner:'main',source:'main',enemy:'boss',actors:[main,support,boss],
  hit:{id:123,damageType:2,slot:2,elements:[5],distanceType:1,tags:[combatTagHash('Skill')]},skill:{id:456,slot:2},
  mark:{element:5,tag:combatTagHash('Light')},buff:main.buffs[0],effect:{id:789,tag:'sample'},levelType:10,distance:()=>2});

describe('native shared effect conditions', () => {
  it.each([
    [0,'',true],[1,'',true],[2,'100',true],[3,'100',false],[4,'3011',true],[5,'3011',true],[6,'Light',true],
    [7,'2',true],[8,'5',true],[9,'1',true],[10,'5',true],[11,'3011',true],[12,'3011',true],[13,'Light',true],
    [17,'456',true],[18,'',false],[19,'',true],[20,'',false],[25,'9,10',true],[26,'789',true],[27,'sample',true],
    [29,'',true],[30,'1',true],[31,'',false],[34,'Skill',true],[35,'2',true],[36,'3',false],[37,'1',true],
    [39,'123',true],[41,'',true],[42,'',false],[43,'5',false],[44,'5',true],[45,'50',true],[46,'',true],
    [47,'49',false],[48,'',false],[49,'',true],[52,'',true],[53,'',false],[54,'2',true],[55,'',false],
  ] as const)('condition %s follows native comparison semantics', (condition,param,expected) => {
    expect(matchCombatCondition(main,condition,[param],context())).toBe(expected);
  });
  it('counts buff stacks with ID/group/tag filters rather than distinct entries', () => {
    expect(matchCombatCondition(main,23,['3','3011','3011','Light'],context())).toBe(true);
    expect(matchCombatCondition(main,23,['4','3011','3011','Light'],context())).toBe(false);
  });
  it('keeps HP upper inclusive, lower exclusive, and resolves weakness on the target', () => {
    expect(matchCombatCondition(boss,2,['49'],context())).toBe(true);
    expect(matchCombatCondition(boss,3,['49'],context())).toBe(false);
    expect(matchCombatCondition(boss,50,['5'],context())).toBe(true);
    expect(matchCombatCondition(boss,48,[],context())).toBe(true);
  });
  it('matches independent trigger/take-effect targets, including native AND/OR behavior', () => {
    const row = {TriggerTarget:1,TriggerCondition1:10,TriggerParam1:'5',TriggerTarget2:2,TriggerCondition2:3,Trigger2Param1:'50',TriggerLogicType:1};
    expect(matchCombatEffectConditions(row,'Trigger',context())).toBe(true);
    expect(matchCombatEffectConditions({...row,Trigger2Param1:'40'},'Trigger',context())).toBe(false);
    expect(matchCombatEffectConditions({...row,Trigger2Param1:'40',TriggerLogicType:2},'Trigger',context())).toBe(true);
    expect(combatConditionTargets(7,context()).map(actor=>actor.id)).toEqual(['support']);
  });
  it('does not invent unavailable shield, geometry or summon facts', () => {
    expect(()=>matchCombatCondition({...main,shield:undefined},18,[],context())).toThrow(/shield/);
    expect(()=>matchCombatCondition(main,35,['2'],{...context(),distance:undefined})).toThrow(/distance/);
    expect(()=>combatConditionTargets(8,context())).toThrow(/summon/);
  });
  it('resolves all native summon ownership groups without including friendly minions as enemies',()=>{
    const ctx=context();
    const minion={...boss,id:'minion'},other={...boss,id:'other'},enemy={...boss,id:'enemy-minion'};
    ctx.actors.push(minion,other,enemy);
    ctx.summons=[{actor:'minion',owner:'main',friendly:true},{actor:'other',owner:'support',friendly:true},{actor:'enemy-minion',owner:'boss',friendly:false}];
    expect(combatConditionTargets(8,ctx).map(a=>a.id)).toEqual(['minion','other']);
    expect(combatConditionTargets(10,ctx).map(a=>a.id)).toEqual(['main','minion']);
    expect(combatConditionTargets(13,ctx).map(a=>a.id)).toEqual(['minion']);
    expect(combatConditionTargets(14,ctx).map(a=>a.id)).toEqual(['other']);
    expect(combatConditionTargets(15,ctx).map(a=>a.id)).toEqual(['enemy-minion']);
    expect(combatConditionTargets(5,ctx).map(a=>a.id)).toEqual(['boss','enemy-minion']);
    expect(combatConditionTargets(17,ctx).map(a=>a.id)).toEqual(['support','other']);
    expect(matchCombatCondition(main,40,[],ctx)).toBe(true);
    expect(matchCombatCondition(main,40,[],{...ctx,summons:[]})).toBe(false);
  });
  it('checks shields, nearby collider counts, epic types, tags and native random boundaries',()=>{
    const ctx={...context(),shieldId:77,nearbyMonsterCount:()=>2,randomPercent:()=>25};
    expect(matchCombatCondition(main,14,['77'],ctx)).toBe(true);
    expect(matchCombatCondition(main,15,['3','2'],ctx)).toBe(true);
    expect(matchCombatCondition(main,16,['3','1'],ctx)).toBe(false);
    expect(matchCombatCondition(main,24,['25'],ctx)).toBe(true);
    expect(matchCombatCondition(main,24,['26'],ctx)).toBe(false);
    expect(matchCombatCondition({...boss,monsterEpic:7},28,['2,7'],ctx)).toBe(true);
    expect(matchCombatCondition({...boss,monsterTags:['Machine']},32,['Human,Machine'],ctx)).toBe(true);
    expect(matchCombatCondition(main,38,['60'],{...ctx,forwardRatio:()=>Math.cos(Math.PI/6)})).toBe(true);
  });
  it('claims a unique attack only after its target-count threshold succeeds',()=>{
    const taken=new Set<string>();
    const ctx={...context(),hit:{...context().hit!,targetCount:2,attackId:'attack-1'},claimAttack:(owner:string,id:string)=>{
      const key=`${owner}:${id}`;
      if(taken.has(key)) return false;
      taken.add(key);return true;
    }};
    expect(matchCombatCondition(main,21,['3'],ctx)).toBe(false);
    expect(taken.size).toBe(0);
    expect(matchCombatCondition(main,21,['2'],ctx)).toBe(true);
    expect(matchCombatCondition(main,22,['2'],ctx)).toBe(false);
  });
  it('does not confuse element type IDs with the separately numbered mark types',()=>{
    expect(matchCombatCondition(main,51,['3'],context())).toBe(true);
    expect(matchCombatCondition(main,51,['5'],context())).toBe(false);
    expect(matchCombatCondition(main,51,['31'],{...context(),mark:{element:5,tag:combatTagHash('LightMark1')}})).toBe(true);
  });
});
