import type { ExampleCombatTables } from './combat-example-model';

/** The simulator and its regression tests deliberately load the same tables. */
export async function loadExampleCombatTables(read: (name: string) => Promise<any>, characterIds?: number[]): Promise<ExampleCombatTables> {
  const names = {
    recordRules:'CombatRecords',
    badges: 'CharGemAttrValue',
    actorScales:'CombatActorScales',
    characters: 'Character', attributes: 'Attribute', discs: 'Disc', discExtra: 'DiscExtraAttribute',
    potentialPools: 'CharPotential', potentials: 'Potential', secondarySkills: 'SecondarySkill', notes: 'SubNoteSkill',
    ranks: 'StarTowerBuildRank', effects: 'Effect', effectValues: 'EffectValue', talentGroups: 'TalentGroup', talents: 'Talent',
    skills: 'Skill', hits: 'HitDamage', buffDefinitions: 'Buff', buffValues: 'BuffValue',
    onceDefinitions: 'OnceAdditionalAttribute', onceValues: 'OnceAdditionalAttributeValue',
    parameters: 'ScriptParameter', parameterValues: 'ScriptParameterValue', config: 'Config',
    shieldDefinitions:'Shield',shieldValues:'ShieldValue',
    monsterAi:'MonsterAI',monsterBranches:'MonsterActionBranch',
    attributeLimits: 'AttributeLimit', attributeSetLimits: 'AttributeSetLimit',
  };
  const tables = Object.fromEntries(await Promise.all(Object.entries(names).map(async ([key, name]) => [key, await read(name)])));
  if (characterIds) {
    const index = await read('CombatCharacterIndex');
    const characters = await Promise.all([...new Set(characterIds)].map(async id => {
      const entry = index.characters[id];
      if (!entry) throw new Error(`여행가 ${id}의 전투 데이터가 없습니다.`);
      return read(entry.path.replace(/\.json$/, ''));
    }));
    tables.timings = { rules: index.rules, rulesSource: index.rulesSource, characters };
  } else tables.timings = await read('CombatTimings');
  const bossNames = { levels: 'ScoreBossLevel', monsters: 'Monster', adjustments: 'MonsterValueTempleteAdjust',
    templates: 'MonsterValueTemplete', contacts: 'MonsterAttributeContact', modifications: 'MonsterValueTempleteModify', scoreSwitches: 'ScoreGetSwitch', technical: 'ScoreBossGetControl' };
  tables.bossTables = Object.fromEntries(await Promise.all(Object.entries(bossNames).map(async ([key, name]) => [key, await read(name)])));
  tables.bossTables.technicalText = await read('KR/ScoreBossGetControl');
  return tables as unknown as ExampleCombatTables;
}
