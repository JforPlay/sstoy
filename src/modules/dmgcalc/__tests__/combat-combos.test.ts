import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {resolveCombatCombo,type CombatComboSource} from '../core/combat-combos';
const data:CombatComboSource=JSON.parse(readFileSync('public/data/combat/137.json','utf8'));
describe('native combo namespaces',()=>{
  it('separates character Atk1 from drone Atk1 in the same extracted character',()=>{
    const main=resolveCombatCombo(data,'Atk1',0,1,60,.1);
    const drone=resolveCombatCombo(data,'Atk1',0,1,60,.1,{source:'char_13701_combos_uav.unity3d'});
    expect(main.sourcePathId).not.toBe(drone.sourcePathId);
    expect(main.events.some(frame=>frame.event.type===1)).toBe(true);
    expect(drone.events.filter(frame=>frame.event.type===2)).toHaveLength(1); // only its selected event group
  });
  it('refuses a different summon namespace rather than silently selecting main animations',()=>{
    expect(()=>resolveCombatCombo(data,'Atk1',0,1,60,.1,{source:'char_15601_combos_penguindoll.unity3d'})).toThrow(/Missing combat combo/);
  });
});
