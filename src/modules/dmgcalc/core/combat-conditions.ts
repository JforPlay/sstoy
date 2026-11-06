import { combatTagHash } from './combat-tags';

export interface ConditionBuff { id: number; group: number; tags: number[]; stacks: number }
export interface ConditionActor {
  id: string; player: boolean; main: boolean; hp: number; hpFraction: number; element: number;
  job: number; faction: number; active: boolean; broken: boolean; spPercent: number;
  buffs: ConditionBuff[]; shield?: number; weakElements?: number[]; tags?: string[];
  monsterEpic?:number; monsterTags?:string[];
}
export interface CombatConditionContext {
  owner: string; source: string; enemy?: string; actors: ConditionActor[];
  hit?: { id: number; damageType: number; slot: number; elements: number[]; distanceType: number; tags: number[]; attackId?:string; targetCount?:number };
  skill?: { id: number; slot: number };
  buff?: ConditionBuff;
  mark?: { element: number; tag: number };
  effect?: { id: number; tag: string };
  levelType?: number;
  shieldId?:number;
  /** Complete live summon inventory, including hostile summons. Omission is
   * unknown, while [] explicitly means no summons. */
  summons?:{actor:string;owner:string;friendly:boolean}[];
  nearbyMonsterCount?(actor:string,radius:number):number;
  randomPercent?():number;
  claimAttack?(owner:string,attackId:string):boolean;
  forwardRatio?(owner:string,enemy:string):number;
  distance?(from: string, to: string): number;
}
type Metadata = Record<string, number | string | undefined>;
const number = (value: string | number | undefined) => {
  const result = Number(value || 0);
  if (!Number.isFinite(result)) throw new Error(`Condition parameter needs an expression resolver: ${value}`);
  return result;
};
const required = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`Missing combat condition fact: ${label}`);
  return value;
};

/** AdventureEffect.GetGoals. A complete summon inventory is required for
 * summon-dependent goals; unknown ownership never becomes an empty result. */
export function combatConditionTargets(goal: number, context: CombatConditionContext): ConditionActor[] {
  const players = context.actors.filter(actor => actor.player);
  const summons=(filter:(summon:NonNullable<CombatConditionContext['summons']>[number])=>boolean) =>
    required(context.summons,'summon inventory').filter(filter).map(summon=>required(context.actors.find(actor=>actor.id===summon.actor),`summon actor ${summon.actor}`));
  switch (goal) {
    case 0: return [];
    case 1: return context.actors.filter(actor => actor.id === context.owner);
    case 2: return context.actors.filter(actor => actor.id === context.enemy);
    case 3: return players;
    case 4: return players.filter(actor => actor.id !== context.owner);
    case 5: return context.actors.filter(actor => !actor.player && !context.summons?.some(summon=>summon.actor===actor.id && summon.friendly));
    case 6: return players.filter(actor => actor.main);
    case 7: return players.filter(actor => !actor.main);
    case 8: return summons(s=>s.friendly);
    case 9: return [...players,...summons(s=>s.friendly)];
    case 10: return [...context.actors.filter(actor=>actor.id===context.owner),...summons(s=>s.owner===context.owner)];
    case 11: return [...players,...summons(s=>s.friendly)];
    case 12: return context.actors;
    case 13: return summons(s=>s.owner===context.source);
    case 14: return summons(s=>s.friendly && s.owner!==context.owner);
    case 15: return summons(s=>!s.friendly);
    case 16: return summons(()=>true);
    case 17: return [...players.filter(actor=>actor.id!==context.owner),...summons(s=>s.friendly && s.owner!==context.owner)];
    default: throw new Error(`Unknown combat target group ${goal}`);
  }
}

/** Shared native condition predicates. Unknown geometry, shields or summons
 * must be supplied instead of making an optimistic assumption. */
export function matchCombatCondition(actor: ConditionActor, condition: number, params: string[], context: CombatConditionContext): boolean {
  const [p1='',p2='',p3='',p4=''] = params;
  const n = [2,3,4,5,7,8,9,10,11,12,14,15,16,17,21,22,23,24,26,30,35,36,37,38,39,44,45,47,50,51,54].includes(condition) ? number(p1) : 0;
  const hit = context.hit;
  const owner = () => required(context.actors.find(actor => actor.id === context.owner),'owner');
  const has = (predicate: (buff: ConditionBuff)=>boolean) => actor.buffs.some(predicate);
  switch (condition) {
    case 0: case 1: case 29: return true;
    case 2: return n > 0 ? actor.hpFraction * 100 >= n : actor.hp >= number(p2);
    case 3: return n > 0 ? actor.hpFraction * 100 < n : actor.hp < number(p2);
    case 4: return has(buff=>buff.id===n);
    case 5: return has(buff=>buff.group===n);
    case 6: return has(buff=>buff.tags.includes(combatTagHash(p1)));
    case 7: return (context.skill?.slot ?? hit?.slot) === n;
    case 8: return Boolean(hit?.elements.includes(n));
    case 9: return hit?.distanceType === n;
    case 10: return actor.element === n;
    case 11: return context.buff?.id === n;
    case 12: return context.buff?.group === n;
    case 13: return Boolean(context.buff?.tags.includes(combatTagHash(p1)));
    case 14: return required(context.shieldId,'shield event ID')!==0 && context.shieldId===n;
    case 15: return required(context.nearbyMonsterCount,'nearby monster query')(actor.id,n)>=number(p2);
    case 16: return required(context.nearbyMonsterCount,'nearby monster query')(actor.id,n)<=number(p2);
    case 17: return context.skill?.id === n;
    case 18: return required(actor.shield,'shield') > 0;
    case 19: return required(actor.shield,'shield') <= 0;
    case 20: return !actor.main;
    case 21: case 22: {
      if(!hit) return false;
      const count=required(hit.targetCount,'hit target count');
      if(condition===21 ? count<n : count>n) return false;
      return required(context.claimAttack,'attack claim')(context.owner,required(hit.attackId,'unique attack ID'));
    }
    case 23: return actor.buffs.filter(buff=>(!number(p2)||buff.id===number(p2)) && (!number(p3)||buff.group===number(p3))
      && (!p4||buff.tags.includes(combatTagHash(p4)))).reduce((sum,buff)=>sum+buff.stacks,0) >= n;
    // The native predicate is >=, despite the common probability label.
    case 24: return required(context.randomPercent,'condition random stream')()>=n;
    case 25: return p1.split(',').map(number).includes(required(context.levelType,'level type'));
    case 26: return context.effect?.id === n;
    case 27: return context.effect?.tag === p1;
    case 28: return !actor.player && p1.split(',').map(number).includes(required(actor.monsterEpic,'monster epic type'));
    case 30: return actor.player && actor.job === n;
    case 31: return false; // Native implementation always returns false.
    case 32: return !actor.player && p1.split(',').some(tag=>required(actor.monsterTags,'monster tags').includes(tag));
    case 33: return Boolean(hit && required(actor.tags,'actor tags').includes(p1));
    case 34: return Boolean(hit?.tags.includes(combatTagHash(p1)));
    case 35: return required(context.distance,'distance')(actor.id,context.owner) <= n;
    case 36: return required(context.distance,'distance')(actor.id,context.owner) >= n;
    case 37: return actor.faction === n;
    case 38: return context.enemy!==undefined && required(context.forwardRatio,'forward geometry')(context.owner,context.enemy)>=Math.cos(n*Math.PI/360);
    case 39: return hit?.id === n;
    case 40: return required(context.summons,'summon inventory').some(summon=>summon.friendly);
    case 41: return owner().player && owner().main;
    case 42: return owner().player && !owner().main;
    case 43: return context.actors.some(actor=>actor.player && !actor.main && actor.active && p1.split(',').map(number).includes(actor.element));
    case 44: return context.mark?.element === n;
    case 45: return actor.player && actor.spPercent >= n;
    case 46: return owner().hpFraction >= actor.hpFraction;
    case 47: return actor.player && actor.spPercent <= n;
    case 48: return !actor.player && actor.broken;
    case 49: return Boolean(hit && hit.slot !== 5); // Literal native rule, not inferred from its label.
    case 50: return !actor.player && required(actor.weakElements,'weak elements').includes(n);
    case 51: {
      if(!context.mark) return false;
      const elements=['Fire','Water','Light','Dark','Earth','Wind'];
      const name=n>=1 && n<=6 ? elements[n-1] : n>=11 && n<=65 && n%10>=1 && n%10<=5 ? `${elements[Math.floor(n/10)-1]}Mark${n%10}` : String(n);
      return context.mark.tag===combatTagHash(name!);
    }
    case 52: return actor.player && actor.main;
    case 53: return actor.player && !actor.main;
    case 54: return hit?.damageType === n;
    case 55: return context.actors.some(actor=>actor.player && !actor.main && actor.active);
    default: throw new Error(`Combat condition ${condition} requires its dedicated facts`);
  }
}

export function matchCombatEffectConditions(metadata: Metadata, phase: 'Trigger'|'TakeEffect'|'Target', context: CombatConditionContext, target?: ConditionActor): boolean {
  const evaluate = (second: boolean): boolean => {
    const condition = number(metadata[`${phase}Condition${second ? 2 : 1}`]);
    const prefix = `${phase}${second ? '2' : ''}Param`;
    const params = [1,2,3,4].map(index=>String(metadata[`${prefix}${index}`] ?? ''));
    if (phase === 'Target') return matchCombatCondition(required(target,'effect recipient'),condition,params,context);
    const goal = number(metadata[`${phase}Target${second ? '2' : phase === 'TakeEffect' ? '1' : ''}`]);
    if (!goal) return true;
    return combatConditionTargets(goal,context).every(actor=>matchCombatCondition(actor,condition,params,context));
  };
  const first = evaluate(false), second = evaluate(true);
  const logic = number(metadata[phase === 'Target' ? 'TakeEffectLogicType' : `${phase}LogicType`]) || 1;
  if (logic === 1) return first && second;
  if (logic === 2) return first || second;
  throw new Error(`Unknown combat condition logic ${logic}`);
}
