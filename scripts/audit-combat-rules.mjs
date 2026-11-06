import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = process.env.STELLA_MANAGED_SOURCE || 'C:/Users/User/.codex/tools/rea/investigations/stella/managed-analysis/decompiled-current';
const names = ['Character','KR/Character','CharPotential','Potential','TalentGroup','Talent','Skill','Effect','EffectValue','Buff','BuffValue','CombatCharacterIndex'];
const tables = Object.fromEntries(await Promise.all(names.map(async name => [name, JSON.parse(await readFile(join(root,'public/data',`${name}.json`),'utf8'))])));
const server = await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {classifyCombatEffect} = await server.ssrLoadModule('/src/modules/dmgcalc/core/combat-rule-classifier.ts');
  const {resolveCombatValueId} = await server.ssrLoadModule('/src/modules/dmgcalc/core/rotation-values.ts');
  const {reviewedBreakthroughRules} = await server.ssrLoadModule('/src/modules/dmgcalc/core/combat-breakthrough-rules.ts');
  const effects = new Map(), characters = [], referenceGaps = [], ambiguousSourceReferences = [];
  const addEffect = (effectId, actor, origin, context, ambiguous = false) => {
    const metadata = tables.Effect[effectId];
    const valueId = metadata ? resolveCombatValueId(metadata,context) : effectId;
    const value = tables.EffectValue[valueId];
    const classification = classifyCombatEffect(metadata,value);
    const key = `${effectId}:${valueId}`;
    if (!effects.has(key)) effects.set(key,{effectId,valueId,...classification,actors:[],origins:[],evidence:[]});
    const entry = effects.get(key);
    if (!entry.actors.includes(actor)) entry.actors.push(actor);
    if (!entry.origins.includes(origin)) entry.origins.push(origin);
    const evidence = ambiguous ? 'source-number-candidate' : 'table-reference';
    if (!entry.evidence.includes(evidence)) entry.evidence.push(evidence);
    if (classification.kind === 'missing-data') (ambiguous ? ambiguousSourceReferences : referenceGaps).push({actor,origin,effectId,valueId});
    return {effectId,valueId,kind:classification.kind};
  };
  for (const actor of Object.values(tables.Character).filter(row=>row.Visible && row.Available)) {
    const pool = tables.CharPotential[actor.Id];
    const potentials = [...new Set(Object.values(pool).filter(Array.isArray).flat())].filter(id=>tables.Potential[id]);
    const context = {characterLevel:90,ascension:8,limitBreak:5,potentials:Object.fromEntries(potentials.map(id=>[id,tables.Potential[id].MaxLevel === 1 ? 1 : 6])),
      skillSlots:{2:8,4:8,5:8},notes:{},concertos:{},buildLevel:1};
    const potentialRules = potentials.map(id=>({id,effects:[1,2,3].flatMap(n=>{
      const effectId = tables.Potential[id][`EffectId${n}`];
      return effectId ? [addEffect(effectId,actor.Id,`potential:${id}`,context)] : [];
    })}));
    const groupIds = new Set(Object.values(tables.TalentGroup).filter(group=>group.CharId === actor.Id).map(group=>group.Id));
    const talents = Object.values(tables.Talent).filter(talent=>groupIds.has(talent.GroupId));
    const talentRules = talents.map(talent=>({id:talent.Id,breakthrough:tables.TalentGroup[talent.GroupId].Background,
      effects:(talent.EffectId ?? []).map(id=>addEffect(id,actor.Id,`talent:${talent.Id}`,context)),buffs:talent.BuffId ?? []}));
    const roles = Object.fromEntries(['NormalAtkId','SkillId','UltimateId','AssistNormalAtkId','AssistSkillId','AssistUltimateId'].map(role=>{
      const skill = tables.Skill[actor[role]];
      return [role,{id:actor[role],script:skill?.FCPath,cooldown:skill?.SkillCD ?? 0,spCost:skill?.UltraEnergy ?? 0,spBudget:skill?.GetEnergyLimit ?? 0}];
    }));
    const sourceDir = join(sourceRoot,'AIScript/Character',`_${actor.Id}01`);
    const scriptMechanisms = [];
    for (const file of (await readdir(sourceDir)).filter(file=>file.endsWith('.cs')).sort()) {
      const source = await readFile(join(sourceDir,file),'utf8');
      const references = [...new Set((source.match(/\b\d{5,10}\b/g) ?? []).map(Number))];
      const directEffects = references.filter(id=>tables.Effect[id]).map(id=>addEffect(id,actor.Id,`source:${file}`,context,true));
      const buffs = references.filter(id=>tables.Buff[id]).map(id=>{
        const metadata = tables.Buff[id], valueId = resolveCombatValueId(metadata,context), value = tables.BuffValue[valueId];
        return {id,valueId,singleInstance:value?.Num===1,effects:(value?.Effects ?? []).map(effect=>addEffect(effect,actor.Id,`buff:${id}:${file}`,context,true))};
      });
      const hooks = [...new Set([...source.matchAll(/(?:AddEventListener|RemoveEventListener)\("([^"]+)"/g)].map(match=>match[1]))];
      scriptMechanisms.push({file,sha256:createHash('sha256').update(source).digest('hex'),hooks,effectCandidates:directEffects,buffCandidates:buffs,
        warning:'소스 숫자와 데이터 ID의 일치 후보입니다. 상수 충돌·사용되지 않는 값이 포함될 수 있으며 실행 규칙으로 간주하지 않습니다.'});
    }
    characters.push({id:actor.Id,name:tables['KR/Character'][actor.Name],roles,potentialRules,talentRules,scriptMechanisms,
      reviewedProcRules:(reviewedBreakthroughRules[actor.Id] ?? []).map(rule=>({id:rule.id,event:rule.event,breakthrough:rule.breakthrough})),
      timing:tables.CombatCharacterIndex.characters[actor.Id]});
  }
  const groups = new Map();
  for (const rule of effects.values()) {
    const key = `${rule.kind}:${rule.signature}`;
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(rule);
  }
  const report = {warning:'공통 규칙 분류 결과이며 캐릭터 전용 메커니즘 구현 완료를 뜻하지 않습니다.',
    characters,effects:[...effects.values()],commonGroups:[...groups.entries()].map(([signature,rules])=>({signature,kind:rules[0].kind,
      effects:rules.map(rule=>rule.effectId),actors:[...new Set(rules.flatMap(rule=>rule.actors))]})),referenceGaps,ambiguousSourceReferences};
  await mkdir(join(root,'reports'),{recursive:true});
  await writeFile(join(root,'reports/combat-rule-catalog.json'),JSON.stringify(report,null,2)+'\n');
  const counts = Object.fromEntries([...new Set(report.effects.map(rule=>rule.kind))].map(kind=>[kind,report.effects.filter(rule=>rule.kind===kind).length]));
  console.log(JSON.stringify({characters:characters.length,roles:characters.length*6,effects:effects.size,patterns:report.commonGroups.length,counts,referenceGaps:referenceGaps.length}));
} finally { await server.close(); }
