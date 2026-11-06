/** Scripted rules for the example's three MAIN records. Sub records supply
 * attributes/notes only; their main melodies are deliberately not activated.
 * Attribute values and durations are resolved from tables by the caller.
 */
export interface RecordRuleActor { id: string; light: boolean; job: 'dealer' | 'balance' | 'support' }
export interface RecordRuleConfig {
  summer: number; waves: number; star: number;
  flash: number; sky: number; dance: number; tomorrow: number; footsteps: number; sunlight: number;
}
export interface RecordRuleState { inMainUltimate: boolean; firstMainMark: boolean; firstBalanceMark: boolean; firstSupportMark: boolean; mainSkillHits: number }
export interface RecordRuleBuffs {
  add(owner: string, id: number, source?: string): void;
  remove(owner: string, id: number): void;
  count(owner: string, id: number): number;
}
export function createRecordRules(config: RecordRuleConfig, actors: RecordRuleActor[], main: string) {
  const light = actors.filter(actor => actor.light);
  const group = (buffs: RecordRuleBuffs, id: number) => { for (const actor of light) buffs.add(actor.id, id, main); };
  const addWish = (buffs: RecordRuleBuffs) => {
    buffs.add(main, 4066000, main);
    if (config.flash) buffs.add(main, 4066110 + config.flash, main);
    if (config.tomorrow && light.some(actor => actor.id === main)) buffs.add(main, 4066210 + config.tomorrow, main);
  };
  return {
    initial(buffs: RecordRuleBuffs): RecordRuleState {
      if (config.star) for (const actor of actors) buffs.add(actor.id, 4066000 + config.star, main);
      return { inMainUltimate: false, firstMainMark: false, firstBalanceMark: false, firstSupportMark: false, mainSkillHits: 0 };
    },
    staticEffects(actor: string): number[] {
      const spec = actors.find(item => item.id === actor);
      if (!spec) throw new Error(`Unknown record recipient ${actor}`);
      const ids: number[] = [];
      if (config.waves) ids.push(4038000 + config.waves);
      if (spec.light && config.sky) ids.push(4039100 + config.sky);
      if (spec.light && actor === main) {
        if (config.summer) ids.push(4039000 + config.summer, 4039020 + config.summer);
        if (config.dance) ids.push(4038100 + config.dance, 4038120 + config.dance);
      }
      return ids;
    },
    cast(state: RecordRuleState, buffs: RecordRuleBuffs, actor: string, slot: 'skill' | 'ultimate'): RecordRuleState {
      const result = { ...state };
      const spec = actors.find(item => item.id === actor)!;
      if (actor === main && slot === 'ultimate' && spec.light) result.inMainUltimate = true;
      if (slot === 'skill' && spec.light) {
        if (config.sky) group(buffs, 4039125 + config.sky);
        if (config.tomorrow && light.some(item => item.id === main)) buffs.add(main, 4066200 + config.tomorrow, main);
        if (actor === main && config.sunlight) {
          const count = buffs.count(main, 4039200);
          if (count > 0) {
            buffs.remove(main, 4039200);
            for (const recipient of light) {
              const id = 4039200 + config.sunlight;
              buffs.remove(recipient.id, id);
              for (let n = 0; n < count; n++) buffs.add(recipient.id, id, recipient.id);
            }
          }
        }
      }
      return result;
    },
    end(state: RecordRuleState, actor: string, slot: 'skill' | 'ultimate'): RecordRuleState {
      return actor === main && slot === 'ultimate' ? { ...state, inMainUltimate: false } : state;
    },
    hit(state: RecordRuleState, buffs: RecordRuleBuffs, actor: string, target: string, damageType: number, skillSlot: number): RecordRuleState {
      const result = { ...state };
      const spec = actors.find(item => item.id === actor)!;
      if (config.sunlight && spec.light && damageType === 2) buffs.add(main, 4039200, actor);
      // The native script checks slot B and increments BEFORE `<= 30`; it
      // triggers on the 31st qualifying hit and pauses counting during its buff.
      if (config.footsteps && actor === main && spec.light && skillSlot === 2 && !buffs.count(main, 4038200 + config.footsteps)) {
        result.mainSkillHits++;
        if (result.mainSkillHits > 30) { result.mainSkillHits = 0; group(buffs, 4038200 + config.footsteps); }
      }
      if (config.waves && actor === main && spec.light && skillSlot === 4) buffs.add(target, 4038026 + config.waves, actor);
      if (config.dance && actor === main && spec.light && skillSlot === 2) {
        buffs.add(main, 4038145 + config.dance, actor);
        buffs.add(main, 4038165 + config.dance, actor);
      }
      if (config.star && buffs.count(actor, 4066000)) {
        if (damageType === 2) buffs.add(target, 4066010 + config.star, actor);
        if (config.flash && damageType === 1) buffs.add(target, 4066100 + config.flash, actor);
      }
      return result;
    },
    applyLightMark(state: RecordRuleState, buffs: RecordRuleBuffs, source: string): RecordRuleState {
      const spec = actors.find(actor => actor.id === source)!;
      const result = { ...state };
      if (config.flash && spec.job === 'balance' && !result.firstBalanceMark) { result.firstBalanceMark = true; addWish(buffs); }
      if (config.tomorrow && spec.job === 'support' && !result.firstSupportMark) { result.firstSupportMark = true; addWish(buffs); }
      return result;
    },
    triggerLightMark(state: RecordRuleState, buffs: RecordRuleBuffs, source: string, glitter: boolean): RecordRuleState {
      const spec = actors.find(actor => actor.id === source)!;
      const result = { ...state };
      if (config.star && source === main) {
        if (!result.firstMainMark) { result.firstMainMark = true; addWish(buffs); }
        if (spec.light && glitter) buffs.add(main, 4066020 + config.star, main);
      }
      if (config.summer && result.inMainUltimate && spec.light) group(buffs, 4039040 + config.summer);
      return result;
    },
  };
}
