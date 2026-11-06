import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

// Read the same pure codec as the site's import UI; do not invent a second format.
const root = resolve(import.meta.dirname, '..');
const read = async name => JSON.parse(await readFile(resolve(root, 'public/data', `${name}.json`), 'utf8'));
const source = await readFile(resolve(root, 'src/modules/app-ingame-codec.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { decodeIngameCode } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const example = JSON.parse(await readFile(resolve(root, 'public/guides/rotation-example.json'), 'utf8'));
const code = process.argv[2] || example.potentialPreset;
const configPath = resolve(root, 'public/data/Config.json');
const configBytes = await readFile(configPath);
const configRows = Object.values(JSON.parse(configBytes.toString('utf8')));
const [raidLevels, scoreSwitches] = await Promise.all(['ScoreBossLevel', 'ScoreGetSwitch'].map(read));
const scoringConfiguration = {
  source: configPath, sha256: createHash('sha256').update(configBytes).digest('hex'),
  durationSeconds: Number(configRows.find(row => row.Id === 'ScoreBossTimeLimit')?.Value),
  sourceRule: 'PlayerScoreBossData.DamageToScore: floor(cumulativeDamage / SwitchRate), plus technical score',
  levels: Object.values(raidLevels).map(level => ({ id: level.Id, group: level.ScoreGetSwitchGroup,
    switchRate: scoreSwitches[level.ScoreGetSwitchGroup * 1000 + 1]?.SwitchRate ?? null })),
};
const timingReport = JSON.parse(await readFile(resolve(root, 'reports/combat-timings.json'), 'utf8'));
const [pools, chars, skills, hits, items, names, charNames, descriptions, potentials, potentialText] = await Promise.all(
  ['CharPotential', 'Character', 'Skill', 'HitDamage', 'Item', 'KR/Item', 'KR/Character', 'KR/Skill', 'Potential', 'KR/Potential'].map(read));
const schemas = new Map(Object.values(pools).map(pool => [pool.Id, {
  master: { specificLen: pool.MasterSpecificPotentialIds.length, normalLen: pool.MasterNormalPotentialIds.length, commonLen: pool.CommonPotentialIds.length },
  assist: { specificLen: pool.AssistSpecificPotentialIds.length, normalLen: pool.AssistNormalPotentialIds.length, commonLen: pool.CommonPotentialIds.length },
}]));
const decoded = decodeIngameCode(code, schemas, 7);
if (!decoded.ok) throw new Error(`Preset decode failed: ${JSON.stringify(decoded)}`);
const [talents, talentText, additionalAttributes] = await Promise.all(['Talent', 'KR/Talent', 'OnceAdditionalAttributeValue'].map(read));
const party = decoded.payload.slots.map((slot, i) => {
  const pool = pools[slot.charId];
  const char = chars[slot.charId];
  const limitBreak = code === example.potentialPreset ? example.characters?.find(entry => entry.id === slot.charId)?.limitBreak ?? null : null;
  // Keep original units until runtime scaling and gain limits are independently verified.
  const energyRaw = Object.fromEntries(['EnergyConvRatio', 'EnergyEfficiency', 'ChargingRate', 'EnergyConsume'].map(key => [key, char[key] ?? null]));
  const unlockedLimitBreakTalents = limitBreak === null ? [] : Object.values(talents)
    .filter(row => row.Type === 1 && Math.floor(row.GroupId / 100) === slot.charId && row.GroupId % 100 <= limitBreak)
    .map(row => ({ id: row.Id, name: talentText[row.Title], description: talentText[row.Desc], data: row,
      attributeReferences: Object.values(row).filter(value => typeof value === 'string' && value.startsWith('OnceAdditionalAttributeValue,NoLevel,'))
        .map(reference => ({ reference, data: additionalAttributes[reference.split(',')[2]] })) }));
  const selected = [];
  const add = (id, level) => { if (level) selected.push({ id, name: names[items[id]?.Title] || String(id), totalLevel: level, baseLevel: Math.min(6, level), badgeLevels: Math.max(0, level - 6), description: potentialText[potentials[id]?.Desc], data: potentials[id] }); };
  pool[i ? 'AssistSpecificPotentialIds' : 'MasterSpecificPotentialIds'].forEach((id, n) => add(id, slot.specificOn[n] ? 1 : 0));
  pool[i ? 'AssistNormalPotentialIds' : 'MasterNormalPotentialIds'].forEach((id, n) => add(id, slot.normalLevels[n]));
  pool.CommonPotentialIds.forEach((id, n) => add(id, slot.commonLevels[n]));
  const fields = i ? ['AssistNormalAtkId', 'AssistSkillId', 'AssistUltimateId'] : ['NormalAtkId', 'SkillId', 'UltimateId'];
  return { position: ['master', 'assist1', 'assist2'][i], id: slot.charId, name: charNames[char.Name],
    limitBreak, energyRaw, unlockedLimitBreakTalents,
    potentials: selected,
    skills: fields.map(field => {
      const skill = skills[char[field]];
      const params = Object.entries(skill).filter(([key]) => /^Param\d+$/.test(key)).map(([, value]) => value);
      const references = params.filter(value => /^HitDamage,/i.test(value)).map(value => ({ parameter: value, data: hits[value.split(',')[2]] }));
      return { field, id: skill.Id, name: descriptions[skill.Title], description: descriptions[skill.Desc], cooldownSeconds: skill.SkillCD === undefined ? null : skill.SkillCD / 10000,
        ultimateEnergyRaw: skill.UltraEnergy ?? null, energyGainLimitRaw: skill.GetEnergyLimit ?? null,
        script: skill.FCPath, hits: references, params };
    }) };
});
const [discs, mainSkills, secondarySkills, mainText, secondaryText] = await Promise.all(['Disc', 'MainSkill', 'SecondarySkill', 'KR/MainSkill', 'KR/SecondarySkill'].map(read));
const records = code === example.potentialPreset ? example.records.map(record => {
  const disc = discs[record.id];
  const melody = record.slot.startsWith('main') ? Object.values(mainSkills).find(row => row.GroupId === disc.MainSkillGroupId && row.Level === record.limitBreak + 1) : null;
  const concertos = record.slot.startsWith('main') ? example.concertos.filter(c => [disc.SecondarySkillGroupId1, disc.SecondarySkillGroupId2].includes(c.groupId)).map(config => {
    const row = Object.values(secondarySkills).find(row => row.GroupId === config.groupId && row.Level === config.level);
    if (!row || secondaryText[row.Name] !== config.name) throw new Error(`Invalid concerto: ${config.name}/${config.level}`);
    return { ...row, name: config.name, description: secondaryText[row.Desc], requirements: JSON.parse(row.NeedSubNoteSkills || '{}') };
  }) : [];
  return { ...record, name: names[items[record.id]?.Title], data: disc, melody: melody && { ...melody, description: mainText[melody.Desc] }, concertos };
}) : [];
const minimumNotes = {};
for (const record of records) for (const skill of record.concertos) for (const [id, level] of Object.entries(skill.requirements)) minimumNotes[id] = Math.max(minimumNotes[id] || 0, level);
const report = {
  preset: code, durationSeconds: 180, party,
  scoringConfiguration,
  combatTimingSource: 'reports/combat-timings.json',
  combatTimingSummary: timingReport.characters.map(char => ({ id: char.id, timelines: char.timelines.length,
    animationMatched: char.timelines.filter(t => t.fixedPointScaleVerifiedAgainstAnimation).length })),
  records,
  concertoDisplayOrder: code === example.potentialPreset ? example.concertos : [],
  minimumNotesForRequestedConcertos: minimumNotes,
  noteConfiguration: example.notes === 'concertoMinimum' ? '사용자 지정: 협주 최소 요구 음표를 최종 음표로 사용' : '프리셋 밖에서 별도 지정 필요',
  badgeConfiguration: example.badgeOptions,
  absentFromPreset: ['record selection and levels', 'notes', 'concerto', 'skill levels', 'character stats and limit breaks', 'target boss'],
  unresolved: ['runtime speed, scripted hits, animation locks and cancellation flag semantics', 'normal-chain and ultimate-form transitions', 'energy gain and support charging rules', 'conditional potential/mark/concerto triggers', 'boss phase/resistance changes', 'damage-to-score ratio units, rounding and technical score aggregation'],
  finalScore: null,
};
const output = resolve(root, 'reports/rotation-preset.json');
await mkdir(resolve(root, 'reports'), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, party: party.map(c => ({ name: c.name, potentials: c.potentials.map(p => `${p.name} Lv.${p.totalLevel}`), skills: c.skills.map(s => ({ name: s.name, cooldownSeconds: s.cooldownSeconds })) })), absentFromPreset: report.absentFromPreset, unresolved: report.unresolved }, null, 2));
