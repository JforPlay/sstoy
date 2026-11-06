import {describe,it,expect} from 'vitest';
import {matchesCombatTargetFilter,type CombatFilterActor,type CombatTargetCriterion} from '../core/combat-target-filter';
const main:CombatFilterActor={id:'main',player:true,main:true,element:5,summoner:null,minion:false};
const support:CombatFilterActor={...main,id:'support',main:false,element:2};
const minion:CombatFilterActor={id:'minion',player:false,main:false,element:5,monsterEpic:5,summoner:'main',minion:true};
const projectile:CombatFilterActor={...minion,id:'projectile',minion:false};
const boss:CombatFilterActor={id:'boss',player:false,main:false,element:4,monsterEpic:7,summoner:null,minion:false};
const context={actors:[main,support,minion,projectile,boss],relation:(_from:string,to:string):'friend'|'enemy'=>to==='boss' ? 'enemy' : 'friend'};
const criterion=(targetType:number,elementType=254,monsterEpicType=30,operationType=0):CombatTargetCriterion=>({targetType,elementType,monsterEpicType,operationType});
describe('native common target filter',()=>{
  it.each([
    [2,['main']],[4,['support','minion','projectile']],[8,['main','support','minion','projectile']],[16,['boss']],
    [64,['minion']],[128,[]],[256,['minion']],[512,[]],[1024,['minion']],[2048,['main']],[4096,['support']],
    [8192,['support']],[16384,['support','minion']],[32768,['main','support']],[0,[]],[65534,['main','support','minion','projectile','boss']],
  ] as [number,string[]][])('matches target flags %s exactly',(mask,expected)=>{
    expect(context.actors.filter(target=>matchesCombatTargetFilter(main,target,{filterCriteriaList:[criterion(mask)]},context)).map(target=>target.id)).toEqual(expected);
  });
  it('combines target masks with elements and the BossRush/leader boss classification',()=>{
    expect(matchesCombatTargetFilter(main,boss,{filterCriteriaList:[criterion(16,16,16)]},context)).toBe(true);
    expect(matchesCombatTargetFilter(main,boss,{filterCriteriaList:[criterion(16,32,16)]},context)).toBe(false);
    expect(matchesCombatTargetFilter(main,boss,{filterCriteriaList:[criterion(16,16,4)]},context)).toBe(false);
    expect(matchesCombatTargetFilter(main,{...boss,monsterEpic:3},{filterCriteriaList:[criterion(16,16,16)]},context)).toBe(true);
  });
  it('retains both the per-criterion OR and the outer list OR, including an empty list',()=>{
    expect(matchesCombatTargetFilter(main,boss,{filterCriteriaList:[]},context)).toBe(true);
    expect(matchesCombatTargetFilter(main,boss,{filterCriteriaList:[criterion(2,16,0,1)]},context)).toBe(true);
    const clauses=[criterion(2),criterion(16)];
    expect(matchesCombatTargetFilter(main,boss,{filterCriteriaList:clauses,operationType:0},context)).toBe(false);
    expect(matchesCombatTargetFilter(main,boss,{filterCriteriaList:clauses,operationType:1},context)).toBe(true);
  });
});
