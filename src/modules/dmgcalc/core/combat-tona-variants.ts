/** SkillScript_Support_Skill.GetComboTag, including its case-sensitive
 * resource names and P21's early-return precedence over P23/P30. */
export function tonaSupportCombo(potentials:Record<number,number>,waterActors:number):string {
  const p21=Boolean(potentials[513021]),p23=Boolean(potentials[513023]),p30=Boolean(potentials[513030]);
  if(p21){
    if(waterActors===2||waterActors===3){
      const suffix=waterActors===2?'2':'3';
      return p23?`${p30?'B2p30P21P23':'B2P21P23'}_Skill_${suffix}`
        :`${p30?'B2P30P21':'B2P21'}_Skill_${suffix}`;
    }
    return 'B2_Skill';
  }
  if(p23)return waterActors>=3?(p30?'B2P30p23_Skill_3':'B2P23_Skill_3'):(p30?'B2P30P23_Skill':'B2P23_Skill');
  return p30?'B2P30_Skill':'B2_Skill';
}
