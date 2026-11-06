import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {willowDecibelState,willowSupportSkill,type WillowSupportDecision} from '../core/combat-willow-support-state';
const skills=JSON.parse(readFileSync('public/data/Skill.json','utf8'));
describe('summer Willow native support priorities',()=>{
  it('uses the strict forty-decibel boundary',()=>{
    expect(willowDecibelState(true,40)).toBe(1);
    expect(willowDecibelState(true,41)).toBe(2);
    expect(willowDecibelState(false,100)).toBe(0);
  });
  for(const mode of [1,2] as const)for(let mask=0;mask<8;mask++){
    it(`keeps native action precedence in mode ${mode}, trigger mask ${mask}`,()=>{
      const state:WillowSupportDecision={resident:true,paused:false,decibelState:mode,
        canRotate:Boolean(mask&1),canLine:Boolean(mask&2),canTorrential:Boolean(mask&4)};
      const selected=willowSupportSkill(state,{516021:1,516022:1,516023:1},16010002);
      const expected=mask&1?16032005:mode===1&&(mask&2)?16032004:mask&4?16032006:16010002;
      expect(selected).toBe(expected);
      if(selected!==16010002)expect(skills[selected!]!.FCPath).toContain('_16001.');
      expect(willowSupportSkill({...state,paused:true},{516021:1,516022:1,516023:1},16010002)).toBeNull();
      expect(willowSupportSkill({...state,resident:false},{516021:1,516022:1,516023:1},16010002)).toBeNull();
    });
  }
  it('does not enable unselected potentials merely because their flags are set',()=>{
    expect(willowSupportSkill({resident:true,paused:false,decibelState:1,canRotate:true,canLine:true,canTorrential:true},{},123)).toBe(123);
  });
});
