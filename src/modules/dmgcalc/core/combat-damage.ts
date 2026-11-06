/** Pure port of the installed client's CommonHelper.CalculateNormalDamage.
 * Inputs are resolved per actor and per hit, after conditional attributes and
 * AttributeSetLimit. Ratios here are decimals, not table myriad units.
 * JS doubles are used: this is not a bit-exact FDP implementation.
 */
export interface CombatDamageInput {
  scalingValue: number;
  skillPercentRaw: number;
  talentPercentRaw?: number;
  skillFlat: number;
  talentFlat?: number;
  additionalFlat?: number;
  skillIntensity: number;
  perkIntensity: number;
  slotDamage: number;
  elementDamage: number;
  generalDamage: number;
  damagePlus: number;
  critRate: number;
  critPower: number;
  slotCritPower: number;
  enemyDef: number;
  enemyOriginalDef: number;
  defIgnore: number;
  defPenetrate: number;
  dynamicDefCap: number;
  enemyResistance: number;
  resistanceIgnore: number;
  resistancePenetrate: number;
  suppress: number;
  baseSuppress: number;
  dynamicSuppress: number;
  noElement: boolean;
  slotTaken: number;
  elementTaken: number;
  generalTaken: number;
  toughnessMultiplier: number;
  environmentMultiplier: number;
  damagePlusTaken: number;
  finalDamage: number;
  finalDamagePlus: number;
}
export interface ResistanceBracket { lower: number; upper: number; amendLower: number; amendUpper: number }
export interface ResistanceRules { low: ResistanceBracket; middle: ResistanceBracket; high: ResistanceBracket }
export function combatResistanceMultiplier(resistance: number, rules: ResistanceRules, suppress: number, base: number, dynamic: number): number {
  if (resistance <= 0) return 1 + suppress * base + suppress * resistance * -.01 * dynamic;
  const bracket = resistance >= rules.low.lower && resistance <= rules.low.upper ? rules.low
    : resistance >= rules.middle.lower && resistance <= rules.middle.upper ? rules.middle : rules.high;
  const fraction = (resistance - bracket.lower) / (bracket.upper - bracket.lower);
  return 1 - Math.min(rules.high.amendUpper, bracket.amendLower + (bracket.amendUpper - bracket.amendLower) * fraction ** 2);
}
export function calculateCombatDamage(input: CombatDamageInput, resistance: ResistanceRules): { base: number; crit: number; average: number } {
  if (Object.values(input).some(value => typeof value === 'number' && !Number.isFinite(value))) throw new Error('Invalid combat damage input');
  const effectiveDef = Math.max(input.enemyOriginalDef - input.dynamicDefCap,
    input.enemyDef * (1 - input.defIgnore) - input.defPenetrate);
  const defense = 1 - effectiveDef * 40 / (effectiveDef * 32 + 24000);
  const effectiveResistance = input.enemyResistance * (1 - input.resistanceIgnore) - input.resistancePenetrate;
  const elemental = input.noElement ? 1 : combatResistanceMultiplier(effectiveResistance, resistance, input.suppress, input.baseSuppress, input.dynamicSuppress);
  const raw = Math.max(1, input.scalingValue * (input.skillPercentRaw + (input.talentPercentRaw ?? 0)) / 1000000
    + input.skillFlat + (input.talentFlat ?? 0) + (input.additionalFlat ?? 0));
  const amplified = raw * input.skillIntensity * input.perkIntensity * input.slotDamage
    * (input.noElement ? 1 : input.elementDamage) * input.generalDamage + input.damagePlus;
  const taken = elemental * defense * input.slotTaken * (input.noElement ? 1 : input.elementTaken)
    * input.generalTaken * input.toughnessMultiplier * input.environmentMultiplier;
  const final = (crit: number) => Math.max(1, Math.trunc((amplified * crit * taken + input.damagePlusTaken) * input.finalDamage + input.finalDamagePlus));
  const base = final(1);
  const crit = final(input.critPower + input.slotCritPower);
  const chance = Math.min(1, Math.max(0, input.critRate));
  return { base, crit, average: base * (1 - chance) + crit * chance };
}
