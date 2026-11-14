import { describe, expect, it } from 'vitest';
import { createCombatRuntime, type CombatScenario, type CombatAction } from '../core/combat-runtime';
import type { CompiledCombo, CombatTimelineEvent } from '../core/combat-timeline';
const event: CombatTimelineEvent = { skinId: 1, index: 0, type: 1, name: '', tag: '', hitDamageId: 1,
  startSeconds: .5, endSeconds: .5, damageDetectIntervalSeconds: 0 };
const combo: CompiledCombo = { duration: 1, activationEnd: .8, phases: [{ time: 0, execute: 255, break: 255, executeSkills: [], breakSkills: [] }],
  events: [{ time: .5, event, occurrence: 0 }] };
const action = (id: string, actor: string): CombatAction => ({ id, actor, flag: 4, cooldown: 2, cooldownTiming: 'start',
  spCost: 0, spBudget: 10000, skillKey: id, combo });
const scenario = (): CombatScenario => ({ fps: 60,
  actors: [{ id: 'main', main: true, spCapacity: 100000, efficiency: 1 }, { id: 'support', main: false, spCapacity: 100000, efficiency: .75 }],
  actions: [action('main-skill', 'main'), { ...action('support-skill', 'support'), cooldownTiming: 'end' }],
  onEvent(state, hit, api) {
    if (hit.kind === 'combo') { api.damage(100); api.hitSp(hit, 15000); }
    if (hit.kind === 'projectile') api.damage(50);
  },
});
describe('fixed-clock combat runtime', () => {
  it('records actual interruption time and pre-spend SP without changing simulation',()=>{
    const data=scenario();data.recordActions=true;
    data.actions.push({...action('main-dodge','main'),flag:16,spCost:10000});
    const model=createCombatRuntime(data);let s=model.initial();s.sp.ledger.pools.main!.value=20000;
    const original=model.cast(s,'main-skill',0).state;
    s=model.advance(original,.25).state;s=model.cast(s,'main-dodge',.25).state;
    expect(s.actionLog).toMatchObject([{action:'main-skill',time:0,end:.25,interrupted:true},
      {action:'main-dodge',time:.25,sp:2,requiredSp:1}]);
    expect(original.actionLog![0]!.interrupted).toBe(false);
    expect(original.actionLog).toHaveLength(1);
    const disabled=createCombatRuntime({...data,recordActions:false});
    expect(disabled.cast(disabled.initial(),'main-skill',0).state.actionLog).toBeUndefined();
  });
  it('checks the actual skill ID for a CertainSkillId interruption window',()=>{
    const data=scenario();
    data.actions[0]={...data.actions[0]!,combo:{...combo,phases:[{time:0,execute:64,break:64,executeSkills:[42],breakSkills:[42]}]}};
    data.actions.push({...action('allowed-follow','main'),flag:64,skillKey:'42'},
      {...action('other-follow','main'),flag:64,skillKey:'43'});
    const model=createCombatRuntime(data),state=model.cast(model.initial(),'main-skill',0).state;
    expect(model.actions(state,0)).toContain('allowed-follow');
    expect(model.actions(state,0)).not.toContain('other-follow');
  });
  it('restarts recovery from zero progress when a native binding empties its section',()=>{
    const data=scenario();
    data.onCast=(_state,action,api)=>{if(action.id==='main-skill')api.schedule({kind:'rebind',actor:'main'},.25);};
    data.onEvent=(_state,event,api)=>{if(event.kind==='rebind')api.restartCooldown('main-skill');};
    const model=createCombatRuntime(data),state=model.advance(model.cast(model.initial(),'main-skill',0).state,.25).state;
    expect(state.ready['main-skill']).toBe(135);
    expect(model.actions(model.advance(state,2).state,2)).not.toContain('main-skill');
    expect(model.actions(model.advance(state,2.25).state,2.25)).toContain('main-skill');
  });
  it('changes an already-running charge period without resetting elapsed recovery',()=>{
    const data=scenario();data.actions[0]={...data.actions[0]!,charges:2,cooldown:4};
    data.cooldown=(state,action)=>action.id==='main-skill'&&state.script.haste?2:action.cooldown;
    data.onCast=(_state,action,api)=>{if(action.id==='main-skill')api.schedule({kind:'haste',actor:'main'},1);};
    data.onEvent=(state,event)=>{if(event.kind==='haste')state.script.haste=1;};
    const model=createCombatRuntime(data);
    const original=model.cast(model.initial(),'main-skill',0).state;
    const changed=model.advance(original,1.5).state;
    expect(changed.chargeRecovery?.['main-skill']?.next).toBe(120);
    expect(changed.chargeRecovery?.['main-skill']?.period).toBe(120);
    expect(original.chargeRecovery?.['main-skill']?.next).toBe(240);
    expect(model.advance(changed,2).state.chargeRecovery?.['main-skill']?.value).toBe(2);
  });
  it('proactively consumes a charge without recasting and adds native skill SP budget',()=>{
    const data=scenario();
    data.actions[0]={...data.actions[0]!,charges:3};
    data.onChargeConsumed=(state,action)=>{state.script.chargeOwner=action.actor;};
    data.continuation=(state,action,api)=>{
      if(action.id!=='main-skill'||state.script.continued)return null;
      expect(api.chargeCount(action.id)).toBe(2);
      expect(api.consumeCharge(action.id)).toBe(true);
      expect(api.chargeCount(action.id)).toBe(1);
      state.script.continued=1;return combo;
    };
    const model=createCombatRuntime(data);
    const state=model.advance(model.cast(model.initial(),'main-skill',0).state,1.5).state;
    expect(state.counts['main-skill']).toBe(1);
    expect(state.counts['main-skill:charge-consumed']).toBe(1);
    expect(state.script.chargeOwner).toBe('main');
    expect(state.sp.budgets['main-skill']?.maximum).toBe(20000);
    expect(state.chargeRecovery?.['main-skill']?.next).toBe(120);
  });
  it('continues a native combo without a second cast, charge consumption or SP budget activation',()=>{
    const data=scenario();
    data.actions[0]={...data.actions[0]!,charges:2};
    data.onCast=state=>{state.script.casts=Number(state.script.casts ?? 0)+1;};
    data.onActionEnd=state=>{state.script.ends=Number(state.script.ends ?? 0)+1;};
    data.continuation=(state,action)=>{
      if(action.id!=='main-skill'||state.script.continued)return null;
      state.script.continued=1;return combo;
    };
    const model=createCombatRuntime(data);
    let state=model.cast(model.initial(),'main-skill',0).state;
    state=model.advance(state,1.5).state;
    expect(state.damage).toBe(200);
    expect(state.script.casts).toBe(1);
    expect(state.script.ends).toBeUndefined();
    expect(state.chargeRecovery?.['main-skill']?.value).toBe(1);
    expect(state.sp.budgets['main-skill']?.maximum).toBe(10000);
    state=model.advance(state,2).state;
    expect(state.script.ends).toBe(1);
    expect(state.counts['main-skill']).toBe(1);
  });
  it('consumes independent charges, enforces use interval, and recovers sequentially without restarting',()=>{
    const data=scenario();
    data.actions[0]={...data.actions[0]!,charges:3,useInterval:.5};
    const model=createCombatRuntime(data);
    let state=model.cast(model.initial(),'main-skill',0).state;
    expect(model.actions(state,0)).not.toContain('main-skill');
    state=model.advance(state,.5).state;
    expect(model.actions(state,.5)).toContain('main-skill');
    state=model.cast(state,'main-skill',.5).state;
    state=model.advance(state,1).state;
    state=model.cast(state,'main-skill',1).state;
    expect(state.chargeRecovery?.['main-skill']?.value).toBe(0);
    expect(state.ready['main-skill']).toBe(120);
    const recovered=model.advance(state,2).state;
    expect(recovered.chargeRecovery?.['main-skill']?.value).toBe(1);
    expect(recovered.chargeRecovery?.['main-skill']?.next).toBe(240);
    expect(state.chargeRecovery?.['main-skill']?.value).toBe(0);
    expect(model.advance(recovered,6).state.chargeRecovery?.['main-skill']?.value).toBe(3);
  });
  it('pauses recovery without disabling stocked charges and resets the use interval with all charges',()=>{
    const data=scenario();
    data.actions[0]={...data.actions[0]!,charges:2,useInterval:.5};
    data.onCast=(_state,action,api)=>{
      if(action.id!=='main-skill')return;
      api.pauseCooldown(action.id);
      api.schedule({kind:'resume',actor:'main'},3);
      api.schedule({kind:'reset',actor:'main'},4);
    };
    data.onEvent=(_state,event,api)=>{
      if(event.kind==='resume'){api.reduceCooldown('main-skill',1);api.retainCooldownPercent('main-skill',50);api.resumeCooldown('main-skill');}
      if(event.kind==='reset')api.resetCooldown('main-skill');
    };
    const model=createCombatRuntime(data);
    let state=model.cast(model.initial(),'main-skill',0).state;
    state=model.advance(state,1).state;
    expect(model.actions(state,1)).toContain('main-skill');
    expect(state.chargeRecovery?.['main-skill']?.paused).toBe(120);
    state=model.advance(state,3).state;
    expect(state.chargeRecovery?.['main-skill']?.next).toBe(210);
    state=model.advance(state,3.5).state;
    expect(state.chargeRecovery?.['main-skill']?.value).toBe(2);
    state=model.cast(state,'main-skill',3.5).state;
    state=model.advance(state,4).state;
    expect(state.chargeRecovery?.['main-skill']?.value).toBe(2);
    expect(state.useReady?.['main-skill']).toBeUndefined();
  });
  it('starts end-timed charge recovery at animation end and preserves a running recovery on subsequent casts',()=>{
    const data=scenario();
    data.actions[1]={...data.actions[1]!,charges:2,useInterval:.25};
    const model=createCombatRuntime(data);
    let state=model.cast(model.initial(),'support-skill',0).state;
    expect(state.chargeRecovery?.['support-skill']?.next).toBe(Number.MAX_SAFE_INTEGER);
    state=model.advance(state,1).state;
    expect(state.chargeRecovery?.['support-skill']?.next).toBe(180);
    state=model.cast(state,'support-skill',1).state;
    state=model.advance(state,2).state;
    expect(state.chargeRecovery?.['support-skill']?.next).toBe(180);
    expect(model.advance(state,3).state.chargeRecovery?.['support-skill']?.value).toBe(1);
  });
  it('freezes recovery, applies reductions to remaining time, and resumes on the shared clock',()=>{
    const data=scenario();
    data.onCast=(_state,action,api)=>{
      if(action.id!=='main-skill')return;
      api.schedule({kind:'pause',actor:'main'},.5);
      api.schedule({kind:'reduce',actor:'main'},3);
      api.schedule({kind:'resume',actor:'main'},4);
    };
    data.onEvent=(_state,event,api)=>{
      if(event.kind==='pause')api.pauseCooldown('main-skill');
      if(event.kind==='reduce'){api.reduceCooldown('main-skill',.5);api.retainCooldownPercent('main-skill',50);}
      if(event.kind==='resume')api.resumeCooldown('main-skill');
    };
    const model=createCombatRuntime(data);
    const initial=model.cast(model.initial(),'main-skill',0).state;
    const paused=model.advance(initial,2).state;
    expect(paused.pausedCooldowns?.['main-skill']).toBe(90);
    expect(model.actions(paused,2)).not.toContain('main-skill');
    const reduced=model.advance(paused,3).state;
    expect(reduced.pausedCooldowns?.['main-skill']).toBe(30);
    expect(paused.pausedCooldowns?.['main-skill']).toBe(90);
    const resumed=model.advance(reduced,4).state;
    expect(resumed.ready['main-skill']).toBe(270);
    expect(model.actions(model.advance(resumed,4.5).state,4.5)).toContain('main-skill');
  });
  it('uses a shared cooldown key for reset and reduction, including a paused timer',()=>{
    const data=scenario();
    data.actions[0]!.cooldownKey='main-group';
    data.onCast=(_state,action,api)=>{
      if(action.id!=='main-skill')return;
      api.pauseCooldown('main-skill');
      api.reduceCooldown('main-skill',1);
      api.schedule({kind:'reset',actor:'main'},.5);
    };
    data.onEvent=(_state,event,api)=>{if(event.kind==='reset')api.resetCooldown('main-skill');};
    const model=createCombatRuntime(data);
    let state=model.cast(model.initial(),'main-skill',0).state;
    expect(state.pausedCooldowns?.['main-group']).toBe(60);
    state=model.advance(state,.5).state;
    expect(state.pausedCooldowns?.['main-group']).toBeUndefined();
    expect(state.ready['main-group']).toBe(30);
    expect(model.actions(state,.5)).toContain('main-skill');
  });
  it('allows script-forced motion replacement while cancelling only the replaced animation events',()=>{
    const data=scenario();
    data.actions[0]={...data.actions[0]!,combo:{...combo,phases:[{time:0,execute:0,break:0,executeSkills:[],breakSkills:[]}]}};
    data.actions.push({...action('script-area','main'),automatic:true});
    data.onCast=(_state,action,api)=>{if(action.id==='main-skill')api.schedule({kind:'force',actor:'main'},.25);};
    const original=data.onEvent;
    data.onEvent=(state,event,api)=>{if(event.kind==='force')api.cast('script-area',true);else original(state,event,api);};
    const model=createCombatRuntime(data);
    let state=model.cast(model.initial(),'main-skill',0).state;
    expect(model.actions(state,0)).not.toContain('script-area');
    state=model.advance(state,1).state;
    expect(state.damage).toBe(100);
    expect(state.counts['script-area']).toBe(1);
    expect(state.counts['main-skill']).toBe(1);
    expect(state.ready['script-area']).toBe(135);
  });
  it.each(['SP','cooldown'])('does not bypass %s for a script-launched skill',gate=>{
    const data=scenario();
    data.actions.push({...action('script-area','main'),spCost:gate==='SP' ? 10000 : 0,automatic:true});
    data.onCast=(state,action,api)=>{
      if(action.id!=='main-skill') return;
      if(gate==='cooldown') state.ready['script-area']=120;
      api.schedule({kind:'force',actor:'main'},.25);
    };
    data.onEvent=(_state,event,api)=>{if(event.kind==='force')api.cast('script-area',true);};
    const model=createCombatRuntime(data),state=model.cast(model.initial(),'main-skill',0).state;
    expect(()=>model.advance(state,.25)).toThrow(/Illegal action/);
  });
  it('schedules the selected runtime-speed combo and uses its actual cancel windows', () => {
    const data = scenario();
    data.comboFor = () => ({ ...combo, duration:.5, activationEnd:.4,
      phases:[{time:0,execute:0,break:0,executeSkills:[],breakSkills:[]},{time:.4,execute:255,break:255,executeSkills:[],breakSkills:[]}],
      events:[{...combo.events[0]!,time:.25}] });
    data.actions.push(action('interrupt', 'main'));
    const model = createCombatRuntime(data);
    let state = model.cast(model.initial(), 'main-skill', 0).state;
    expect(model.actions(state,0)).not.toContain('interrupt');
    state = model.advance(state,.25).state;
    expect(state.damage).toBe(100);
    expect(state.motions.main!.ends).toBe(30);
    state = model.advance(state,.4).state;
    expect(model.actions(state,.4)).toContain('interrupt');
  });
  it('allows main and support skills in parallel, with independent actor locks', () => {
    const model = createCombatRuntime(scenario());
    let state = model.initial();
    state = model.cast(state, 'main-skill', 0).state;
    expect(model.actions(state, 0)).toContain('support-skill');
    state = model.cast(state, 'support-skill', 0).state;
    state = model.advance(state, 1).state;
    expect(state.damage).toBe(200);
    expect(state.sp.ledger.pools.main!.value).toBe(20000);
    expect(state.sp.ledger.pools.support!.value).toBe(15000);
    expect(state.ready['main-skill']).toBe(120);
    expect(state.ready['support-skill']).toBe(180);
  });
  it('cancels unlaunched animation hits, but preserves launched projectiles', () => {
    const data = scenario();
    data.actions.push(action('interrupt', 'main'));
    data.onCast = (_state, action, api) => {
      if (action.id === 'main-skill') api.schedule({ kind: 'projectile', actor: 'main' }, .75);
    };
    const model = createCombatRuntime(data);
    const original = model.initial();
    let state = model.cast(original, 'main-skill', 0).state;
    state = model.advance(state, .25).state;
    state = model.cast(state, 'interrupt', .25).state;
    state = model.advance(state, 1).state;
    expect(state.damage).toBe(150);
    expect(original.damage).toBe(0);
    expect(original.queue).toHaveLength(0);
  });
  it('starts end-timed cooldown at the actual interruption, not predicted full duration', () => {
    const data = scenario();
    data.actions.push(action('support-ultimate', 'support'));
    const model = createCombatRuntime(data);
    let state = model.cast(model.initial(), 'support-skill', 0).state;
    state = model.advance(state, .25).state;
    state = model.cast(state, 'support-ultimate', .25).state;
    expect(state.ready['support-skill']).toBe(135);
  });
});
