import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {tonaSupportCombo} from '../core/combat-tona-variants';
const timings=JSON.parse(readFileSync('public/data/combat/130.json','utf8'));
describe('Tona native support combination selection',()=>{
  for(const count of [1,2,3])for(const mask of Array.from({length:8},(_,i)=>i)){
    it(`resolves the exact native resource for ${count} water actors and potential mask ${mask}`,()=>{
      const potentials=Object.fromEntries([513021,513023,513030].map((id,index)=>[id,(mask>>index)&1]));
      const tag=tonaSupportCombo(potentials,count);
      expect(timings.comboAliases.some((alias:{tag:string})=>alias.tag===tag)).toBe(true);
      if(count===1&&potentials[513021])expect(tag).toBe('B2_Skill');
    });
  }
  it('uses the two other water characters as a three-water party, not count two',()=>{
    expect(tonaSupportCombo({513021:1,513023:1,513030:1},3)).toBe('B2p30P21P23_Skill_3');
  });
});
