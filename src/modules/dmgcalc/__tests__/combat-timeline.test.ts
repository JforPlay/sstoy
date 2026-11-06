import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileCombo, comboAllows, chainCombatCombos, type CombatTimeline } from '../core/combat-timeline';
const data = JSON.parse(readFileSync('public/data/CombatTimings.json', 'utf8'));
const seina = data.characters.find((character: any) => character.id === 162);
const clip = (tag: string): CombatTimeline => {
  const alias = seina.comboAliases.find((alias: any) => alias.tag === tag);
  return seina.timelines.find((timeline: any) => timeline.pathId === alias.clips[0]);
};
describe('installed combo timeline export', () => {
  it('selects the configured native event group instead of combining every potential variant',()=>{
    const data=JSON.parse(readFileSync('public/data/combat/127.json','utf8'));
    const alias=data.comboAliases.find((row:any)=>row.tag==='127_B1_Skill_1st_P01');
    const timeline=data.timelines.find((row:any)=>row.pathId===alias.clips[0]);
    expect(alias.eventGroups[0].split(':')[0]).toBe('1');
    const base=compileCombo(timeline,false,1,12701,.1,60,1,0);
    const perk=compileCombo(timeline,false,1,12701,.1,60,1,1);
    expect(base.events.every(event=>(event.event.group ?? 0)===0)).toBe(true);
    expect(perk.events.every(event=>event.event.group===1)).toBe(true);
    expect(perk.events).not.toEqual(base.events);
  });
  it('retains every detection of a one-per-loop event in the first iteration, but not later iterations',()=>{
    const template=compileCombo(clip('162Atk1'),false,1,16201,.1);
    const event={...template.events[0]!.event,playOnceInLoopMode:true};
    const part={...template,loop:true,sourcePathId:'loop',events:[{time:.1,event,occurrence:0},{time:.2,event,occurrence:1}]};
    const result=chainCombatCombos([{combo:part},{combo:part},{combo:part}]);
    expect(result.events.map(item=>item.time)).toEqual([.1,.2]);
    expect(result.duration).toBeCloseTo(part.duration*3);
  });
  it('retains 64-bit Unity pointer identities as strings', () => {
    expect(clip('Skill_Main1_P1').pathId).toBe('-475975277248071634');
  });
  it('schedules the configured duration even when the animation asset duration differs', () => {
    const combo = compileCombo(clip('Skill_Main2'), false, 1, 16201, .1);
    expect(combo.duration).toBeGreaterThan(0);
    expect(combo.events.every(event => Number.isFinite(event.time))).toBe(true);
  });
  it('attack speed affects normal clips, not skill clips', () => {
    const normal = clip('162Atk1');
    expect(compileCombo(normal, true, 2, 16201, .1).duration).toBeLessThan(compileCombo(normal, true, 1, 16201, .1).duration);
    expect(compileCombo(normal, false, 2, 16201, .1).duration).toBe(compileCombo(normal, false, 1, 16201, .1).duration);
  });
  it('does not convert custom or visual events to hits', () => {
    const combo = compileCombo(clip('Skill_Main1_P1'), false, 1, 16201, .1);
    for (const event of combo.events.filter(event => event.event.type !== 1)) expect(event.occurrence).toBe(0);
    const hitTimes = combo.events.filter(event => event.event.type === 1).map(event => event.time);
    expect(hitTimes.length).toBeGreaterThan(0);
    expect(comboAllows(combo, combo.duration, 4)).toBe(true);
  });
});
