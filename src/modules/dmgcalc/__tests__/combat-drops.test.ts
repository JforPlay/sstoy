import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {planCombatDrop} from '../core/combat-drops';
const data=JSON.parse(readFileSync('public/data/combat/132.json','utf8'));
const star=data.weapons.find((weapon:any)=>weapon.name==='Item_132_Support_P24_Star');
describe('native pickup clocks',()=>{
  it('waits for birth and adsorption, then accelerates in three dimensions',()=>{
    const plan=planCombatDrop(star,{x:2,z:0,y:1},{x:0,z:0});
    expect(plan.picked).toBe(true);
    expect(plan.time).toBeGreaterThan(1.3);
    expect(plan.time).toBeLessThan(1.6);
    expect(plan.buff).toBe(13224011);
    expect(plan.tag).toBe('132_Item_P24');
    expect(plan.maximum).toBe(5);
    expect(planCombatDrop(star,{x:2,z:0,y:0},{x:0,z:0}).time).toBeLessThan(plan.time);
  });
  it('uses a strict pickup radius and expires without granting a distant drop',()=>{
    const edge=planCombatDrop(star,{x:4,z:0},{x:0,z:0});
    expect(edge.picked).toBe(false);
    expect(edge.time).toBe(10.8);
    expect(planCombatDrop(star,{x:3.99,z:0},{x:0,z:0}).picked).toBe(true);
  });
});
