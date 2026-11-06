import type { CombatEffectMetadata, CombatEffectValue } from './combat-effects';

export type CommonCombatRule = 'static-attribute' | 'hit-attribute' | 'conditional-attribute' | 'individual-mechanism' | 'missing-data';
export interface CombatRuleClassification { kind: CommonCombatRule; reason: string; signature: string }

/** Structural classification, not proof of a script's event implementation. */
export function isUnconditionalOwnerEffect(metadata: CombatEffectMetadata): boolean {
  const row = metadata as CombatEffectMetadata & Record<string, unknown>;
  return row.Trigger === 1 && (row.TriggerTarget ?? 1) === 1 && (row.TakeEffectTarget1 ?? 1) === 1
    && row.Target1 === 1 && !row.Target2
    && Object.entries(row).every(([key, value]) => !/^(TriggerCondition|TakeEffectCondition|TargetCondition)\d+$/.test(key)
      || value === 0 || value === 1)
    && !row.TakeEffectTarget2 && !row.TriggerTarget2;
}

export function classifyCombatEffect(metadata?: CombatEffectMetadata, value?: CombatEffectValue): CombatRuleClassification {
  if (!metadata || !value) return { kind:'missing-data', reason:'효과 정의 또는 레벨별 값 누락', signature:'missing' };
  const signature = JSON.stringify([metadata.Trigger ?? 0, metadata.TriggerCondition1 ?? 0, metadata.TriggerCondition2 ?? 0,
    metadata.TakeEffectCondition1 ?? 0, metadata.Target1 ?? 0, value.EffectType, value.EffectTypeSecondSubtype]);
  const result = (kind: CommonCombatRule, reason: string) => ({kind, reason, signature});
  if (value.EffectRate !== undefined && value.EffectRate !== 100) return result('individual-mechanism','확률 발동');
  if (Number(value.EffectTypeParam2 || 0) !== 0) return result('individual-mechanism','원본 능력치 참조 또는 별도 매개변수');
  if (!Number.isFinite(Number(value.EffectTypeParam1 || 0))) return result('individual-mechanism','수치가 아닌 효과 매개변수');
  if ([12,52,53,56,57].includes(value.EffectType)) {
    return isUnconditionalOwnerEffect(metadata) ? result('static-attribute','상시 자기 능력치') : result('conditional-attribute','발동 조건·대상 선택 필요');
  }
  if ([45,54,55,58,59].includes(value.EffectType)) return result('hit-attribute','타격 시에만 적용하는 추가 능력치');
  return result('individual-mechanism','자원·상태·소환·추가 공격 등 개별 실행 필요');
}
