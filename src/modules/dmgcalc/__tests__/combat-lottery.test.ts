import {describe,it,expect} from 'vitest';
import {createSupport156} from '../core/combat-support-156';
import type {SupportCombatApi} from '../core/combat-support-adapter';

function fixture() {
  const casts:string[]=[],events:{name:string;seconds:number;data:Record<string,number|string>}[]=[],buffs:[string,number][]=[];
  const api:SupportCombatApi={actor:'156',main:'162',party:['162','156','107'],lightActors:['162','107'],time:0,distance:2,
    buffs:{add(owner,id){buffs.push([owner,id]);},remove(){},count(){return 0;}},
    parameter(){return 1;},area(){return 1;},stopWeapons(){},areaRadius(){return 3;},projectile(){},shield(){},hit(){},removeStacks(){},reduceCooldown(){},
    randomPercent(){return 40;},actorsByElement(element){return element===3?['156']:['162','107'];},
    actorInfo(){return {element:5,job:2};},ultimateReady(){return false;},hasBuffTag(){return false;},
    resetCooldown(){},pauseCooldown(){},resumeCooldown(){},retainCooldownPercent(){},
    activeAction(){return null;},
    interrupt(){},
    hasShieldTag(){return false;},
    directionalProjectile(){},drop(){},
    toughnessDamage(){},bossHasToughness(){return true;},directSp(){},
    cast(key){casts.push(key);},schedule(name,seconds,data={}){events.push({name,seconds,data});}};
  return {api,casts,events,buffs};
}
describe('native support lottery transitions',()=>{
  it('guarantees a triple on the fifth draw, not every draw, after four non-triples',()=>{
    const {api,casts}=fixture(),rules=createSupport156({});
    let state=rules.cast!(rules.initialize(api),api,'skill');
    state=rules.end!(state,api,'skill',false);
    expect(state.result).toBe(8);
    for(let n=0;n<5;n++) {
      state=rules.end!(state,api,'raffle',false);
      state=rules.end!(state,api,n===4?'heart':'strafe-a',false);
      if(n<4) state=rules.event!(state,api,'raffle-next',{generation:state.generation});
      if(n===3) expect(state.result).toBe(256);
    }
    expect(casts.filter(key=>key==='raffle')).toHaveLength(5);
    expect(state.next).toBe(0);
    expect(casts.at(-1)).toBe('heart');
  });
  it('invalidates the pending wait on ultimate and resumes the remaining draw after it ends',()=>{
    const {api,events}=fixture(),rules=createSupport156({});
    let state=rules.cast!(rules.initialize(api),api,'skill');
    state=rules.end!(state,api,'skill',false);
    state=rules.end!(state,api,'raffle',false);
    state=rules.end!(state,api,'strafe-a',false);
    const old=events.at(-1)!;
    state=rules.cast!(state,api,'ultimate');
    const paused=state;
    expect(rules.event!(state,api,old.name,old.data)).toEqual(paused);
    state=rules.end!(state,api,'ultimate',false);
    const resume=events.at(-1)!;
    expect(resume.seconds).toBe(1);
    state=rules.event!(state,api,resume.name,resume.data);
    expect(state.next).toBe(3);
    expect(state.previous).toBe(8);
  });
  it('retains normal-attack-biased weights and the consecutive triple team buff',()=>{
    const {api,buffs}=fixture(),rules=createSupport156({515622:1,515633:1});
    let state=rules.cast!(rules.initialize(api),api,'skill');
    state=rules.end!(state,api,'skill',false);
    expect(state.result).toBe(2);
    state=rules.event!(state,api,'raffle-next',{generation:state.generation});
    expect(buffs.filter(([,id])=>id===15633011)).toHaveLength(3);
    expect(state.result).toBe(2);
  });
});
