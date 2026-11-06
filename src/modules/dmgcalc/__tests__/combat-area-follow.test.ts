import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {planCombatFollowPath} from '../core/combat-area-follow';
const weapons=JSON.parse(readFileSync('public/data/combat/143.json','utf8')).weapons;
const config=weapons.find((weapon:any)=>weapon.name==='AreaEffect_143_P21_LongJuanFeng').components.find((component:any)=>component.type==='AreaEffect_FollowComponent').data;
describe('native following-area motion',()=>{
  it('advances toward a fixed target at its configured capped speed',()=>{
    const path=planCombatFollowPath(config,{x:5,z:0,angle:0},{x:2,z:0,angle:0},2);
    expect(path[30]!.x).toBeCloseTo(3);
    expect(path.every(point=>Math.abs(point.z)<1e-9)).toBe(true);
  });
  it('shakes across the target and reverses direction instead of snapping to it',()=>{
    const path=planCombatFollowPath(config,{x:5,z:0,angle:0},{x:2,z:0,angle:0},3);
    expect(Math.min(...path.map(point=>point.x))).toBeLessThan(.2);
    expect(Math.max(...path.slice(60).map(point=>point.x))).toBeGreaterThan(3.8);
  });
});
