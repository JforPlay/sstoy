import {describe,it,expect} from 'vitest';
import {addCombatShield,combatShieldAmount,combatShieldTotal,expireCombatShields,extendCombatShield,hasCombatShieldTag,type CombatShieldContext} from '../core/combat-shields';
import type {CombatAttributes} from '../core/combat-attributes';

const attr=(origin:number,base=0,percent=0,absolute=0)=>({origin,base,percent,absolute});
const actors:Record<string,CombatAttributes>={source:{3:attr(10000,2000,.5,100),87:attr(1.2),88:attr(1)},
  main:{3:attr(20000),87:attr(1),88:attr(1.5)}};
const context:CombatShieldContext={definitions:{100:{Id:100}},values:{100:{Id:100,ReferenceTarget:1,ReferenceAttrib:4,ReferenceScale:1500,
  AbsorptionBase:100,Time:60000,ShieldLaminatedNum:2,TimeSuperposition:2}},
  levels:{source:{characterLevel:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{},concertos:{},notes:{},buildLevel:1}},
  limits:{},attributes:id=>actors[id]!,hp:()=>1234};

describe('native shield reference, layering and lifetime',()=>{
  it('extends an existing finite shield without changing its absorption or a saved branch',()=>{
    const initial=addCombatShield({},100,'main','source',0,context);
    const next=extendCombatShield(initial,100,'main',4,2);
    expect(initial['main:100']!.expires).toBe(6);
    expect(next['main:100']!.expires).toBe(10);
    expect(next['main:100']!.segments).toEqual(initial['main:100']!.segments);
    expect(extendCombatShield(initial,100,'main',4,6)).toBe(initial);
    expect(hasCombatShieldTag(next,'main',42,7,{100:{Id:100,ShieldTag1:42} as any})).toBe(true);
    expect(hasCombatShieldTag(next,'main',42,10,{100:{Id:100,ShieldTag1:42} as any})).toBe(false);
  });
  it('uses source base HP separately from source strength and recipient efficiency',()=>{
    expect(combatShieldAmount(context.values[100]!,'main','source',context)).toBe(3420);
    expect(combatShieldAmount({...context.values[100]!,ReferenceAttrib:1},'main','source',context)).toBe(5067);
    expect(combatShieldAmount({...context.values[100]!,ReferenceTarget:2},'main','source',context)).toBe(5580);
  });
  it('caps the reference contribution before strength multipliers',()=>{
    expect(combatShieldAmount({...context.values[100]!,ReferenceLimit:500},'main','source',context)).toBe(1080);
    expect(combatShieldAmount({...context.values[100]!,ReferenceAttrib:22},'main','source',context)).toBe(513);
  });
  it('replaces the oldest layer at cap and refreshes the group without mutating a prior state',()=>{
    const first=addCombatShield({},100,'main','source',0,context);
    const second=addCombatShield(first,100,'main','source',2,context);
    const third=addCombatShield(second,100,'main','source',4,context);
    expect(combatShieldTotal(first,'main',1)).toBe(3420);
    expect(combatShieldTotal(third,'main',5)).toBe(6840);
    expect(combatShieldTotal(third,'source',5)).toBe(0);
    expect(combatShieldTotal(third,'main',10)).toBe(0);
    expect(expireCombatShields(third,10)).toEqual({});
  });
  it('extends rather than refreshes time for TimeSuperposition 3',()=>{
    const extended={...context,values:{100:{...context.values[100]!,TimeSuperposition:3}}};
    const first=addCombatShield({},100,'main','source',0,extended);
    expect(addCombatShield(first,100,'main','source',2,extended)['main:100']!.expires).toBe(12);
  });
});
