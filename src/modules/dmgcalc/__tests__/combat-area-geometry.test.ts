import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {createCombatAreaGeometry,createCombatLandingGeometry} from '../core/combat-area-geometry';
const data=JSON.parse(readFileSync('public/data/combat/145.json','utf8'));
const weapon=data.weapons.find((weapon:any)=>weapon.name==='AreaEffect_145_SkilSup_SteelRain');
describe('native moving area dimensions',()=>{
  it('grows a scripted support field without granting its maximum radius at spawn',()=>{
    const source=JSON.parse(readFileSync('public/data/combat/160.json','utf8'));
    const field=source.weapons.find((w:any)=>w.name==='AreaEffect_16001_SupArea');
    const geometry=createCombatAreaGeometry({...field,components:[...field.components,
      {type:'AreaEffect_ScriptScale',data:{interval:.1,step:.005,maximum:60}}]},{x:0,z:0},60,
      {owner:{x:0,z:0},main:{x:0,z:0},target:{x:9,z:0}});
    expect(geometry.contains({x:9,z:0},0)).toBe(false);
    expect(geometry.contains({x:9,z:0},3)).toBe(true);
    expect(geometry.contains({x:10.5,z:0},60)).toBe(false);
  });
  it('tests scattered bomb overlap at its landing point instead of moving every explosion onto the boss',()=>{
    const source=JSON.parse(readFileSync('public/data/combat/140.json','utf8'));
    const bomb=source.weapons.find((weapon:any)=>weapon.name==='Bullet_140_Tank_P09');
    const geometry=createCombatLandingGeometry(bomb,{x:2,z:0});
    expect(geometry.contains({x:2,z:.9},0)).toBe(true);
    expect(geometry.contains({x:2,z:1.1},0)).toBe(false);
    const thrown=source.weapons.find((weapon:any)=>weapon.name==='Bullet_140_Tank_Attack');
    expect(createCombatLandingGeometry(thrown,{x:5,z:0}).contains({x:2,z:0},0)).toBe(false);
  });
  it('expands both edges of the umbrella ring without damaging the empty center',()=>{
    const ring=data.weapons.find((weapon:any)=>weapon.name==='AreaEffect_145_Ultra_RingBoom');
    const area=createCombatAreaGeometry(ring,{x:0,z:0});
    expect(area.contains({x:5.2,z:0},.1)).toBe(false);
    expect(area.contains({x:5.2,z:0},.2)).toBe(true);
    expect(area.contains({x:0,z:0},.2)).toBe(false);
    expect(area.contains({x:5.2,z:0},1.5)).toBe(false);
  });
  it('moves the real rectangle rather than treating every tick as a hit at the boss',()=>{
    const area=createCombatAreaGeometry(weapon,{x:2,z:0});
    expect(area.contains({x:2,z:0},0)).toBe(true);
    expect(area.contains({x:2,z:0},1)).toBe(false);
    expect(area.contains({x:7,z:4},1)).toBe(true);
    expect(area.contains({x:7,z:6},1)).toBe(false);
    expect(area.positionAt(1)).toEqual({x:7,z:0});
  });
  it('keeps the movement direction separate from hitbox width and orientation',()=>{
    const area=createCombatAreaGeometry(weapon,{x:0,z:0,angle:90});
    expect(area.positionAt(1).x).toBeCloseTo(0);
    expect(area.positionAt(1).z).toBeCloseTo(5);
    expect(area.contains({x:4,z:5},1)).toBe(true);
    expect(area.contains({x:0,z:0},1)).toBe(false);
  });
});
