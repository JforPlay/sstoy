/** Client PlayerScoreBossData.DamageToScore / HPLevelChanged / GetTotalScore.
 * SwitchRate is the selected ScoreGetSwitch row, not Config's unused ratio.
 */
export interface RaidScoreState { completedHpScore: number; currentHpDamage: number; currentHpScore: number; technicalScore: number }
export function createRaidScore(): RaidScoreState {
  return { completedHpScore: 0, currentHpDamage: 0, currentHpScore: 0, technicalScore: 0 };
}
export function addRaidDamage(state: RaidScoreState, damage: number, switchRate: number): RaidScoreState {
  if (![damage, switchRate].every(Number.isFinite) || damage < 0 || switchRate <= 0) throw new Error('Invalid raid score inputs');
  const currentHpDamage = state.currentHpDamage + damage;
  return { ...state, currentHpDamage, currentHpScore: Math.floor(currentHpDamage / switchRate) };
}
export function finishRaidHpLevel(state: RaidScoreState): RaidScoreState {
  return { ...state, completedHpScore: state.completedHpScore + state.currentHpScore, currentHpDamage: 0, currentHpScore: 0 };
}
export function setRaidTechnicalScore(state: RaidScoreState, score: number): RaidScoreState {
  if (!Number.isFinite(score) || score < 0) throw new Error('Invalid technical score');
  return { ...state, technicalScore: score };
}
export function getRaidScore(state: RaidScoreState): number {
  return state.completedHpScore + state.currentHpScore + state.technicalScore;
}
