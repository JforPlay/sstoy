import {describe,it,expect} from 'vitest';
import {combatActionName} from '../core/combat-action-labels';
describe('selected party action labels',()=>{
  it('does not call every non-example character a support',()=>{
    expect(combatActionName('137:skill','137')).toBe('메인 스킬');
    expect(combatActionName('162:skill','137')).toBe('지원 스킬');
    expect(combatActionName('137:skill')).toBe('스킬');
  });
  it.each(['132:skill2-enhanced-2-hold','132:skill3','143:skill:charge-consumed','156:reload','137:normal'])('labels %s without NaN or raw implementation names',action=>{
    const label=combatActionName(action,'132');
    expect(label).not.toMatch(/NaN|undefined|skill|reload|normal/);
  });
});
