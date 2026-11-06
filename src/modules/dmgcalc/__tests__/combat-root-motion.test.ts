import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {evaluateCombatCurve,sampleCombatRootTranslation,sampleCombatComboTranslation} from '../core/combat-root-motion';
import {chainCombatCombos,compileCombo,type CombatTimeline} from '../core/combat-timeline';

const actor=JSON.parse(readFileSync('public/data/combat/145.json','utf8')) as {
  comboAliases:{tag:string;clips:string[]}[];timelines:CombatTimeline[];
};
const move=actor.comboAliases.find(action=>action.tag==='Skill_Mian_Move')!;
const clip=actor.timelines.find(timeline=>timeline.pathId===move.clips[0])!;

describe('serialized local root translation',()=>{
  it('uses the real 145 movement curve and its 1.5 multiplier',()=>{
    const motion=clip.rootMotionRaw!;
    expect(motion.rootMotionForward!.m_keys).toHaveLength(8);
    expect(sampleCombatRootTranslation(motion,0)).toEqual({side:0,forward:0,vertical:0});
    const middle=sampleCombatRootTranslation(motion,clip.animationDurationSeconds/2);
    expect(middle.forward).toBeGreaterThan(0);
    expect(middle.forward).toBeLessThan(3.75);
    expect(sampleCombatRootTranslation(motion,clip.animationDurationSeconds).forward).toBeCloseTo(3.75);
  });
  it('preserves curved interpolation and ping-pong wrapping instead of linearizing the keys',()=>{
    const fixed=(value:number)=>({_serializedValue:value*4294967296});
    const curve={m_preWrapMode:4,m_postWrapMode:4,m_keys:[
      {m_Time:fixed(0),m_Value:fixed(0),m_InTangent:fixed(0),m_OutTangent:fixed(0)},
      {m_Time:fixed(1),m_Value:fixed(1),m_InTangent:fixed(0),m_OutTangent:fixed(0)},
    ]};
    expect(evaluateCombatCurve(curve,.25)).toBe(.15625);
    expect(evaluateCombatCurve(curve,1.75)).toBe(.15625);
    expect(evaluateCombatCurve(curve,-.25)).toBe(.15625);
  });
  it('keeps translated clips on the chained clock, including truncated movement',()=>{
    const moving=compileCombo(clip,false,1,14501,.1);
    const still={...moving,translation:undefined};
    const half=moving.duration/2;
    const chain=chainCombatCombos([{combo:still},{combo:moving,until:half},{combo:moving}]);
    expect(sampleCombatComboTranslation(chain,moving.duration,Math.PI/2)).toEqual({x:0,z:0});
    const partial=sampleCombatComboTranslation(chain,moving.duration+half,Math.PI/2);
    expect(partial.x).toBeCloseTo(0);
    expect(partial.z).toBeGreaterThan(0);
    expect(partial.z).toBeLessThan(3.75);
    expect(sampleCombatComboTranslation(chain,chain.duration,Math.PI/2).z).toBeCloseTo(partial.z+3.75);
  });
});
