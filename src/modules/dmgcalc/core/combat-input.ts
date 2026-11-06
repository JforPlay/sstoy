import type { DmgCalcState, DiscSlotId } from '../types';
import type { LiveCombatInput } from './combat-live-build';
import { PHASE_TO_LEVEL,normalizeDiscLimitBreak,normalizeBaseSkillLevel } from '../constants';

/** Plain JSON snapshot: the worker never reads a fixture or browser globals. */
export function captureCombatInput(calc: DmgCalcState, builder: any, discs: any, characters: Record<string, any>): LiveCombatInput {
  const positions = ['master', 'assist1', 'assist2'] as const;
  const actors = positions.flatMap((position, index) => {
    const selected = builder?.party?.[position];
    if (!selected || typeof selected !== 'object') return [];
    const id = Number(selected.id), character = characters[id];
    if (!character) throw new Error(`여행가 ${id} 데이터가 없습니다.`);
    const phase = builder.characterLevelPhase?.[position] ?? 8;
    const levels = builder.skillLevels?.[position] ?? {};
    const potentials = Object.fromEntries((builder.selectedPotentials?.[position] ?? []).map((potential: number) =>
      [potential, Math.max(1, Math.min(6, calc.potentialLevelOverrides[potential] ?? builder.potentialLevels?.[position]?.[potential] ?? 1))]));
    return [{ id, badgeOffset: index * 3, level: index ? (phase >= 8 ? 90 : PHASE_TO_LEVEL[phase] ?? 1) : calc.masterLevel, ascension: Math.min(8, phase),
      limitBreak: index ? calc.supportLimitBreaks[position as 'assist1' | 'assist2'] : calc.limitBreak, potentials,
      skillSlots: Object.fromEntries(Object.entries(index ? { 2: levels[character.AssistNormalAtkId] ?? 8, 4: levels[character.AssistSkillId] ?? 8, 5: levels[character.UltimateId] ?? 8 }
        : { 2: calc.skillLevels.normalAtk, 4: calc.skillLevels.skill, 5: calc.skillLevels.ultimate }).map(([slot,level])=>[slot,normalizeBaseSkillLevel(Number(level))])) }];
  });
  if (!actors.length || !builder?.party?.master) throw new Error('메인 여행가를 선택해 주세요.');
  const slots: DiscSlotId[] = ['main1', 'main2', 'main3', 'sub1', 'sub2', 'sub3'];
  return { actors, records: slots.map(slot => ({ id: Number(discs?.selectedDiscs?.[slot]?.Id ?? 0),
    level: calc.discLevels[slot], limitBreak: normalizeDiscLimitBreak(calc.discLimitBreaks[slot]) })),
    notes: { ...calc.noteOverrides }, badgeOptions: calc.badgeOptions.map(options => [...options]) };
}
