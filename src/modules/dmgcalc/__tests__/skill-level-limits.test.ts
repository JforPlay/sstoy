import {describe,it,expect} from 'vitest';
import {getState,resetState,setSkillLevel,setBuildInfo} from '../core/state';
import {normalizeBaseSkillLevel} from '../constants';
describe('base skill levels are separate from badge bonuses',()=>{
  it('caps manual training at ten before the three badge levels',()=>{
    resetState();setSkillLevel('skill',16);
    expect(getState().skillLevels.skill).toBe(10);
    expect(getState().skillLevels.skill+3).toBe(13);
  });
  it('repairs imported oversized skill levels without removing valid training',()=>{
    resetState();setBuildInfo(162,90,{normalAtk:13,skill:16,ultimate:8});
    expect(getState().skillLevels).toEqual({normalAtk:10,skill:10,ultimate:8});
    expect(normalizeBaseSkillLevel(-1)).toBe(1);
  });
});
