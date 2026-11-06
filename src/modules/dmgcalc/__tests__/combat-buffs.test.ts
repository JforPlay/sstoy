import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addCombatBuff, combatBuffCount, expireCombatBuffs,removeCombatBuff, type CombatBuffState } from '../core/combat-buffs';
const buffs = JSON.parse(readFileSync('public/data/BuffValue.json', 'utf8'));
describe('native timed stack behavior', () => {
  it('refreshes an entire stack group, including at the cap', () => {
    const row = buffs[16207011];
    let state: CombatBuffState = {};
    for (let n = 0; n < 10; n++) state = addCombatBuff(state, row, 'main', 'main', n);
    expect(combatBuffCount(state, 'main', row.Id, 9)).toBe(row.LaminatedNum);
    expect(state[`main:${row.Id}`]!.expires).toBe(9 + row.Time / 10000);
    expect(combatBuffCount(state, 'support', row.Id, 9)).toBe(0);
  });
  it('expires at its deadline and retains permanent light wishes', () => {
    let state = addCombatBuff({}, buffs[4066000], 'main', 'main', 0);
    state = addCombatBuff(state, buffs[4038203], 'main', 'main', 0);
    expect(combatBuffCount(state, 'main', 4038203, 10)).toBe(0);
    expect(expireCombatBuffs(state, 180)['main:4066000']!.stacks).toBe(1);
  });
  it('does not mutate a parent search branch', () => {
    const first = addCombatBuff({}, buffs[4066000], 'main', 'main', 0);
    const second = addCombatBuff(first, buffs[4066000], 'main', 'main', 1);
    expect(first['main:4066000']!.stacks).toBe(1);
    expect(second['main:4066000']!.stacks).toBe(2);
  });
  it('keeps parallel instances and their individual expiration times',()=>{
    const row={Id:1,Num:3,LaminatedNum:1,Time:100000,Timing:1,TimeSuperposition:2,ReplaceType:true,ReplaceMode:false};
    let state:CombatBuffState={};
    for(let n=0;n<3;n++) state=addCombatBuff(state,row,'main','support',n);
    expect(combatBuffCount(state,'main',1,2)).toBe(3);
    expect(combatBuffCount(state,'main',1,10)).toBe(2);
    state=addCombatBuff(state,row,'main','support',3);
    expect(Object.values(state).map(buff=>buff.expires)).toEqual([11,12,13]);
    expect(combatBuffCount(state,'main',1,11)).toBe(2);
  });
  it('refreshes the last instance at its cap without creating another stack',()=>{
    const row={Id:1,Num:2,LaminatedNum:1,Time:100000,Timing:1,TimeSuperposition:2,ReplaceType:true,ReplaceMode:true};
    let state=addCombatBuff({},row,'main','a',0);
    state=addCombatBuff(state,row,'main','b',1);
    state=addCombatBuff(state,row,'main','c',5);
    expect(Object.values(state).map(buff=>buff.expires)).toEqual([10,15]);
    expect(Object.values(state).map(buff=>buff.source)).toEqual(['a','b']);
    expect(combatBuffCount(state,'main',1,5)).toBe(2);
  });
  it('retains each stack source and removes newest stacks on each matching instance',()=>{
    const row={Id:1,Num:2,LaminatedNum:3,Time:100000,Timing:1};
    let state:CombatBuffState={};
    for(const source of ['a','b','c','d','e']) state=addCombatBuff(state,row,'main',source,0);
    expect(Object.values(state).map(buff=>buff.stacks)).toEqual([3,2]);
    const reduced=removeCombatBuff(state,'main',1,1);
    expect(Object.values(reduced).map(buff=>buff.stacks)).toEqual([2,1]);
    expect(reduced['main:1']!.sources).toEqual(['a','b']);
    expect(state['main:1']!.sources).toEqual(['a','b','c']);
    expect(removeCombatBuff(reduced,'main',1)).toEqual({});
  });
  it('uses official group priority and refuses lower-priority replacement',()=>{
    const first={Id:1,Num:1,GroupId:3,Sort:2};
    const state=addCombatBuff({},first,'main','a',0);
    expect(addCombatBuff(state,{...first,Id:2,Sort:1},'main','b',0)).toBe(state);
    const replaced=addCombatBuff(state,{...first,Id:2,Sort:2},'main','b',0);
    expect(Object.values(replaced).map(buff=>buff.id)).toEqual([2]);
  });
  it('runs sequential instance timers only after the preceding instance ends',()=>{
    const row={Id:1,Num:3,LaminatedNum:1,Time:100000,Timing:2,TimeSuperposition:2,ReplaceType:true,ReplaceMode:true};
    let state=addCombatBuff({},row,'main','main',0);
    state=addCombatBuff(state,row,'main','main',2);
    state=addCombatBuff(state,row,'main','main',3);
    expect(Object.values(state).map(buff=>buff.expires)).toEqual([10,20,30]);
    expect(combatBuffCount(state,'main',1,10)).toBe(2);
    state=addCombatBuff(state,row,'main','main',5);
    expect(Object.values(state).map(buff=>buff.expires)).toEqual([10,20,30]);
    state=expireCombatBuffs(state,15);
    expect(Object.values(state).map(buff=>buff.expires)).toEqual([20,30]);
  });
  it('starts the next sequential timer immediately when the active instance is replaced',()=>{
    const row={Id:1,Num:2,LaminatedNum:1,Time:100000,Timing:2,ReplaceType:true,ReplaceMode:false};
    let state=addCombatBuff({},row,'main','main',0);
    state=addCombatBuff(state,row,'main','main',2);
    state=addCombatBuff(state,row,'main','main',5);
    expect(Object.values(state).map(buff=>buff.expires)).toEqual([15,25]);
  });
  it('keeps a permanent first sequential instance from starting later timers',()=>{
    let state=addCombatBuff({},{Id:1,Num:2,Time:0,Timing:2},'main','a',0);
    state=addCombatBuff(state,{Id:1,Num:2,Time:100000,Timing:2},'main','b',5);
    expect(Object.values(state).map(buff=>buff.expires)).toEqual([null,null]);
    expect(combatBuffCount(state,'main',1,999)).toBe(2);
  });
});
